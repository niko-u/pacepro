import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/get-api-user";
import { generatePlan } from "@/lib/coach/plan-engine";
import { checkPlanGenerationRateLimit } from "@/lib/rate-limit";

// Lazy-init service role client for system triggers
let _serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceClient;
}

export async function POST(req: NextRequest) {
  try {
    let userId: string;
    let supabase: SupabaseClient;

    // Check for service role auth (system triggers / internal calls)
    const authHeader = req.headers.get("authorization") || "";
    const isServiceCall =
      authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (isServiceCall) {
      // Service role: userId must be provided in body
      const body = await req.json().catch(() => ({}));
      if (!body.userId || typeof body.userId !== "string") {
        return NextResponse.json(
          { error: "userId required for service role calls" },
          { status: 400 }
        );
      }
      userId = body.userId;
      supabase = getServiceClient();
    } else {
      // Regular user auth via Bearer token (mobile) or cookies (web)
      const auth = await getApiUser(req);
      if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = auth.user.id;

      // Rate limit: 3 plan generations per hour per user
      const rateLimit = checkPlanGenerationRateLimit(userId);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again shortly." },
          { status: 429 }
        );
      }

      // Use service client for plan generation (bypasses RLS)
      supabase = getServiceClient();
    }

    // P2-14: Check for in-progress generation (prevents race condition)
    const { data: generatingPlan } = await supabase
      .from("training_plans")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "generating")
      .limit(1)
      .maybeSingle();

    if (generatingPlan) {
      const genAge = (Date.now() - new Date(generatingPlan.created_at).getTime()) / 1000;
      if (genAge < 300) {
        // Still generating (< 5 min old)
        return NextResponse.json(
          { error: "Plan generation already in progress" },
          { status: 409 }
        );
      }
      // Stale lock (> 5 min) — clean it up
      await supabase
        .from("training_plans")
        .update({ status: "cancelled" })
        .eq("id", generatingPlan.id);
    }

    // Also check for recently created active plans (double-tap guard)
    const { data: recentPlans } = await supabase
      .from("training_plans")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentPlans && recentPlans.length > 0) {
      const created = new Date(recentPlans[0].created_at).getTime();
      const ageSeconds = (Date.now() - created) / 1000;
      if (ageSeconds < 30) {
        console.log(`Plan for user ${userId} was just created ${ageSeconds}s ago, skipping duplicate`);
        return NextResponse.json({
          planId: recentPlans[0].id,
          workoutsCreated: 0,
          phases: [],
          skipped: true,
        });
      }
    }

    // Insert a lock plan with 'generating' status to prevent concurrent generation
    const { data: lockPlan, error: lockError } = await supabase
      .from("training_plans")
      .insert({
        user_id: userId,
        status: "generating",
        name: "Generating...",
        goal_race_date: new Date().toISOString().split("T")[0],
        goal_race_type: "pending",
      })
      .select("id")
      .single();

    if (lockError) {
      console.error("Failed to create generation lock:", lockError);
      return NextResponse.json(
        { error: "Plan generation already in progress" },
        { status: 409 }
      );
    }

    try {
      // Cancel any existing active plans for this user
      const { error: deleteError } = await supabase
        .from("training_plans")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      if (deleteError) {
        console.error("Failed to cancel existing plan:", deleteError);
      }

      // Also delete scheduled (not completed) workouts from cancelled plans
      const { data: cancelledPlans } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "cancelled");

      if (cancelledPlans && cancelledPlans.length > 0) {
        const planIds = cancelledPlans.map((p) => p.id);
        await supabase
          .from("workouts")
          .delete()
          .in("plan_id", planIds)
          .eq("status", "scheduled");
      }

      // Generate the new plan
      const result = await generatePlan(supabase, userId);

      // Clean up the lock plan (generatePlan creates its own plan record)
      await supabase
        .from("training_plans")
        .delete()
        .eq("id", lockPlan.id);

      return NextResponse.json({
        planId: result.planId,
        workoutsCreated: result.workoutsCreated,
        phases: result.phases.map((p) => ({
          name: p.name,
          weeks: p.weeks,
          volumeMultiplier: p.volumeMultiplier,
        })),
      });
    } catch (genError) {
      // Clean up lock plan on failure
      await supabase
        .from("training_plans")
        .update({ status: "failed" })
        .eq("id", lockPlan.id);
      throw genError;
    }
  } catch (error) {
    console.error("Plan generation error:", error);
    const message = error instanceof Error ? error.message : "Plan generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
