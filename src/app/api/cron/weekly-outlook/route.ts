import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { generateWeeklyOutlook } from "@/lib/coach/ai";

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

    console.log("Running weekly outlook cron job");

    // Get all active users with notifications enabled
    const supabase = getSupabase();
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, notifications")
      .not("id", "is", null);

    if (error) throw error;

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
    };

    for (const user of users || []) {
      try {
        // Check if user has weekly outlook enabled
        if (user.notifications?.weekly_outlook === false) {
          results.skipped++;
          continue;
        }

        await generateWeeklyOutlookForUser(user.id);
        results.processed++;
      } catch (err) {
        console.error(`Error generating outlook for user ${user.id}:`, err);
        results.errors++;
      }
    }

    console.log("Weekly outlook complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Weekly outlook cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

async function generateWeeklyOutlookForUser(userId: string) {
  const supabase = getSupabase();
  
  // Build context (pass supabase client for cron context — no cookies available)
  const context = await buildCoachContext(userId, supabase);

  // Get last week's workouts (completed only for accurate stats)
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const today = new Date().toISOString().split("T")[0];
  
  const { data: lastWeekWorkouts } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", lastWeekStart.toISOString().split("T")[0])
    .lt("scheduled_date", today)
    .order("scheduled_date", { ascending: true });

  // Get this week's plan
  const thisWeekEnd = new Date();
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  
  const { data: thisWeekWorkouts } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", today)
    .lte("scheduled_date", thisWeekEnd.toISOString().split("T")[0])
    .order("scheduled_date", { ascending: true });

  // Get active plan for phase/target info
  const { data: activePlan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  // Get user profile for race/goal info
  const { data: profile } = await supabase
    .from("profiles")
    .select("goal_race_date, goal_race_type, goal_time, weekly_hours_available, primary_sport")
    .eq("id", userId)
    .single();

  // Calculate per-sport breakdown from completed workouts
  const sportBreakdown = calculateSportBreakdown(lastWeekWorkouts || []);

  // Calculate days to race
  const daysToRace = profile?.goal_race_date 
    ? Math.ceil((new Date(profile.goal_race_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate compliance
  const totalPlanned = (lastWeekWorkouts || []).length;
  const completed = (lastWeekWorkouts || []).filter(w => w.status === "completed").length;

  // Enrich data for AI
  const enrichedData = {
    lastWeek: lastWeekWorkouts || [],
    thisWeek: thisWeekWorkouts || [],
    sportBreakdown,
    plan: activePlan ? {
      current_phase: activePlan.plan_config?.current_phase || activePlan.current_phase,
      total_weeks: activePlan.total_weeks,
      current_week: activePlan.current_week,
      weekly_hours_target: profile?.weekly_hours_available || 10,
    } : null,
    race: profile ? {
      type: profile.goal_race_type,
      date: profile.goal_race_date,
      days_away: daysToRace,
      goal_time: profile.goal_time,
      sport: profile.primary_sport,
    } : null,
    compliance: {
      total_planned: totalPlanned,
      completed,
      percentage: totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0,
    },
    today: today,
  };

  // Generate outlook with enriched data
  const outlook = await generateWeeklyOutlook(
    context,
    enrichedData.lastWeek,
    enrichedData.thisWeek,
    enrichedData
  );

  // Store as chat message
  await supabase.from("chat_messages").insert({
    user_id: userId,
    role: "assistant",
    content: outlook,
    message_type: "weekly_outlook",
    metadata: { 
      week_of: today,
      sport_breakdown: sportBreakdown,
      compliance: enrichedData.compliance,
      days_to_race: daysToRace,
    },
  });

  console.log(`Generated weekly outlook for user ${userId}`);
}

interface SportStats {
  sessions: number;
  distance_miles: number;
  duration_hours: number;
}

function calculateSportBreakdown(workouts: Array<Record<string, unknown>>): Record<string, SportStats> {
  const breakdown: Record<string, SportStats> = {
    swim: { sessions: 0, distance_miles: 0, duration_hours: 0 },
    bike: { sessions: 0, distance_miles: 0, duration_hours: 0 },
    run: { sessions: 0, distance_miles: 0, duration_hours: 0 },
  };

  for (const w of workouts) {
    if (w.status !== "completed") continue;
    const sport = (w.workout_type as string) || "run";
    
    // Handle brick workouts — split 60/40 bike/run
    if (sport === "brick") {
      const durHrs = ((w.actual_duration_minutes as number) || (w.duration_minutes as number) || 0) / 60;
      const distM = ((w.actual_distance_meters as number) || (w.distance_meters as number) || 0) / 1609.34;
      breakdown.bike.sessions++;
      breakdown.bike.duration_hours += durHrs * 0.6;
      breakdown.bike.distance_miles += distM * 0.6;
      breakdown.run.sessions++;
      breakdown.run.duration_hours += durHrs * 0.4;
      breakdown.run.distance_miles += distM * 0.4;
      continue;
    }

    if (!breakdown[sport]) {
      breakdown[sport] = { sessions: 0, distance_miles: 0, duration_hours: 0 };
    }

    breakdown[sport].sessions++;
    breakdown[sport].duration_hours += ((w.actual_duration_minutes as number) || (w.duration_minutes as number) || 0) / 60;
    breakdown[sport].distance_miles += ((w.actual_distance_meters as number) || (w.distance_meters as number) || 0) / 1609.34;
  }

  // Round values
  for (const sport of Object.keys(breakdown)) {
    breakdown[sport].distance_miles = Math.round(breakdown[sport].distance_miles * 10) / 10;
    breakdown[sport].duration_hours = Math.round(breakdown[sport].duration_hours * 10) / 10;
  }

  return breakdown;
}

// Also allow GET for testing (with auth)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return POST(req);
}
