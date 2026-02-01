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

export interface WorkoutProposal {
  type: WorkoutType;
  title: string;
  duration_minutes: number | null;
  distance_meters: number | null;
  description: string;
  intensity: string;
  target_date: string;
}

/**
 * Analyze a coach response for workout suggestions.
 * Returns a structured proposal (does NOT create in DB — user must accept first).
 */
export async function extractWorkoutProposal(
  coachResponse: string,
  userMessage: string
): Promise<{ hasProposal: boolean; proposal?: WorkoutProposal }> {
  try {
    // Quick heuristic: skip extraction if response is very short or clearly not a workout
    if (coachResponse.length < 80) {
      return { hasProposal: false };
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
      return { hasProposal: false };
    }

    // Validate workout type
    const workoutType = validateWorkoutType(extracted.type);
    if (!workoutType) {
      console.warn("Invalid workout type extracted:", extracted.type);
      return { hasProposal: false };
    }

    const title = extracted.title || `${capitalize(workoutType)} Session`;
    let description = extracted.description || "";
    if (extracted.intensity && !description.toLowerCase().includes(extracted.intensity)) {
      description = `Intensity: ${extracted.intensity}\n\n${description}`;
    }

    return {
      hasProposal: true,
      proposal: {
        type: workoutType,
        title,
        duration_minutes: extracted.duration_minutes || null,
        distance_meters: extracted.distance_meters || null,
        description,
        intensity: extracted.intensity || "moderate",
        target_date: extracted.target_date || today,
      },
    };
  } catch (error) {
    console.error("extractWorkoutProposal error:", error);
    return { hasProposal: false };
  }
}

/**
 * Accept a workout proposal — creates it in the DB on the user's active plan.
 */
export async function acceptWorkoutProposal(
  supabase: SupabaseClient,
  userId: string,
  proposal: WorkoutProposal
): Promise<{ created: boolean; workoutId?: string }> {
  try {
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!plan) {
      console.log("No active plan for user, cannot accept workout proposal");
      return { created: false };
    }

    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({
        plan_id: plan.id,
        user_id: userId,
        scheduled_date: proposal.target_date,
        workout_type: proposal.type,
        title: proposal.title,
        description: proposal.description,
        duration_minutes: proposal.duration_minutes,
        distance_meters: proposal.distance_meters,
        status: "scheduled",
        coach_notes: "Accepted from coach chat proposal.",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create workout from proposal:", error);
      return { created: false };
    }

    console.log(`Accepted workout proposal ${workout.id}: "${proposal.title}" on ${proposal.target_date}`);
    return { created: true, workoutId: workout.id };
  } catch (error) {
    console.error("acceptWorkoutProposal error:", error);
    return { created: false };
  }
}

/**
 * @deprecated Use extractWorkoutProposal + acceptWorkoutProposal instead
 */
export async function extractAndCreateWorkout(
  supabase: SupabaseClient,
  userId: string,
  coachResponse: string,
  userMessage: string
): Promise<{ created: boolean; workoutId?: string }> {
  const { hasProposal, proposal } = await extractWorkoutProposal(coachResponse, userMessage);
  if (!hasProposal || !proposal) return { created: false };
  return acceptWorkoutProposal(supabase, userId, proposal);
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
