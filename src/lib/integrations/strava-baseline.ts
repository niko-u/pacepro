/**
 * Strava Baseline Analysis
 *
 * Fetches recent activities from Strava and extracts training baselines:
 * - Run easy pace (per km)
 * - Bike FTP estimate
 * - Swim pace per 100m
 * - Weekly training volume
 *
 * Used by both the baseline API endpoint and the post-connect callback.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy init service-role client
let _supabase: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StravaActivity {
  type: string;
  distance: number;        // meters
  moving_time: number;     // seconds
  elapsed_time: number;    // seconds
  average_speed: number;   // m/s
  average_watts?: number;
  weighted_average_watts?: number;
  start_date: string;
}

export interface BaselineResult {
  runPacePerKm: number | null;       // seconds per km
  bikeFtp: number | null;            // watts
  swimPacePer100m: number | null;    // seconds per 100m
  weeklyVolumeHours: number | null;  // average hours per week (last 4 weeks)
  activitiesAnalyzed: number;
  breakdown: {
    runActivities: number;
    rideActivities: number;
    swimActivities: number;
  };
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Get a valid Strava access token, refreshing if expired.
 */
async function getValidStravaToken(
  supabase: SupabaseClient,
  integration: {
    id: string;
    user_id: string;
    access_token: string;
    refresh_token: string;
    token_expires_at: string | number;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Parse token_expires_at — could be ISO string or epoch number
  const expiresAt =
    typeof integration.token_expires_at === "number"
      ? integration.token_expires_at
      : Math.floor(new Date(integration.token_expires_at).getTime() / 1000);

  // If token is still valid (with 60s buffer), return as-is
  if (expiresAt && !isNaN(expiresAt) && expiresAt > now + 60) {
    return integration.access_token;
  }

  console.log(`Strava token expired for user ${integration.user_id}, refreshing...`);

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: integration.refresh_token,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // Persist new tokens
  await supabase
    .from("integrations")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    })
    .eq("id", integration.id);

  return data.access_token;
}

// ─── Activity Fetching ────────────────────────────────────────────────────────

/**
 * Fetch the last N activities from Strava.
 */
async function fetchStravaActivities(
  accessToken: string,
  perPage: number = 30
): Promise<StravaActivity[]> {
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Strava activities fetch failed (${response.status}): ${errText}`);
  }

  return response.json();
}

// ─── Baseline Analysis ────────────────────────────────────────────────────────

const RUN_TYPES = new Set(["Run", "VirtualRun"]);
const RIDE_TYPES = new Set(["Ride", "VirtualRide"]);
const SWIM_TYPES = new Set(["Swim"]);

/**
 * Analyze activities to extract training baselines.
 */
function analyzeActivities(activities: StravaActivity[]): BaselineResult {
  const runs = activities.filter((a) => RUN_TYPES.has(a.type) && a.distance > 500);
  const rides = activities.filter((a) => RIDE_TYPES.has(a.type) && a.distance > 1000);
  const swims = activities.filter((a) => SWIM_TYPES.has(a.type) && a.distance > 100);

  const result: BaselineResult = {
    runPacePerKm: null,
    bikeFtp: null,
    swimPacePer100m: null,
    weeklyVolumeHours: null,
    activitiesAnalyzed: activities.length,
    breakdown: {
      runActivities: runs.length,
      rideActivities: rides.length,
      swimActivities: swims.length,
    },
  };

  // ── Run Pace ────────────────────────────────────────────────────────────
  if (runs.length >= 2) {
    // Calculate pace per km for each run (seconds/km)
    const paces = runs.map((r) => r.moving_time / (r.distance / 1000));

    // Find fastest pace (lowest value = fastest)
    const fastestPace = Math.min(...paces);

    // "Easy" runs: pace > 70% slower than fastest (i.e., pace > fastestPace / 0.7)
    // This filters out interval sessions and races
    const easyThreshold = fastestPace / 0.7;
    const easyPaces = paces.filter((p) => p > easyThreshold);

    if (easyPaces.length >= 1) {
      // Average easy pace
      result.runPacePerKm = Math.round(
        easyPaces.reduce((sum, p) => sum + p, 0) / easyPaces.length
      );
    } else {
      // Fall back to median pace if no "easy" runs identified
      const sorted = [...paces].sort((a, b) => a - b);
      result.runPacePerKm = Math.round(sorted[Math.floor(sorted.length / 2)]);
    }
  } else if (runs.length === 1) {
    // Single run — use its pace directly
    result.runPacePerKm = Math.round(runs[0].moving_time / (runs[0].distance / 1000));
  }

  // ── Bike FTP ────────────────────────────────────────────────────────────
  const ridesWithPower = rides.filter((r) => r.weighted_average_watts || r.average_watts);

  if (ridesWithPower.length >= 1) {
    // Prefer weighted_average_watts (normalized power) for rides >= 20 min
    const longRides = ridesWithPower.filter((r) => r.moving_time >= 20 * 60);

    if (longRides.length >= 1) {
      // Best normalized power from a 20+ minute ride * 0.95
      const bestNP = Math.max(
        ...longRides.map((r) => r.weighted_average_watts || r.average_watts || 0)
      );
      result.bikeFtp = Math.round(bestNP * 0.95);
    } else {
      // Shorter rides — use average power * 0.85 as rough estimate
      const bestAvgPower = Math.max(
        ...ridesWithPower.map((r) => r.average_watts || 0)
      );
      result.bikeFtp = Math.round(bestAvgPower * 0.85);
    }
  }

  // ── Swim Pace ───────────────────────────────────────────────────────────
  if (swims.length >= 1) {
    // Average pace per 100m across swim activities
    const pacePer100 = swims.map((s) => (s.moving_time / s.distance) * 100);
    result.swimPacePer100m = Math.round(
      pacePer100.reduce((sum, p) => sum + p, 0) / pacePer100.length
    );
  }

  // ── Weekly Volume ───────────────────────────────────────────────────────
  if (activities.length > 0) {
    const fourWeeksAgo = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000;
    const recentActivities = activities.filter(
      (a) => new Date(a.start_date).getTime() >= fourWeeksAgo
    );

    if (recentActivities.length > 0) {
      const totalSeconds = recentActivities.reduce((sum, a) => sum + a.moving_time, 0);
      // Average over 4 weeks
      result.weeklyVolumeHours = Math.round((totalSeconds / 3600 / 4) * 10) / 10;
    }
  }

  return result;
}

// ─── Plan Zone Adaptation ─────────────────────────────────────────────────────

/**
 * Calculate run pace zones from easy pace (seconds/km).
 */
function calculateRunPaceZones(easyPacePerKm: number) {
  // Zone ratios relative to easy pace (lower = faster)
  return {
    easy: { min: easyPacePerKm, max: Math.round(easyPacePerKm * 1.15) },
    tempo: {
      min: Math.round(easyPacePerKm * 0.82),
      max: Math.round(easyPacePerKm * 0.88),
    },
    threshold: {
      min: Math.round(easyPacePerKm * 0.76),
      max: Math.round(easyPacePerKm * 0.82),
    },
    vo2max: {
      min: Math.round(easyPacePerKm * 0.68),
      max: Math.round(easyPacePerKm * 0.76),
    },
    sprint: {
      min: Math.round(easyPacePerKm * 0.55),
      max: Math.round(easyPacePerKm * 0.68),
    },
    easyPacePerKm,
  };
}

/**
 * Calculate bike power zones from FTP.
 */
function calculateBikePowerZones(ftp: number) {
  return {
    recovery: { min: 0, max: Math.round(ftp * 0.55) },
    endurance: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75) },
    tempo: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.9) },
    threshold: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
    vo2max: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.2) },
    anaerobic: { min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.5) },
    ftp,
  };
}

/**
 * Update active training plan zones with new baseline data.
 */
async function updatePlanZones(
  supabase: SupabaseClient,
  userId: string,
  baselines: BaselineResult
): Promise<boolean> {
  // Find active training plan
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) return false;

  const config = (plan.plan_config || {}) as Record<string, unknown>;
  let updated = false;

  if (baselines.runPacePerKm) {
    config.runPaceZones = calculateRunPaceZones(baselines.runPacePerKm);
    updated = true;
  }

  if (baselines.bikeFtp) {
    config.bikePowerZones = calculateBikePowerZones(baselines.bikeFtp);
    updated = true;
  }

  if (baselines.swimPacePer100m) {
    config.swimPacePer100m = baselines.swimPacePer100m;
    updated = true;
  }

  if (updated) {
    await supabase
      .from("training_plans")
      .update({ plan_config: config })
      .eq("id", plan.id);

    console.log(`Updated plan zones for user ${userId}`);
  }

  return updated;
}

// ─── Main Baseline Function ───────────────────────────────────────────────────

/**
 * Fetch Strava activities, analyze baselines, update profile and plan zones.
 *
 * This is the reusable core function called by both:
 * - The baseline API endpoint (POST /api/integrations/strava/baseline)
 * - The Strava OAuth callback (fire-and-forget after connect)
 */
export async function fetchAndAnalyzeStravaBaseline(
  userId: string,
  supabaseOverride?: SupabaseClient
): Promise<BaselineResult> {
  const supabase = supabaseOverride || getServiceClient();

  // 1. Get Strava integration tokens
  const { data: integration, error } = await supabase
    .from("integrations")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "strava")
    .single();

  if (error || !integration) {
    throw new Error("No Strava integration found for user");
  }

  // 2. Get a valid access token (refresh if needed)
  const accessToken = await getValidStravaToken(supabase, integration);

  // 3. Fetch last 30 activities
  const activities = await fetchStravaActivities(accessToken, 30);

  // 4. Handle 0 activities gracefully
  if (!activities || activities.length === 0) {
    console.log(`No Strava activities found for user ${userId}`);
    return {
      runPacePerKm: null,
      bikeFtp: null,
      swimPacePer100m: null,
      weeklyVolumeHours: null,
      activitiesAnalyzed: 0,
      breakdown: { runActivities: 0, rideActivities: 0, swimActivities: 0 },
    };
  }

  // 5. Analyze activities for baselines
  const baselines = analyzeActivities(activities);

  // 6. Update profile with extracted baselines (only non-null values)
  const profileUpdate: Record<string, unknown> = {};
  if (baselines.runPacePerKm) profileUpdate.run_pace_per_km = baselines.runPacePerKm;
  if (baselines.bikeFtp) profileUpdate.bike_ftp = baselines.bikeFtp;
  if (baselines.swimPacePer100m) profileUpdate.swim_pace_per_100m = baselines.swimPacePer100m;
  if (baselines.weeklyVolumeHours) profileUpdate.weekly_hours_available = baselines.weeklyVolumeHours;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update profile baselines:", updateError);
    } else {
      console.log(`Updated profile baselines for user ${userId}:`, profileUpdate);
    }
  }

  // 7. Update active training plan zones if applicable
  try {
    await updatePlanZones(supabase, userId, baselines);
  } catch (planError) {
    console.error("Failed to update plan zones:", planError);
    // Non-fatal — baselines are still saved to profile
  }

  return baselines;
}
