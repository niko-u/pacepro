import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getTrainingLoadHistory, analyzeFitnessTrend } from "@/lib/analytics/trends";
import type { FitnessTrend } from "@/lib/analytics/trends";

export interface AthleteProfile {
  id: string;
  email: string;
  full_name: string;
  experience_level: string;
  primary_sport?: string;
  goal_race_type: string;
  goal_race_date: string;
  weekly_hours_available: number;
  preferences: {
    workout_likes: string[];
    workout_dislikes: string[];
    push_tolerance: number;
    recovery_needs: number;
    flexibility: number;
    feedback_style: string;
    response_length?: string;
    focus_areas?: string[];
    [key: string]: unknown;
  };
  learned_preferences: {
    schedule_constraints: string[];
    recovery_notes: string[];
    limitations: string[];
    life_context: string[];
  };
  notifications: Record<string, boolean>;
  conversation_summary?: string;
  timezone?: string;
}

export interface Workout {
  id: string;
  scheduled_date: string;
  workout_type: string;
  title: string;
  description: string;
  duration_minutes: number;
  distance_meters: number;
  status: string;
  actual_duration_minutes?: number;
  actual_distance_meters?: number;
  actual_data?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  coach_notes?: string;
}

export interface RecoverySnapshot {
  date: string;
  source: string;
  recovery_score: number;
  hrv_ms: number;
  resting_hr: number;
  sleep_hours: number;
  sleep_quality: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_type: string;
  created_at: string;
}

export interface TrainingPlan {
  id: string;
  name: string;
  goal_race_date: string;
  goal_race_type: string;
  current_phase: string;
  current_week: number;
  total_weeks: number;
  status: string;
}

export interface TrainingLoadContext extends FitnessTrend {}

export interface CoachContext {
  athlete: AthleteProfile;
  plan: TrainingPlan | null;
  todayWorkout: Workout | null;
  recentWorkouts: Workout[];
  upcomingWorkouts: Workout[];
  recovery: RecoverySnapshot[];
  conversation: ChatMessage[];
  trainingLoad: TrainingLoadContext | null;
  stats: {
    completionRate: number;
    weeklyVolume: number;
    daysUntilRace: number;
  };
}

/**
 * Build full context for AI coach to understand the athlete.
 * Accepts an optional Supabase client for use in cron jobs / server contexts
 * where cookie-based auth is not available.
 */
export async function buildCoachContext(
  userId: string,
  externalSupabase?: SupabaseClient
): Promise<CoachContext> {
  const supabase = externalSupabase || (await createClient());
  const today = new Date().toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    { data: profile },
    { data: plan },
    { data: workouts },
    { data: recovery },
    { data: messages },
  ] = await Promise.all([
    // Profile
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single(),

    // Current training plan
    supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single(),

    // Workouts (last 14 days + next 7 days)
    supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .gte("scheduled_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .lte("scheduled_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("scheduled_date", { ascending: true }),

    // Recovery data (last 7 days)
    supabase
      .from("recovery_data")
      .select("*")
      .eq("user_id", userId)
      .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("date", { ascending: false }),

    // Recent chat messages
    supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Guard against missing profile
  if (!profile) {
    throw new Error(`Profile not found for user ${userId}`);
  }

  // Split workouts
  const todayWorkout = workouts?.find((w) => w.scheduled_date === today) || null;
  const recentWorkouts = workouts?.filter((w) => w.scheduled_date < today) || [];
  const upcomingWorkouts = workouts?.filter((w) => w.scheduled_date > today) || [];

  // Calculate stats
  const completedCount = recentWorkouts.filter((w) => w.status === "completed").length;
  const completionRate = recentWorkouts.length > 0 
    ? Math.round((completedCount / recentWorkouts.length) * 100) 
    : 100;

  const weeklyVolume = recentWorkouts
    .filter((w) => w.status === "completed" && w.actual_duration_minutes)
    .reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0);

  const daysUntilRace = plan?.goal_race_date 
    ? Math.ceil((new Date(plan.goal_race_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  // Fetch training load for fitness trend context
  let trainingLoad: TrainingLoadContext | null = null;
  try {
    const loadHistory = await getTrainingLoadHistory(userId, 42, supabase);
    if (loadHistory.length > 0) {
      trainingLoad = analyzeFitnessTrend(loadHistory);
    }
  } catch (loadError) {
    console.warn("Failed to fetch training load:", loadError);
  }

  return {
    athlete: profile as AthleteProfile,
    plan: plan as TrainingPlan | null,
    todayWorkout: todayWorkout as Workout | null,
    recentWorkouts: recentWorkouts as Workout[],
    upcomingWorkouts: upcomingWorkouts as Workout[],
    recovery: (recovery || []) as RecoverySnapshot[],
    conversation: (messages || []).reverse() as ChatMessage[],
    trainingLoad,
    stats: {
      completionRate,
      weeklyVolume,
      daysUntilRace,
    },
  };
}

/**
 * Format context for AI prompt (reduces token usage)
 */
export function formatContextForAI(context: CoachContext): string {
  const { athlete, plan, todayWorkout, recentWorkouts, upcomingWorkouts, recovery, stats } = context;

  const parts: string[] = [];

  // Athlete summary
  parts.push(`ATHLETE: ${athlete.full_name || "Athlete"}`);
  parts.push(`Experience: ${athlete.experience_level || "intermediate"}`);
  parts.push(`Goal: ${athlete.goal_race_type || "race"} on ${athlete.goal_race_date || "TBD"} (${stats.daysUntilRace} days away)`);
  
  if (athlete.preferences) {
    parts.push(`Prefers: ${athlete.preferences.workout_likes?.join(", ") || "no preference"}`);
    parts.push(`Avoids: ${athlete.preferences.workout_dislikes?.join(", ") || "nothing"}`);
    parts.push(`Style: push=${athlete.preferences.push_tolerance}/5, recovery=${athlete.preferences.recovery_needs}/5`);
  }

  // Current plan phase
  if (plan) {
    parts.push(`\nPLAN: Week ${plan.current_week}/${plan.total_weeks}, Phase: ${plan.current_phase || "training"}`);
  }

  // Today's workout
  if (todayWorkout) {
    parts.push(`\nTODAY'S WORKOUT: ${todayWorkout.title} (${todayWorkout.workout_type}, ${todayWorkout.duration_minutes}min)`);
    parts.push(`Status: ${todayWorkout.status}`);
  }

  // Recent performance
  const recentCompleted = recentWorkouts.filter((w) => w.status === "completed").slice(-5);
  if (recentCompleted.length > 0) {
    parts.push(`\nRECENT WORKOUTS (last 5):`);
    recentCompleted.forEach((w) => {
      parts.push(`- ${w.scheduled_date}: ${w.title} (${w.actual_duration_minutes || w.duration_minutes}min)`);
    });
  }

  parts.push(`Completion rate: ${stats.completionRate}%`);
  parts.push(`Weekly volume: ${stats.weeklyVolume} minutes`);

  // Upcoming workouts
  if (upcomingWorkouts.length > 0) {
    parts.push(`\nUPCOMING WORKOUTS (next 7 days):`);
    upcomingWorkouts.forEach((w) => {
      parts.push(`- ${w.scheduled_date}: ${w.title} (${w.workout_type}, ${w.duration_minutes}min)`);
    });
  }

  // Recovery
  const latestRecovery = recovery[0];
  if (latestRecovery) {
    parts.push(`\nRECOVERY (today): Score ${latestRecovery.recovery_score}%, HRV ${latestRecovery.hrv_ms}ms, Sleep ${latestRecovery.sleep_hours}h`);
  }

  // Training load / fitness metrics (from analytics engine)
  if (context.trainingLoad) {
    const tl = context.trainingLoad;
    parts.push(`\nTRAINING LOAD:`);
    parts.push(`  Fitness (CTL): ${tl.ctlValue} ${tl.ctlTrend ? `(${tl.ctlTrend})` : ""}`);
    parts.push(`  Fatigue (ATL): ${tl.atlValue} ${tl.atlTrend ? `(${tl.atlTrend})` : ""}`);
    parts.push(`  Form (TSB): ${tl.tsbValue} ${tl.form ? `(${tl.form})` : ""}`);
    if (tl.weeklyVolumeTrend) {
      parts.push(`  Weekly volume trend: ${tl.weeklyVolumeTrend}`);
    }
  }

  // Life context / constraints
  if (athlete.learned_preferences?.life_context?.length) {
    parts.push(`\nCONTEXT: ${athlete.learned_preferences.life_context.join("; ")}`);
  }
  if (athlete.learned_preferences?.limitations?.length) {
    parts.push(`LIMITATIONS: ${athlete.learned_preferences.limitations.join("; ")}`);
  }

  // Long-term memory (compressed conversation history)
  if (athlete.conversation_summary) {
    parts.push(`\nLONG-TERM MEMORY (previous conversations summary):`);
    parts.push(athlete.conversation_summary);
  }

  return parts.join("\n");
}
