import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { analyzeWorkout } from "@/lib/coach/ai";
import {
  adaptAfterWorkout,
  executeAdaptationActions,
} from "@/lib/coach/adaptation";
import {
  fetchStravaStreams,
  analyzeWorkoutStreams,
  getUserZonesFromProfile,
  updateTrainingLoad,
  detectZoneBreakthroughs,
} from "@/lib/analytics";
import type { WorkoutAnalytics, StravaStream } from "@/lib/analytics";

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

// Strava webhook verification (GET)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Verify the token matches our secret
  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.log("Strava webhook verified");
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Strava webhook event (POST)
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    
    console.log("Strava webhook received:", event);

    // Log event with upsert to handle retries gracefully
    const supabase = getSupabase();
    const eventId = `${event.object_id}-${event.event_time}`;
    const { data: inserted } = await supabase
      .from("webhook_events")
      .upsert(
        {
          provider: "strava",
          event_type: event.aspect_type,
          event_id: eventId,
          payload: event,
        },
        { onConflict: "provider,event_id", ignoreDuplicates: true }
      )
      .select("id, processed")
      .maybeSingle();

    // If no row returned (duplicate ignored) or already processed, skip
    if (!inserted || inserted.processed) {
      console.log(`Event ${eventId} already handled, skipping`);
      return NextResponse.json({ received: true });
    }

    // Only process new activities
    if (event.aspect_type === "create" && event.object_type === "activity") {
      await processStravaActivity(event.object_id, event.owner_id, eventId);
    }

    // Always respond quickly to webhook
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Strava webhook error:", error);
    return NextResponse.json({ received: true }); // Still ACK to prevent retries
  }
}

/**
 * Ensure we have a valid (non-expired) Strava access token.
 * If the current token is expired, refresh it via Strava's OAuth endpoint
 * and persist the new credentials.
 */
async function getValidStravaToken(
  supabase: SupabaseClient,
  integration: { id: string; user_id: string; access_token: string; refresh_token: string; token_expires_at: string | number }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Parse token_expires_at — could be ISO string (TIMESTAMPTZ) or epoch number
  const expiresAt = typeof integration.token_expires_at === 'number'
    ? integration.token_expires_at
    : Math.floor(new Date(integration.token_expires_at).getTime() / 1000);

  // If token is still valid (with 60s buffer), return it as-is
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

  console.log(`Strava token refreshed for user ${integration.user_id}`);
  return data.access_token;
}

async function processStravaActivity(activityId: number, stravaAthleteId: number, eventId: string) {
  const supabase = getSupabase();
  try {
    // Idempotency check: skip if this activity was already processed
    const { data: existingWorkout } = await supabase
      .from("workouts")
      .select("id")
      .eq("strava_activity_id", activityId)
      .limit(1)
      .maybeSingle();

    if (existingWorkout) {
      console.log(`Strava activity ${activityId} already processed (workout ${existingWorkout.id}), skipping`);
      return;
    }

    // Also check webhook_events table for already-processed events
    const { data: processedEvent } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("provider", "strava")
      .eq("event_id", eventId)
      .eq("processed", true)
      .limit(1)
      .maybeSingle();

    if (processedEvent) {
      console.log(`Strava webhook event ${eventId} already processed, skipping`);
      return;
    }

    // Find user by Strava athlete ID
    const { data: integration } = await supabase
      .from("integrations")
      .select("id, user_id, access_token, refresh_token, token_expires_at")
      .eq("provider", "strava")
      .eq("strava_athlete_id", stravaAthleteId)
      .single();

    if (!integration) {
      console.log("No user found for Strava athlete:", stravaAthleteId);
      return;
    }

    // Get a valid (possibly refreshed) access token
    const accessToken = await getValidStravaToken(supabase, integration);

    // Fetch activity details from Strava
    const activity = await fetchStravaActivity(activityId, accessToken);
    if (!activity) return;

    // Fetch activity streams (heart rate, pace, power, cadence, altitude)
    let streams: StravaStream | null = null;
    try {
      streams = await fetchStravaStreams(activityId, accessToken);
    } catch (streamError) {
      console.warn("Failed to fetch streams, continuing with summary-only analysis:", streamError);
    }

    // Find matching scheduled workout
    const activityDate = new Date(activity.start_date).toISOString().split("T")[0];
    const workoutType = mapStravaType(activity.type);

    const { data: scheduledWorkout } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", integration.user_id)
      .eq("scheduled_date", activityDate)
      .eq("workout_type", workoutType)
      .eq("status", "scheduled")
      .single();

    // Fetch user profile for zone calculations
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("run_pace_per_km, bike_ftp, swim_pace_per_100m, experience_level")
      .eq("id", integration.user_id)
      .single();

    // Fetch plan config for zone data
    const { data: activePlan } = await supabase
      .from("training_plans")
      .select("plan_config")
      .eq("user_id", integration.user_id)
      .eq("status", "active")
      .maybeSingle();

    // Calculate user zones from profile and plan
    const userZones = getUserZonesFromProfile(
      userProfile || {},
      activePlan?.plan_config as Record<string, unknown> | null
    );

    // Run analytics engine
    let workoutAnalytics: WorkoutAnalytics | null = null;
    try {
      workoutAnalytics = analyzeWorkoutStreams(
        workoutType,
        streams,
        activity,
        userZones,
        scheduledWorkout ? {
          intensity: scheduledWorkout.intensity,
          target_zones: scheduledWorkout.target_zones,
        } : undefined
      );
    } catch (analyticsError) {
      console.error("Analytics engine error:", analyticsError);
    }

    // Build actual data from Strava
    const actualData = {
      duration_minutes: Math.round(activity.moving_time / 60),
      distance_meters: Math.round(activity.distance),
      avg_hr: activity.average_heartrate,
      max_hr: activity.max_heartrate,
      avg_pace: activity.average_speed,
      elevation_gain: activity.total_elevation_gain,
      calories: activity.calories,
      strava_name: activity.name,
    };

    // Build context for analysis
    const context = await buildCoachContext(integration.user_id);

    // Generate AI analysis with analytics data
    const analysis = await analyzeWorkout(
      context,
      scheduledWorkout ? {
        title: scheduledWorkout.title,
        duration_minutes: scheduledWorkout.duration_minutes,
        distance_meters: scheduledWorkout.distance_meters,
        zones: scheduledWorkout.target_zones,
        intensity: scheduledWorkout.intensity,
      } : {},
      actualData,
      workoutAnalytics as unknown as Record<string, unknown> | null
    );

    if (scheduledWorkout) {
      // Update existing scheduled workout
      await supabase
        .from("workouts")
        .update({
          status: "completed",
          completed_at: activity.start_date,
          actual_duration_minutes: actualData.duration_minutes,
          actual_distance_meters: actualData.distance_meters,
          actual_data: actualData,
          strava_activity_id: activityId,
          analysis: { ai_analysis: analysis },
          coach_notes: analysis,
        })
        .eq("id", scheduledWorkout.id);
    } else {
      // Create new workout entry for unscheduled activity
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", integration.user_id)
        .eq("status", "active")
        .single();

      await supabase.from("workouts").insert({
        plan_id: plan?.id,
        user_id: integration.user_id,
        scheduled_date: activityDate,
        workout_type: workoutType,
        title: activity.name,
        description: "Synced from Strava",
        duration_minutes: actualData.duration_minutes,
        distance_meters: actualData.distance_meters,
        status: "completed",
        completed_at: activity.start_date,
        actual_duration_minutes: actualData.duration_minutes,
        actual_distance_meters: actualData.distance_meters,
        actual_data: actualData,
        strava_activity_id: activityId,
        analysis: { ai_analysis: analysis },
        coach_notes: analysis,
      });
    }

    // Store workout analytics in dedicated table
    const workoutId = scheduledWorkout?.id || null;
    if (workoutAnalytics) {
      try {
        // Get the workout ID (either existing or newly created)
        let analyticsWorkoutId = workoutId;
        if (!analyticsWorkoutId) {
          const { data: newWorkout } = await supabase
            .from("workouts")
            .select("id")
            .eq("strava_activity_id", activityId)
            .maybeSingle();
          analyticsWorkoutId = newWorkout?.id || null;
        }

        if (analyticsWorkoutId) {
          await supabase.from("workout_analytics").insert({
            workout_id: analyticsWorkoutId,
            user_id: integration.user_id,
            hr_zones: workoutAnalytics.hrZones || {},
            pace_zones: workoutAnalytics.paceZones || {},
            power_zones: workoutAnalytics.powerZones || {},
            training_stress_score: workoutAnalytics.trainingStressScore,
            intensity_factor: workoutAnalytics.intensityFactor,
            normalized_power: workoutAnalytics.normalizedPower,
            normalized_graded_pace: workoutAnalytics.normalizedGradedPace,
            variability_index: workoutAnalytics.variabilityIndex,
            efficiency_factor: workoutAnalytics.efficiencyFactor,
            aerobic_decoupling: workoutAnalytics.aerobicDecoupling,
            splits: workoutAnalytics.splits,
            zone_compliance_score: workoutAnalytics.zoneComplianceScore,
            zone_compliance_details: workoutAnalytics.zoneComplianceDetails,
            avg_cadence: workoutAnalytics.avgCadence,
            cadence_variability: workoutAnalytics.cadenceVariability,
            total_ascent: workoutAnalytics.totalAscent,
            total_descent: workoutAnalytics.totalDescent,
            grade_adjusted_pace: workoutAnalytics.gradeAdjustedPace,
            trimp: workoutAnalytics.trimp,
          });

          // Update training load (ATL/CTL/TSB)
          if (workoutAnalytics.trainingStressScore) {
            await updateTrainingLoad(
              integration.user_id,
              activityDate,
              workoutAnalytics.trainingStressScore,
              supabase
            );
          }
        }
      } catch (analyticsStoreError) {
        console.error("Failed to store workout analytics:", analyticsStoreError);
      }
    }

    // Check for zone breakthroughs (FTP, pace, CSS changes)
    let breakthroughMessages: string[] = [];
    try {
      const breakthroughWorkoutId = workoutId || (
        await supabase
          .from("workouts")
          .select("id")
          .eq("strava_activity_id", activityId)
          .maybeSingle()
      ).data?.id;

      if (breakthroughWorkoutId) {
        const breakthroughs = await detectZoneBreakthroughs(
          integration.user_id,
          breakthroughWorkoutId,
          activityDate,
          workoutType,
          streams,
          activity,
          userProfile || {},
          supabase
        );

        breakthroughMessages = breakthroughs
          .filter((b) => b.message)
          .map((b) => b.message);
      }
    } catch (zoneError) {
      console.error("Zone detection error:", zoneError);
    }

    // Send coach message with analysis
    const fullAnalysis = breakthroughMessages.length > 0
      ? `${analysis}\n\n${breakthroughMessages.join("\n\n")}`
      : analysis;

    await supabase.from("chat_messages").insert({
      user_id: integration.user_id,
      role: "assistant",
      content: fullAnalysis,
      message_type: "workout_analysis",
      metadata: {
        strava_activity_id: activityId,
        has_analytics: !!workoutAnalytics,
        has_streams: !!streams,
      },
    });

    // Run adaptation engine — compare actual vs prescribed and adjust future workouts
    try {
      const adaptResult = await adaptAfterWorkout(
        supabase,
        integration.user_id,
        scheduledWorkout,
        actualData,
        workoutAnalytics as unknown as Record<string, unknown> | null
      );

      if (adaptResult.actions.length > 0 || adaptResult.message) {
        await executeAdaptationActions(
          supabase,
          integration.user_id,
          adaptResult
        );
        console.log(
          `Adaptation after workout: ${adaptResult.actions.length} actions for user ${integration.user_id}`
        );
      }
    } catch (adaptError) {
      console.error("Post-workout adaptation error:", adaptError);
    }

    // Mark webhook event as processed
    await supabase
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("provider", "strava")
      .eq("event_id", eventId);

    console.log("Processed Strava activity:", activityId);
  } catch (error) {
    console.error("Error processing Strava activity:", error);
    
    // Log error using the consistent eventId
    await supabase
      .from("webhook_events")
      .update({ error: String(error) })
      .eq("provider", "strava")
      .eq("event_id", eventId);
  }
}

async function fetchStravaActivity(activityId: number, accessToken: string) {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      console.error("Strava API error:", response.status);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch Strava activity:", error);
    return null;
  }
}

function mapStravaType(stravaType: string): string {
  const typeMap: Record<string, string> = {
    Run: "run",
    Ride: "bike",
    Swim: "swim",
    WeightTraining: "strength",
    Workout: "strength",
    Walk: "rest", // Don't match walks to scheduled runs
    Hike: "rest",
    VirtualRun: "run",
    VirtualRide: "bike",
  };
  return typeMap[stravaType] || "run";
}
