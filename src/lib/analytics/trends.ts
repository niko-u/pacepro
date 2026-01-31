/**
 * Trend Tracker
 *
 * Tracks metrics over time for fitness trend analysis, PR detection,
 * and zone update recommendations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy init service-role client
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrainingLoadSnapshot {
  date: string;
  dailyTss: number;
  atl: number;  // Acute Training Load (7-day exponential)
  ctl: number;  // Chronic Training Load (42-day exponential)
  tsb: number;  // Training Stress Balance (form)
}

export interface FitnessTrend {
  ctlTrend: "increasing" | "stable" | "decreasing";
  atlTrend: "increasing" | "stable" | "decreasing";
  form: "fresh" | "neutral" | "fatigued" | "very_fatigued";
  tsbValue: number;
  ctlValue: number;
  atlValue: number;
  weeklyVolumeTrend: "increasing" | "stable" | "decreasing";
}

export interface WeeklyStats {
  weekStart: string;
  totalTss: number;
  totalDuration: number;  // minutes
  totalDistance: number;   // meters
  workoutCount: number;
  avgEfficiencyFactor: number | null;
  avgIntensityFactor: number | null;
}

// ─── Training Load (ATL / CTL / TSB) ─────────────────────────────────────────

const ATL_DECAY = 7;   // 7-day time constant
const CTL_DECAY = 42;  // 42-day time constant

/**
 * Update the training_load table after a new workout.
 * Uses exponentially weighted moving average for ATL and CTL.
 */
export async function updateTrainingLoad(
  userId: string,
  date: string,
  tss: number,
  supabaseOverride?: SupabaseClient
): Promise<TrainingLoadSnapshot> {
  const supabase = supabaseOverride || getSupabase();

  // Get yesterday's training load for carry-forward
  const yesterday = addDays(date, -1);
  const { data: prevLoad } = await supabase
    .from("training_load")
    .select("atl, ctl")
    .eq("user_id", userId)
    .eq("date", yesterday)
    .maybeSingle();

  const prevAtl = prevLoad?.atl ?? 0;
  const prevCtl = prevLoad?.ctl ?? 0;

  // Exponentially weighted moving average
  const atlDecay = Math.exp(-1 / ATL_DECAY);
  const ctlDecay = Math.exp(-1 / CTL_DECAY);

  const newAtl = round2(prevAtl * atlDecay + tss * (1 - atlDecay));
  const newCtl = round2(prevCtl * ctlDecay + tss * (1 - ctlDecay));
  const newTsb = round2(newCtl - newAtl);

  // Check if there's already an entry for today — add TSS
  const { data: existingLoad } = await supabase
    .from("training_load")
    .select("daily_tss")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const totalDailyTss = (existingLoad?.daily_tss ?? 0) + tss;

  // Recalculate with total daily TSS
  const finalAtl = round2(prevAtl * atlDecay + totalDailyTss * (1 - atlDecay));
  const finalCtl = round2(prevCtl * ctlDecay + totalDailyTss * (1 - ctlDecay));
  const finalTsb = round2(finalCtl - finalAtl);

  // Upsert training load
  await supabase
    .from("training_load")
    .upsert(
      {
        user_id: userId,
        date,
        daily_tss: round2(totalDailyTss),
        atl: finalAtl,
        ctl: finalCtl,
        tsb: finalTsb,
      },
      { onConflict: "user_id,date" }
    );

  return {
    date,
    dailyTss: round2(totalDailyTss),
    atl: finalAtl,
    ctl: finalCtl,
    tsb: finalTsb,
  };
}

/**
 * Get recent training load data for trend analysis.
 */
export async function getTrainingLoadHistory(
  userId: string,
  days: number = 42,
  supabaseOverride?: SupabaseClient
): Promise<TrainingLoadSnapshot[]> {
  const supabase = supabaseOverride || getSupabase();
  const startDate = addDays(new Date().toISOString().split("T")[0], -days);

  const { data } = await supabase
    .from("training_load")
    .select("date, daily_tss, atl, ctl, tsb")
    .eq("user_id", userId)
    .gte("date", startDate)
    .order("date", { ascending: true });

  return (data || []).map((row) => ({
    date: row.date,
    dailyTss: Number(row.daily_tss) || 0,
    atl: Number(row.atl) || 0,
    ctl: Number(row.ctl) || 0,
    tsb: Number(row.tsb) || 0,
  }));
}

/**
 * Analyze fitness trends from training load history.
 */
export function analyzeFitnessTrend(history: TrainingLoadSnapshot[]): FitnessTrend {
  const defaultTrend: FitnessTrend = {
    ctlTrend: "stable",
    atlTrend: "stable",
    form: "neutral",
    tsbValue: 0,
    ctlValue: 0,
    atlValue: 0,
    weeklyVolumeTrend: "stable",
  };

  if (history.length < 7) return defaultTrend;

  const latest = history[history.length - 1];
  const weekAgo = history.length >= 8 ? history[history.length - 8] : history[0];

  // CTL trend
  const ctlChange = latest.ctl - weekAgo.ctl;
  const ctlTrend = ctlChange > 2 ? "increasing" : ctlChange < -2 ? "decreasing" : "stable";

  // ATL trend
  const atlChange = latest.atl - weekAgo.atl;
  const atlTrend = atlChange > 3 ? "increasing" : atlChange < -3 ? "decreasing" : "stable";

  // Form (TSB)
  let form: FitnessTrend["form"];
  if (latest.tsb > 15) form = "fresh";
  else if (latest.tsb > -10) form = "neutral";
  else if (latest.tsb > -30) form = "fatigued";
  else form = "very_fatigued";

  // Weekly volume trend: compare last 7 days TSS to prior 7 days
  const recentWeek = history.slice(-7);
  const priorWeek = history.slice(-14, -7);
  const recentTss = recentWeek.reduce((s, d) => s + d.dailyTss, 0);
  const priorTss = priorWeek.reduce((s, d) => s + d.dailyTss, 0);
  const volumeChange = priorTss > 0 ? ((recentTss - priorTss) / priorTss) * 100 : 0;
  const weeklyVolumeTrend = volumeChange > 10 ? "increasing" : volumeChange < -10 ? "decreasing" : "stable";

  return {
    ctlTrend,
    atlTrend,
    form,
    tsbValue: latest.tsb,
    ctlValue: latest.ctl,
    atlValue: latest.atl,
    weeklyVolumeTrend,
  };
}

// ─── Weekly / Monthly Aggregates ──────────────────────────────────────────────

/**
 * Get weekly training stats over a period.
 */
export async function getWeeklyStats(
  userId: string,
  weeks: number = 4,
  supabaseOverride?: SupabaseClient
): Promise<WeeklyStats[]> {
  const supabase = supabaseOverride || getSupabase();
  const startDate = addDays(
    new Date().toISOString().split("T")[0],
    -weeks * 7
  );

  const { data: workouts } = await supabase
    .from("workouts")
    .select("scheduled_date, actual_duration_minutes, actual_distance_meters, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("scheduled_date", startDate)
    .order("scheduled_date", { ascending: true });

  const { data: analytics } = await supabase
    .from("workout_analytics")
    .select("workout_id, training_stress_score, efficiency_factor, intensity_factor")
    .eq("user_id", userId)
    .not("training_stress_score", "is", null);

  // Build analytics lookup by workout_id
  const analyticsMap = new Map<string, { tss: number; ef: number | null; if_val: number | null }>();
  if (analytics) {
    for (const a of analytics) {
      analyticsMap.set(a.workout_id, {
        tss: Number(a.training_stress_score) || 0,
        ef: a.efficiency_factor ? Number(a.efficiency_factor) : null,
        if_val: a.intensity_factor ? Number(a.intensity_factor) : null,
      });
    }
  }

  // Group by week
  const weekMap = new Map<string, WeeklyStats>();
  for (const w of workouts || []) {
    const weekStart = getMonday(w.scheduled_date);
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, {
        weekStart,
        totalTss: 0,
        totalDuration: 0,
        totalDistance: 0,
        workoutCount: 0,
        avgEfficiencyFactor: null,
        avgIntensityFactor: null,
      });
    }
    const stats = weekMap.get(weekStart)!;
    stats.totalDuration += w.actual_duration_minutes || 0;
    stats.totalDistance += w.actual_distance_meters || 0;
    stats.workoutCount++;
  }

  return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─── Efficiency Factor Trend ──────────────────────────────────────────────────

/**
 * Get rolling efficiency factor for a specific workout type.
 * Improving EF over time = getting fitter.
 */
export async function getEfficiencyFactorTrend(
  userId: string,
  workoutType: string,
  weeks: number = 8,
  supabaseOverride?: SupabaseClient
): Promise<Array<{ date: string; ef: number }>> {
  const supabase = supabaseOverride || getSupabase();
  const startDate = addDays(new Date().toISOString().split("T")[0], -weeks * 7);

  // Join workouts with analytics
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, scheduled_date")
    .eq("user_id", userId)
    .eq("workout_type", workoutType)
    .eq("status", "completed")
    .gte("scheduled_date", startDate)
    .order("scheduled_date", { ascending: true });

  if (!workouts || workouts.length === 0) return [];

  const workoutIds = workouts.map((w) => w.id);
  const { data: analytics } = await supabase
    .from("workout_analytics")
    .select("workout_id, efficiency_factor")
    .in("workout_id", workoutIds)
    .not("efficiency_factor", "is", null);

  const efMap = new Map<string, number>();
  for (const a of analytics || []) {
    efMap.set(a.workout_id, Number(a.efficiency_factor));
  }

  return workouts
    .filter((w) => efMap.has(w.id))
    .map((w) => ({
      date: w.scheduled_date,
      ef: efMap.get(w.id)!,
    }));
}

// ─── PR Detection ─────────────────────────────────────────────────────────────

export interface PersonalRecord {
  type: string;        // "best_20min_power", "best_5k_pace", etc.
  value: number;
  date: string;
  isPR: boolean;
  previousBest: number | null;
}

/**
 * Check for power PRs from a cycling workout.
 * Returns detected PRs if the best efforts exceed previous bests.
 */
export async function checkPowerPRs(
  userId: string,
  workoutDate: string,
  bestEfforts: { duration: number; power: number }[],
  supabaseOverride?: SupabaseClient
): Promise<PersonalRecord[]> {
  const supabase = supabaseOverride || getSupabase();
  const prs: PersonalRecord[] = [];

  // Get previous best efforts from workout_analytics
  const { data: prevAnalytics } = await supabase
    .from("workout_analytics")
    .select("normalized_power, training_stress_score")
    .eq("user_id", userId)
    .not("normalized_power", "is", null)
    .order("normalized_power", { ascending: false })
    .limit(1);

  for (const effort of bestEfforts) {
    const durationLabel = effort.duration >= 3600
      ? `${Math.round(effort.duration / 3600)}h`
      : effort.duration >= 60
        ? `${Math.round(effort.duration / 60)}min`
        : `${effort.duration}s`;

    const prType = `best_${durationLabel}_power`;

    // For simplicity, we compare against the best NP we've seen
    // A full implementation would track individual duration bests
    const prevBest = prevAnalytics?.[0]?.normalized_power
      ? Number(prevAnalytics[0].normalized_power)
      : null;

    prs.push({
      type: prType,
      value: effort.power,
      date: workoutDate,
      isPR: !prevBest || effort.power > prevBest,
      previousBest: prevBest,
    });
  }

  return prs.filter((pr) => pr.isPR);
}

// ─── Recovery Trend (WHOOP Integration) ──────────────────────────────────────

export interface RecoveryTrend {
  avgHrv7d: number | null;
  avgHrv30d: number | null;
  hrvTrend: "improving" | "stable" | "declining";
  avgRestingHr7d: number | null;
  avgRestingHr30d: number | null;
  restingHrTrend: "improving" | "stable" | "worsening";
}

/**
 * Analyze recovery trends from WHOOP/recovery data.
 */
export async function getRecoveryTrend(
  userId: string,
  supabaseOverride?: SupabaseClient
): Promise<RecoveryTrend> {
  const supabase = supabaseOverride || getSupabase();

  const { data: recentRecovery } = await supabase
    .from("recovery_data")
    .select("date, hrv_ms, resting_hr")
    .eq("user_id", userId)
    .gte("date", addDays(new Date().toISOString().split("T")[0], -30))
    .order("date", { ascending: false });

  const result: RecoveryTrend = {
    avgHrv7d: null,
    avgHrv30d: null,
    hrvTrend: "stable",
    avgRestingHr7d: null,
    avgRestingHr30d: null,
    restingHrTrend: "stable",
  };

  if (!recentRecovery || recentRecovery.length === 0) return result;

  const last7 = recentRecovery.slice(0, 7);
  const all30 = recentRecovery;

  // HRV
  const hrv7 = last7.filter((r) => r.hrv_ms != null).map((r) => Number(r.hrv_ms));
  const hrv30 = all30.filter((r) => r.hrv_ms != null).map((r) => Number(r.hrv_ms));

  if (hrv7.length > 0) {
    result.avgHrv7d = round2(hrv7.reduce((s, v) => s + v, 0) / hrv7.length);
  }
  if (hrv30.length > 0) {
    result.avgHrv30d = round2(hrv30.reduce((s, v) => s + v, 0) / hrv30.length);
  }

  if (result.avgHrv7d && result.avgHrv30d) {
    const change = ((result.avgHrv7d - result.avgHrv30d) / result.avgHrv30d) * 100;
    result.hrvTrend = change > 5 ? "improving" : change < -5 ? "declining" : "stable";
  }

  // Resting HR
  const rhr7 = last7.filter((r) => r.resting_hr != null).map((r) => Number(r.resting_hr));
  const rhr30 = all30.filter((r) => r.resting_hr != null).map((r) => Number(r.resting_hr));

  if (rhr7.length > 0) {
    result.avgRestingHr7d = round2(rhr7.reduce((s, v) => s + v, 0) / rhr7.length);
  }
  if (rhr30.length > 0) {
    result.avgRestingHr30d = round2(rhr30.reduce((s, v) => s + v, 0) / rhr30.length);
  }

  if (result.avgRestingHr7d && result.avgRestingHr30d) {
    const change = ((result.avgRestingHr7d - result.avgRestingHr30d) / result.avgRestingHr30d) * 100;
    // Lower resting HR = better, so positive change is worsening
    result.restingHrTrend = change < -3 ? "improving" : change > 3 ? "worsening" : "stable";
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
