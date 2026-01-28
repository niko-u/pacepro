import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { analyzeWorkout } from "@/lib/coach/ai";

// Use service role for webhook processing (no user auth)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Log event for debugging
    await supabase.from("webhook_events").insert({
      provider: "strava",
      event_type: event.aspect_type,
      event_id: `${event.object_id}-${event.event_time}`,
      payload: event,
    });

    // Only process new activities
    if (event.aspect_type === "create" && event.object_type === "activity") {
      // Queue for async processing
      await processStravaActivity(event.object_id, event.owner_id);
    }

    // Always respond quickly to webhook
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Strava webhook error:", error);
    return NextResponse.json({ received: true }); // Still ACK to prevent retries
  }
}

async function processStravaActivity(activityId: number, stravaAthleteId: number) {
  try {
    // Find user by Strava athlete ID
    const { data: integration } = await supabase
      .from("integrations")
      .select("user_id, access_token")
      .eq("provider", "strava")
      .eq("strava_athlete_id", stravaAthleteId)
      .single();

    if (!integration) {
      console.log("No user found for Strava athlete:", stravaAthleteId);
      return;
    }

    // Fetch activity details from Strava
    const activity = await fetchStravaActivity(activityId, integration.access_token);
    if (!activity) return;

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

    // Generate AI analysis
    const analysis = await analyzeWorkout(
      context,
      scheduledWorkout ? {
        title: scheduledWorkout.title,
        duration_minutes: scheduledWorkout.duration_minutes,
        distance_meters: scheduledWorkout.distance_meters,
        zones: scheduledWorkout.target_zones,
      } : {},
      actualData
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

    // Send coach message with analysis
    await supabase.from("chat_messages").insert({
      user_id: integration.user_id,
      role: "assistant",
      content: analysis,
      message_type: "workout_analysis",
      metadata: { strava_activity_id: activityId },
    });

    // Mark webhook event as processed
    await supabase
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("provider", "strava")
      .eq("event_id", `${activityId}-${Date.now()}`);

    console.log("Processed Strava activity:", activityId);
  } catch (error) {
    console.error("Error processing Strava activity:", error);
    
    // Log error
    await supabase
      .from("webhook_events")
      .update({ error: String(error) })
      .eq("provider", "strava")
      .eq("payload->object_id", activityId);
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
    Walk: "run", // Treat as easy run
    Hike: "run",
    VirtualRun: "run",
    VirtualRide: "bike",
  };
  return typeMap[stravaType] || "run";
}
