import OpenAI from "openai";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { CoachContext, formatContextForAI } from "./context";

// Lazy-load OpenAI client
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Service-role Supabase client for plan modifications (bypasses RLS)
let _serviceSupabase: SupabaseClient | null = null;
function getServiceSupabase(): SupabaseClient {
  if (!_serviceSupabase) {
    _serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceSupabase;
}

// ---------- Types ----------

interface PlanChange {
  action: "update" | "create" | "delete";
  date: string; // YYYY-MM-DD
  workout_type?: string;
  updates?: Record<string, unknown>;
}

interface PlanModification {
  needed: boolean;
  type?:
    | "swap_workout"
    | "skip_workout"
    | "reschedule"
    | "reduce_volume"
    | "add_rest_day"
    | "modify_intensity"
    | "injury_protocol"
    | "travel_adjustment";
  description?: string;
  changes?: PlanChange[];
  injury?: {
    body_part: string;
    severity: "mild" | "moderate" | "severe";
  };
}

// Body part → affected sport mapping for injury protocol
const INJURY_SPORT_MAP: Record<string, string[]> = {
  knee: ["run"],
  ankle: ["run"],
  shin: ["run"],
  foot: ["run"],
  achilles: ["run"],
  hamstring: ["run"],
  calf: ["run"],
  hip: ["run", "bike"],
  it_band: ["run", "bike"],
  shoulder: ["swim"],
  rotator_cuff: ["swim"],
  wrist: ["swim"],
  elbow: ["swim"],
  back: ["bike", "run"],
  lower_back: ["bike", "run"],
  neck: ["bike", "swim"],
  quad: ["run", "bike"],
  groin: ["run", "bike"],
};

// Sport swap preferences (what to replace affected sport with)
const SPORT_SWAP_MAP: Record<string, string> = {
  run: "bike",
  bike: "swim",
  swim: "bike",
};

// ---------- Detection Prompt ----------

const PLAN_MODIFICATION_PROMPT = `You are analyzing a chat exchange between a triathlon coach and an athlete to determine if the athlete requested a change to their training plan.

A plan modification is when the athlete asks to:
- Swap a workout for a different one
- Skip a workout
- Move/reschedule a workout to a different day
- Reduce training volume or intensity
- Add a rest day
- Modify workout intensity (make it easier/harder)
- Report an injury that requires plan adjustment
- Adjust schedule for travel/life events

Do NOT flag these as modifications:
- General questions about training
- Asking for advice without requesting a change
- The coach proactively suggesting a workout (that's handled by workout-creator)
- Past workout discussion/analysis
- Asking about nutrition or gear

Today's date: {today}

ATHLETE CONTEXT:
{context}

Analyze the exchange and return JSON:
{
  "needed": true/false,
  "type": "swap_workout|skip_workout|reschedule|reduce_volume|add_rest_day|modify_intensity|injury_protocol|travel_adjustment",
  "description": "Brief description of what changed (e.g., 'Swapped Thursday tempo run for easy bike ride')",
  "changes": [
    {
      "action": "update|create|delete",
      "date": "YYYY-MM-DD",
      "workout_type": "run|bike|swim|strength|brick|rest",
      "updates": {
        "workout_type": "bike",
        "title": "Easy Ride",
        "duration_minutes": 60,
        "description": "Easy zone 2 ride",
        "intensity": "easy",
        "status": "scheduled|skipped"
      }
    }
  ],
  "injury": {
    "body_part": "knee",
    "severity": "mild|moderate|severe"
  }
}

If no plan modification is needed, return: { "needed": false }

Important rules:
- "date" must be a valid YYYY-MM-DD string
- For skip_workout, set updates.status to "skipped"
- For add_rest_day, action should be "update" with status "skipped" on existing workouts, or "create" with workout_type "rest"
- For injury_protocol, include the "injury" field — the system will handle workout adjustments automatically
- Only include changes the athlete explicitly requested or that naturally follow from their request
- Use the athlete context to determine correct dates (e.g., "tomorrow" → actual date, "Thursday" → next Thursday)`;

// ---------- Main Function ----------

/**
 * After every chat exchange, detect if the user requested a plan modification.
 * If so, execute the DB changes.
 */
export async function detectAndExecutePlanModification(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  coachResponse: string,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  try {
    // Quick heuristic: skip detection for very short messages unlikely to request changes
    if (userMessage.length < 10) {
      return { modified: false };
    }

    // Quick keyword check — skip GPT call if message is clearly not a plan change request
    if (!mightRequestPlanChange(userMessage)) {
      return { modified: false };
    }

    const today = new Date().toISOString().split("T")[0];
    const contextSummary = formatContextForAI(context);

    const prompt = PLAN_MODIFICATION_PROMPT
      .replace("{today}", today)
      .replace("{context}", contextSummary);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4-turbo-preview",
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
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const modification: PlanModification = JSON.parse(content);

    if (!modification.needed) {
      return { modified: false };
    }

    // Use service role client for DB modifications
    const serviceSupabase = getServiceSupabase();

    // Handle injury protocol specially
    if (modification.type === "injury_protocol" && modification.injury) {
      const result = await executeInjuryProtocol(
        serviceSupabase,
        userId,
        modification.injury,
        context
      );
      return result;
    }

    // Execute standard changes
    if (modification.changes && modification.changes.length > 0) {
      await executeChanges(serviceSupabase, userId, modification.changes, context);
    }

    const description = modification.description || `Plan updated (${modification.type})`;
    console.log(`Plan modification for user ${userId}: ${description}`);

    return { modified: true, description };
  } catch (error) {
    console.error("detectAndExecutePlanModification error:", error);
    return { modified: false };
  }
}

// ---------- Keyword Heuristic ----------

/**
 * Quick check if the user message might be requesting a plan change.
 * Avoids expensive GPT calls for obviously non-plan-change messages.
 */
function mightRequestPlanChange(message: string): boolean {
  const lower = message.toLowerCase();

  const keywords = [
    // Swap / change
    "swap", "switch", "change", "replace", "instead",
    // Skip / cancel
    "skip", "cancel", "drop", "remove", "take off",
    // Move / reschedule
    "move", "reschedule", "shift", "push", "postpone", "delay",
    // Volume / intensity
    "easier", "harder", "less", "more", "reduce", "increase", "dial back", "ramp up",
    "lower", "lighter", "shorter", "longer",
    // Rest
    "rest day", "day off", "take a break", "need rest",
    // Injury
    "hurt", "injury", "injured", "sore", "pain", "strained", "pulled",
    "tweaked", "ache", "aching", "inflamed", "tendon", "knee", "ankle",
    "shoulder", "back", "hamstring", "calf", "shin",
    // Travel / life
    "travel", "trip", "vacation", "holiday", "busy", "can't make",
    "won't be able", "out of town", "conference", "work thing",
  ];

  return keywords.some((kw) => lower.includes(kw));
}

// ---------- Execute Standard Changes ----------

async function executeChanges(
  supabase: SupabaseClient,
  userId: string,
  changes: PlanChange[],
  context: CoachContext
): Promise<void> {
  // Get user's active plan ID for creating new workouts
  const planId = context.plan?.id;

  for (const change of changes) {
    try {
      if (change.action === "update" && change.date) {
        // Find matching workout by date + optional type
        const query = supabase
          .from("workouts")
          .select("id")
          .eq("user_id", userId)
          .eq("scheduled_date", change.date);

        if (change.workout_type) {
          query.eq("workout_type", change.workout_type);
        }

        const { data: matchingWorkouts } = await query.limit(1).single();

        if (matchingWorkouts) {
          // Apply updates
          const updates: Record<string, unknown> = { ...change.updates };
          await supabase
            .from("workouts")
            .update(updates)
            .eq("id", matchingWorkouts.id);

          console.log(
            `Updated workout ${matchingWorkouts.id} on ${change.date}:`,
            updates
          );
        } else {
          console.warn(
            `No matching workout found for date=${change.date} type=${change.workout_type}`
          );
        }
      } else if (change.action === "create" && change.date && planId) {
        // Create new workout
        const newWorkout = {
          plan_id: planId,
          user_id: userId,
          scheduled_date: change.date,
          workout_type: change.updates?.workout_type || change.workout_type || "run",
          title: change.updates?.title || "New Workout",
          description: change.updates?.description || "",
          duration_minutes: change.updates?.duration_minutes || null,
          distance_meters: change.updates?.distance_meters || null,
          intensity: change.updates?.intensity || "moderate",
          status: "scheduled",
          coach_notes: change.updates?.coach_notes || "Created via chat plan modification.",
        };

        const { error } = await supabase.from("workouts").insert(newWorkout);
        if (error) {
          console.error(`Failed to create workout on ${change.date}:`, error);
        } else {
          console.log(`Created workout on ${change.date}: ${newWorkout.title}`);
        }
      } else if (change.action === "delete" && change.date) {
        // Mark as skipped rather than hard deleting
        const query = supabase
          .from("workouts")
          .select("id")
          .eq("user_id", userId)
          .eq("scheduled_date", change.date);

        if (change.workout_type) {
          query.eq("workout_type", change.workout_type);
        }

        const { data: matchingWorkouts } = await query.limit(1).single();

        if (matchingWorkouts) {
          await supabase
            .from("workouts")
            .update({ status: "skipped", coach_notes: "Removed via chat request." })
            .eq("id", matchingWorkouts.id);

          console.log(`Skipped workout ${matchingWorkouts.id} on ${change.date}`);
        }
      }
    } catch (error) {
      console.error(`Error executing change on ${change.date}:`, error);
    }
  }
}

// ---------- Injury Protocol ----------

/**
 * When the athlete reports an injury, automatically adjust the next 7 days of workouts.
 * - Map body part → affected sports
 * - Swap affected workouts to alternative sports or reduce intensity
 * - Store injury in learned_preferences.limitations
 */
async function executeInjuryProtocol(
  supabase: SupabaseClient,
  userId: string,
  injury: { body_part: string; severity: "mild" | "moderate" | "severe" },
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysOut = addDays(today, 7);

    // Fetch next 7 days of workouts
    const { data: upcomingWorkouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_date", today)
      .lte("scheduled_date", sevenDaysOut)
      .order("scheduled_date", { ascending: true });

    if (!upcomingWorkouts || upcomingWorkouts.length === 0) {
      // Still store the injury even if no workouts to modify
      await storeInjuryPreference(supabase, userId, injury);
      return {
        modified: true,
        description: `Noted ${injury.body_part} ${injury.severity} injury. No upcoming workouts to modify.`,
      };
    }

    // Determine affected sports
    const bodyPart = injury.body_part.toLowerCase().replace(/\s+/g, "_");
    const affectedSports = INJURY_SPORT_MAP[bodyPart] || [];

    if (affectedSports.length === 0) {
      // Unknown body part — reduce all intensities as precaution
      await storeInjuryPreference(supabase, userId, injury);
      return {
        modified: true,
        description: `Noted ${injury.body_part} injury. Please describe which activities are affected.`,
      };
    }

    let modifiedCount = 0;
    const modifications: string[] = [];

    for (const workout of upcomingWorkouts) {
      const workoutType = workout.workout_type?.toLowerCase();

      if (!affectedSports.includes(workoutType)) {
        continue; // This sport is not affected by the injury
      }

      if (injury.severity === "severe") {
        // Severe: skip all affected workouts
        await supabase
          .from("workouts")
          .update({
            status: "skipped",
            coach_notes: `Skipped due to ${injury.body_part} injury (severe). Original: "${workout.title}".`,
          })
          .eq("id", workout.id);

        modifications.push(`Skipped ${workout.title} (${workout.scheduled_date})`);
      } else if (injury.severity === "moderate") {
        // Moderate: swap sport if possible
        const altSport = SPORT_SWAP_MAP[workoutType];
        if (altSport) {
          const altTitle = `Easy ${capitalize(altSport)} (${injury.body_part} recovery)`;
          const reducedDuration = Math.round((workout.duration_minutes || 60) * 0.7);

          await supabase
            .from("workouts")
            .update({
              workout_type: altSport,
              title: altTitle,
              description: `Easy zone 1-2 ${altSport} — protecting ${injury.body_part}. Original: "${workout.title}".`,
              duration_minutes: reducedDuration,
              intensity: "easy",
              coach_notes: `Swapped from ${workoutType} due to ${injury.body_part} injury (moderate).`,
            })
            .eq("id", workout.id);

          modifications.push(
            `Swapped ${workout.title} → ${altTitle} (${workout.scheduled_date})`
          );
        } else {
          // No good swap — reduce intensity
          await supabase
            .from("workouts")
            .update({
              intensity: "easy",
              duration_minutes: Math.round((workout.duration_minutes || 60) * 0.6),
              coach_notes: `Reduced intensity due to ${injury.body_part} injury (moderate). Original: "${workout.title}" (${workout.duration_minutes}min).`,
            })
            .eq("id", workout.id);

          modifications.push(`Reduced ${workout.title} (${workout.scheduled_date})`);
        }
      } else {
        // Mild: reduce intensity only
        const newIntensity = workout.intensity === "hard" || workout.intensity === "max" ? "moderate" : "easy";
        const reducedDuration = Math.round((workout.duration_minutes || 60) * 0.85);

        await supabase
          .from("workouts")
          .update({
            intensity: newIntensity,
            duration_minutes: reducedDuration,
            coach_notes: `Reduced intensity (${workout.intensity} → ${newIntensity}) due to mild ${injury.body_part} discomfort. Listen to your body.`,
          })
          .eq("id", workout.id);

        modifications.push(`Eased ${workout.title} (${workout.scheduled_date})`);
      }

      modifiedCount++;
    }

    // Store injury in learned_preferences
    await storeInjuryPreference(supabase, userId, injury);

    const description =
      modifiedCount > 0
        ? `${capitalize(injury.severity)} ${injury.body_part} injury protocol: modified ${modifiedCount} workout${modifiedCount > 1 ? "s" : ""}. ${modifications.join("; ")}`
        : `Noted ${injury.body_part} injury — no affected workouts in the next 7 days.`;

    console.log(`Injury protocol for user ${userId}: ${description}`);
    return { modified: true, description };
  } catch (error) {
    console.error("executeInjuryProtocol error:", error);
    return { modified: false };
  }
}

// ---------- Helpers ----------

async function storeInjuryPreference(
  supabase: SupabaseClient,
  userId: string,
  injury: { body_part: string; severity: string }
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("learned_preferences")
      .eq("id", userId)
      .single();

    const current = profile?.learned_preferences || {};
    const limitations: string[] = current.limitations || [];

    // Remove any previous entry for the same body part
    const filtered = limitations.filter(
      (l: string) => !l.toLowerCase().includes(injury.body_part.toLowerCase())
    );

    const dateStr = new Date().toISOString().split("T")[0];
    filtered.push(
      `${injury.body_part} injury (${injury.severity}) reported ${dateStr}`
    );

    await supabase
      .from("profiles")
      .update({
        learned_preferences: {
          ...current,
          limitations: filtered,
        },
      })
      .eq("id", userId);
  } catch (error) {
    console.error("storeInjuryPreference error:", error);
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
