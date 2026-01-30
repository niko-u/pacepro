import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/get-api-user";
import { generatePlan } from "@/lib/coach/plan-engine";

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
      // Use service client for plan generation (bypasses RLS)
      supabase = getServiceClient();
    }

    // Delete any existing active plan for this user (replace)
    const { error: deleteError } = await supabase
      .from("training_plans")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("status", "active");

    if (deleteError) {
      console.error("Failed to cancel existing plan:", deleteError);
      // Continue anyway — the new plan will be active
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

    return NextResponse.json({
      planId: result.planId,
      workoutsCreated: result.workoutsCreated,
      phases: result.phases.map((p) => ({
        name: p.name,
        weeks: p.weeks,
        volumeMultiplier: p.volumeMultiplier,
      })),
    });
  } catch (error) {
    console.error("Plan generation error:", error);
    const message = error instanceof Error ? error.message : "Plan generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
