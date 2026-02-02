/**
 * Auto Zone Detection
 *
 * Detects zone breakthroughs (FTP changes, LTHR shifts, CSS improvements)
 * from workout data and auto-updates user profiles when confident.
 *
 * Conservative approach: requires 2-3 confirming workouts before updating.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StravaStream, hasPowerData } from "./strava-streams";
import { bestPowerForDuration } from "./engine";

// Lazy init
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

export interface ZoneBreakthrough {
  type: "ftp" | "lthr" | "run_threshold" | "swim_css";
  currentValue: number;
  detectedValue: number;
  changePercent: number;
  confidence: "low" | "medium" | "high";
  confirmingWorkouts: number;
  message: string;
  autoUpdated: boolean;
}

interface BreakthroughCandidate {
  user_id: string;
  type: string;
  detected_value: number;
  detected_at: string;
  workout_id: string;
}

// ─── FTP Detection (Cycling) ──────────────────────────────────────────────────

const MIN_FTP_INCREASE_PCT = 3;   // Minimum 3% increase to consider
const CONFIRMATION_COUNT = 2;      // Need 2+ confirming workouts
const LOOKBACK_DAYS = 30;          // Look at last 30 days for confirmation

/**
 * Check if a cycling workout contains a potential FTP breakthrough.
 *
 * Uses best 20-minute power × 0.95 as FTP estimate.
 * Also checks best 60-minute power as secondary signal.
 */
export async function checkFtpBreakthrough(
  userId: string,
  workoutId: string,
  workoutDate: string,
  streams: StravaStream,
  currentFtp: number,
  supabaseOverride?: SupabaseClient
): Promise<ZoneBreakthrough | null> {
  if (!hasPowerData(streams)) return null;

  const supabase = supabaseOverride || getSupabase();

  // Find best 20-minute power
  const best20min = bestPowerForDuration(streams.watts, streams.time, 20 * 60);
  if (!best20min) return null;

  const estimatedFtp = Math.round(best20min * 0.95);

  // Check if this is a meaningful increase
  const changePercent = ((estimatedFtp - currentFtp) / currentFtp) * 100;
  if (changePercent < MIN_FTP_INCREASE_PCT) return null;

  // Check for previous confirming signals in recent workouts
  const confirmCount = await countRecentBreakthroughs(
    supabase,
    userId,
    "ftp",
    estimatedFtp,
    LOOKBACK_DAYS
  );

  // Store this detection
  await storeBreakthroughCandidate(supabase, {
    user_id: userId,
    type: "ftp",
    detected_value: estimatedFtp,
    detected_at: workoutDate,
    workout_id: workoutId,
  });

  const totalConfirming = confirmCount + 1;
  let confidence: "low" | "medium" | "high";
  let autoUpdated = false;

  if (totalConfirming >= 3) {
    confidence = "high";
    // Auto-update FTP
    await updateUserFtp(supabase, userId, estimatedFtp);
    autoUpdated = true;
  } else if (totalConfirming >= 2) {
    confidence = "medium";
    // Auto-update on medium confidence too
    await updateUserFtp(supabase, userId, estimatedFtp);
    autoUpdated = true;
  } else {
    confidence = "low";
  }

  const message = autoUpdated
    ? `🔥 FTP Breakthrough detected! Your estimated FTP has increased from ${currentFtp}W to ${estimatedFtp}W (+${round2(changePercent)}%). I've updated your power zones automatically. Your next cycling workouts will reflect the new targets.`
    : `📈 Strong cycling effort! Your best 20-minute power suggests an FTP of ~${estimatedFtp}W (current: ${currentFtp}W). One more confirming workout and I'll update your zones automatically.`;

  return {
    type: "ftp",
    currentValue: currentFtp,
    detectedValue: estimatedFtp,
    changePercent: round2(changePercent),
    confidence,
    confirmingWorkouts: totalConfirming,
    message,
    autoUpdated,
  };
}

// ─── Running Threshold Detection ──────────────────────────────────────────────

/**
 * After hard running efforts (races, tempo runs), estimate threshold pace
 * and LTHR to see if zones need updating.
 */
export async function checkRunningThresholdBreakthrough(
  userId: string,
  workoutId: string,
  workoutDate: string,
  streams: StravaStream,
  activity: {
    distance: number;
    moving_time: number;
    average_heartrate?: number;
    type?: string;
    workout_type?: string;
  },
  currentEasyPace: number,
  supabaseOverride?: SupabaseClient
): Promise<ZoneBreakthrough | null> {
  const supabase = supabaseOverride || getSupabase();

  // Only analyze race efforts or hard tempo runs (distance > 3km, moderate+ effort)
  if (activity.distance < 3000) return null;

  // Average pace in sec/km
  const avgPace = activity.moving_time / (activity.distance / 1000);

  // For race efforts: estimate threshold pace
  // Race pace for 5K ≈ threshold pace
  // Race pace for 10K ≈ 1.03x threshold pace
  // Race pace for HM ≈ 1.08x threshold pace
  let thresholdEstimate: number;
  const distKm = activity.distance / 1000;

  if (distKm <= 6) {
    thresholdEstimate = avgPace; // ~5K race pace ≈ threshold
  } else if (distKm <= 12) {
    thresholdEstimate = avgPace * 0.97; // 10K pace → threshold
  } else if (distKm <= 25) {
    thresholdEstimate = avgPace * 0.93; // HM pace → threshold
  } else {
    thresholdEstimate = avgPace * 0.88; // Marathon pace → threshold
  }

  // Derive easy pace from threshold (easy ≈ threshold / 0.82)
  const estimatedEasyPace = Math.round(thresholdEstimate / 0.82);

  // Check if this is a meaningful improvement (faster pace = lower number)
  const changePercent = ((currentEasyPace - estimatedEasyPace) / currentEasyPace) * 100;
  if (changePercent < 2) return null; // Need at least 2% improvement

  const confirmCount = await countRecentBreakthroughs(
    supabase,
    userId,
    "run_threshold",
    estimatedEasyPace,
    LOOKBACK_DAYS
  );

  await storeBreakthroughCandidate(supabase, {
    user_id: userId,
    type: "run_threshold",
    detected_value: estimatedEasyPace,
    detected_at: workoutDate,
    workout_id: workoutId,
  });

  const totalConfirming = confirmCount + 1;
  let confidence: "low" | "medium" | "high";
  let autoUpdated = false;

  if (totalConfirming >= CONFIRMATION_COUNT) {
    confidence = totalConfirming >= 3 ? "high" : "medium";
    await updateUserRunPace(supabase, userId, estimatedEasyPace);
    autoUpdated = true;
  } else {
    confidence = "low";
  }

  const formatPace = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}/km`;
  };

  const message = autoUpdated
    ? `🏃 Running zones updated! Based on your recent performances, your easy pace has been adjusted from ${formatPace(currentEasyPace)} to ${formatPace(estimatedEasyPace)}. You're getting faster! All pace-based workouts will reflect the new targets.`
    : `📊 Nice running effort! Your performance suggests your fitness may be improving. One more confirming workout and I'll update your pace zones.`;

  return {
    type: "run_threshold",
    currentValue: currentEasyPace,
    detectedValue: estimatedEasyPace,
    changePercent: round2(changePercent),
    confidence,
    confirmingWorkouts: totalConfirming,
    message,
    autoUpdated,
  };
}

// ─── Swim CSS Detection ──────────────────────────────────────────────────────

/**
 * After swim workouts, check if CSS (Critical Swim Speed) has improved.
 */
export async function checkSwimCssBreakthrough(
  userId: string,
  workoutId: string,
  workoutDate: string,
  activity: { distance: number; moving_time: number },
  currentCss: number | null,
  supabaseOverride?: SupabaseClient
): Promise<ZoneBreakthrough | null> {
  if (!currentCss || activity.distance < 400) return null;

  const supabase = supabaseOverride || getSupabase();
  const pacePer100m = (activity.moving_time / activity.distance) * 100;

  // CSS should be faster than average workout pace (it's ~threshold effort)
  // If average pace for a structured workout is faster than current CSS, it's a signal
  const changePercent = ((currentCss - pacePer100m) / currentCss) * 100;
  if (changePercent < 2) return null;

  const confirmCount = await countRecentBreakthroughs(
    supabase,
    userId,
    "swim_css",
    pacePer100m,
    LOOKBACK_DAYS
  );

  await storeBreakthroughCandidate(supabase, {
    user_id: userId,
    type: "swim_css",
    detected_value: round2(pacePer100m),
    detected_at: workoutDate,
    workout_id: workoutId,
  });

  const totalConfirming = confirmCount + 1;
  let confidence: "low" | "medium" | "high";
  let autoUpdated = false;

  if (totalConfirming >= CONFIRMATION_COUNT) {
    confidence = totalConfirming >= 3 ? "high" : "medium";
    await updateUserSwimPace(supabase, userId, Math.round(pacePer100m));
    autoUpdated = true;
  } else {
    confidence = "low";
  }

  const formatSwim = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}/100m`;
  };

  const message = autoUpdated
    ? `🏊 Swim zones updated! Your CSS has improved from ${formatSwim(currentCss)} to ${formatSwim(pacePer100m)}. Swim workouts will be adjusted.`
    : `🏊 Strong swim! Your pace suggests improving CSS. One more confirming workout and I'll update your swim zones.`;

  return {
    type: "swim_css",
    currentValue: currentCss,
    detectedValue: round2(pacePer100m),
    changePercent: round2(changePercent),
    confidence,
    confirmingWorkouts: totalConfirming,
    message,
    autoUpdated,
  };
}

// ─── Database Helpers ─────────────────────────────────────────────────────────

/**
 * Count recent breakthrough detections of similar value.
 * Used to confirm patterns across multiple workouts.
 */
async function countRecentBreakthroughs(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  detectedValue: number,
  lookbackDays: number
): Promise<number> {
  const startDate = addDays(new Date().toISOString().split("T")[0], -lookbackDays);

  // Query workout_analytics for rows where zone_compliance_details contains
  // breakthrough data matching the given type within the lookback window
  const { data } = await supabase
    .from("workout_analytics")
    .select("id, zone_compliance_details")
    .eq("user_id", userId)
    .gte("created_at", startDate + "T00:00:00Z");

  if (!data || data.length === 0) return 0;

  // Count rows that have a stored breakthrough of the matching type
  let count = 0;
  for (const row of data) {
    const details = row.zone_compliance_details as Record<string, unknown> | null;
    if (details?.breakthrough) {
      const bt = details.breakthrough as { type?: string; value?: number };
      if (bt.type === type) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Store a breakthrough candidate for future confirmation.
 * Uses the workout_analytics table's zone_compliance_details JSONB field.
 */
async function storeBreakthroughCandidate(
  supabase: SupabaseClient,
  candidate: BreakthroughCandidate
): Promise<void> {
  // We track breakthroughs by updating the workout's analytics with breakthrough info
  try {
    const { data: existing } = await supabase
      .from("workout_analytics")
      .select("id, zone_compliance_details")
      .eq("workout_id", candidate.workout_id)
      .maybeSingle();

    if (existing) {
      const details = (existing.zone_compliance_details || {}) as Record<string, unknown>;
      details.breakthrough = {
        type: candidate.type,
        value: candidate.detected_value,
        detected_at: candidate.detected_at,
      };

      await supabase
        .from("workout_analytics")
        .update({ zone_compliance_details: details })
        .eq("id", existing.id);
    }
  } catch (error) {
    console.error("Failed to store breakthrough candidate:", error);
  }
}

/**
 * Update user's FTP in profile and plan_config.
 */
async function updateUserFtp(
  supabase: SupabaseClient,
  userId: string,
  newFtp: number
): Promise<void> {
  // Update profile
  await supabase
    .from("profiles")
    .update({ bike_ftp: newFtp })
    .eq("id", userId);

  // Update active plan's power zones
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (plan?.plan_config) {
    const config = plan.plan_config as Record<string, unknown>;
    config.bikePowerZones = {
      z1: { min: 0, max: Math.round(newFtp * 0.55) },
      z2: { min: Math.round(newFtp * 0.56), max: Math.round(newFtp * 0.75) },
      z3: { min: Math.round(newFtp * 0.76), max: Math.round(newFtp * 0.9) },
      z4: { min: Math.round(newFtp * 0.91), max: Math.round(newFtp * 1.05) },
      z5: { min: Math.round(newFtp * 1.06), max: Math.round(newFtp * 1.2) },
    };

    await supabase
      .from("training_plans")
      .update({ plan_config: config })
      .eq("id", plan.id);
  }

  console.log(`Updated FTP to ${newFtp}W for user ${userId}`);
}

/**
 * Update user's run pace in profile and plan_config.
 */
async function updateUserRunPace(
  supabase: SupabaseClient,
  userId: string,
  newEasyPace: number
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ run_pace_per_km: newEasyPace })
    .eq("id", userId);

  // Update active plan's pace zones
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (plan?.plan_config) {
    const config = plan.plan_config as Record<string, unknown>;
    config.runPaceZones = {
      easy: { min: newEasyPace, max: Math.round(newEasyPace * 1.15) },
      moderate: { min: Math.round(newEasyPace * 0.9), max: newEasyPace },
      tempo: { min: Math.round(newEasyPace * 0.82), max: Math.round(newEasyPace * 0.88) },
      threshold: { min: Math.round(newEasyPace * 0.78), max: Math.round(newEasyPace * 0.82) },
      interval: { min: Math.round(newEasyPace * 0.72), max: Math.round(newEasyPace * 0.78) },
      longRun: { min: newEasyPace, max: Math.round(newEasyPace * 1.1) },
    };

    await supabase
      .from("training_plans")
      .update({ plan_config: config })
      .eq("id", plan.id);
  }

  console.log(`Updated run easy pace to ${newEasyPace}s/km for user ${userId}`);
}

/**
 * Update user's swim CSS in profile.
 */
async function updateUserSwimPace(
  supabase: SupabaseClient,
  userId: string,
  newCss: number
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ swim_pace_per_100m: newCss })
    .eq("id", userId);

  console.log(`Updated swim CSS to ${newCss}s/100m for user ${userId}`);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run all zone detection checks after a workout.
 * Returns any detected breakthroughs.
 */
export async function detectZoneBreakthroughs(
  userId: string,
  workoutId: string,
  workoutDate: string,
  workoutType: string,
  streams: StravaStream | null,
  activity: Record<string, unknown>,
  profile: {
    bike_ftp?: number | null;
    run_pace_per_km?: number | null;
    swim_pace_per_100m?: number | null;
    experience_level?: string | null;
  },
  supabaseOverride?: SupabaseClient
): Promise<ZoneBreakthrough[]> {
  const breakthroughs: ZoneBreakthrough[] = [];

  try {
    // Cycling FTP check
    if (workoutType === "bike" && streams && hasPowerData(streams)) {
      const currentFtp = profile.bike_ftp || getDefaultFtp(profile.experience_level);
      const ftpResult = await checkFtpBreakthrough(
        userId,
        workoutId,
        workoutDate,
        streams,
        currentFtp,
        supabaseOverride
      );
      if (ftpResult) breakthroughs.push(ftpResult);
    }

    // Running threshold check (only for harder efforts)
    if (workoutType === "run" && streams) {
      const actDist = (activity.distance as number) || 0;
      const actTime = (activity.moving_time as number) || 0;
      if (actDist > 3000 && actTime > 0) {
        const avgPace = actTime / (actDist / 1000);
        const currentEasyPace = profile.run_pace_per_km || getDefaultEasyPace(profile.experience_level);
        const thresholdPace = currentEasyPace * 0.82;

        // Only check if pace was at or faster than threshold
        if (avgPace <= thresholdPace * 1.05) {
          const runResult = await checkRunningThresholdBreakthrough(
            userId,
            workoutId,
            workoutDate,
            streams,
            {
              distance: actDist,
              moving_time: actTime,
              average_heartrate: activity.average_heartrate as number | undefined,
            },
            currentEasyPace,
            supabaseOverride
          );
          if (runResult) breakthroughs.push(runResult);
        }
      }
    }

    // Swim CSS check
    if (workoutType === "swim") {
      const actDist = (activity.distance as number) || 0;
      const actTime = (activity.moving_time as number) || 0;
      if (actDist >= 400) {
        const cssResult = await checkSwimCssBreakthrough(
          userId,
          workoutId,
          workoutDate,
          { distance: actDist, moving_time: actTime },
          profile.swim_pace_per_100m || null,
          supabaseOverride
        );
        if (cssResult) breakthroughs.push(cssResult);
      }
    }
  } catch (error) {
    console.error("Zone detection error:", error);
  }

  return breakthroughs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultFtp(experience: string | null | undefined): number {
  const defaults: Record<string, number> = {
    beginner: 150,
    intermediate: 220,
    advanced: 280,
    elite: 340,
  };
  return defaults[experience || "intermediate"] || 220;
}

function getDefaultEasyPace(experience: string | null | undefined): number {
  const defaults: Record<string, number> = {
    beginner: 373,
    intermediate: 317,
    advanced: 280,
    elite: 255,
  };
  return defaults[experience || "intermediate"] || 317;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
