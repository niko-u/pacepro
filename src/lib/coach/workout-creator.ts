import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";

// Lazy-load OpenAI client
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const VALID_WORKOUT_TYPES = [
  "swim",
  "bike",
  "run",
  "strength",
  "rest",
  "brick",
] as const;

type WorkoutType = (typeof VALID_WORKOUT_TYPES)[number];

interface ExtractedWorkout {
  has_workout: boolean;
  type?: string;
  title?: string;
  duration_minutes?: number;
  distance_meters?: number;
  description?: string;
  intensity?: string; // easy | moderate | hard | max
  target_date?: string; // YYYY-MM-DD
}

const WORKOUT_EXTRACTION_PROMPT = `You are analyzing a coach's response to see if it contains a concrete workout prescription that should be scheduled.

A concrete workout prescription means the coach is PRESCRIBING a specific workout for the athlete to do — not just discussing training concepts or reviewing a past workout.

Look for:
- Specific workout structure (e.g., "Do a 45-minute easy run with 4x100m strides")
- Clear workout type (run, bike, swim, strength, brick)
- Duration or distance targets
- Scheduled date/day (today, tomorrow, Wednesday, etc.)

Do NOT flag these as workouts:
- General advice ("you should run more")
- Past workout analysis ("great job on your run")
- Vague suggestions without structure
- Discussion about training philosophy

Today's date: {today}

Return a JSON object:
{
  "has_workout": true/false,
  "type": "run" | "bike" | "swim" | "strength" | "rest" | "brick",
  "title": "Short descriptive title",
  "duration_minutes": number or null,
  "distance_meters": number or null,
  "description": "Full workout description with structure",
  "intensity": "easy" | "moderate" | "hard" | "max",
  "target_date": "YYYY-MM-DD"
}

If no concrete workout is prescribed, return: { "has_workout": false }`;

/**
 * Analyze a coach response for workout suggestions.
 * If found, create the workout in the DB so it appears on dashboard/calendar.
 */
export async function extractAndCreateWorkout(
  supabase: SupabaseClient,
  userId: string,
  coachResponse: string,
  userMessage: string
): Promise<{ created: boolean; workoutId?: string }> {
  try {
    // Quick heuristic: skip extraction if response is very short or clearly not a workout
    if (coachResponse.length < 80) {
      return { created: false };
    }

    const today = new Date().toISOString().split("T")[0];

    // Use GPT to check if the response contains a workout prescription
    const prompt = WORKOUT_EXTRACTION_PROMPT.replace("{today}", today);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            athlete_message: userMessage,
            coach_response: coachResponse,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const extracted: ExtractedWorkout = JSON.parse(content);

    if (!extracted.has_workout) {
      return { created: false };
    }

    // Validate workout type
    const workoutType = validateWorkoutType(extracted.type);
    if (!workoutType) {
      console.warn("Invalid workout type extracted:", extracted.type);
      return { created: false };
    }

    // Get user's active plan (required for FK constraint)
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!plan) {
      console.log(
        "No active plan for user, skipping workout creation from chat"
      );
      return { created: false };
    }

    // Build workout row
    const scheduledDate = extracted.target_date || today;
    const title = extracted.title || `${capitalize(workoutType)} Session`;

    // Build description including intensity
    let description = extracted.description || "";
    if (extracted.intensity && !description.toLowerCase().includes(extracted.intensity)) {
      description = `Intensity: ${extracted.intensity}\n\n${description}`;
    }

    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({
        plan_id: plan.id,
        user_id: userId,
        scheduled_date: scheduledDate,
        workout_type: workoutType,
        title,
        description,
        duration_minutes: extracted.duration_minutes || null,
        distance_meters: extracted.distance_meters || null,
        status: "scheduled",
        coach_notes: "Created from coach chat suggestion.",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create workout from chat:", error);
      return { created: false };
    }

    console.log(
      `Created workout ${workout.id} from chat: "${title}" on ${scheduledDate}`
    );
    return { created: true, workoutId: workout.id };
  } catch (error) {
    console.error("extractAndCreateWorkout error:", error);
    return { created: false };
  }
}

function validateWorkoutType(type: string | undefined): WorkoutType | null {
  if (!type) return null;
  const normalized = type.toLowerCase().trim();
  if (VALID_WORKOUT_TYPES.includes(normalized as WorkoutType)) {
    return normalized as WorkoutType;
  }
  // Map common aliases
  const aliases: Record<string, WorkoutType> = {
    running: "run",
    ride: "bike",
    cycling: "bike",
    swimming: "swim",
    weights: "strength",
    gym: "strength",
    "weight training": "strength",
    brick: "brick",
  };
  return aliases[normalized] || null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
