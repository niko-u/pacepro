import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { extendPlan } from "@/lib/coach/plan-engine";

// Lazy init to avoid build-time errors
let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running plan extension cron job");

    const supabase = getSupabase();

    // Fetch all users with active training plans
    const { data: activePlans, error } = await supabase
      .from("training_plans")
      .select("user_id")
      .eq("status", "active");

    if (error) throw error;

    const results = {
      processed: 0,
      extended: 0,
      errors: 0,
    };

    for (const plan of activePlans || []) {
      try {
        const result = await extendPlan(supabase, plan.user_id);
        results.processed++;
        if (result.workoutsCreated > 0) {
          results.extended++;
        }
      } catch (err) {
        console.error(`Error extending plan for user ${plan.user_id}:`, err);
        results.errors++;
      }
    }

    console.log("Plan extension complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Plan extension cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

// Also allow GET for testing (with auth)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return POST(req);
}
