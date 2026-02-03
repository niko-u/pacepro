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

/** All supported modification types */
type ModificationType =
  // ── Existing workout-level types ──
  | "swap_workout"
  | "skip_workout"
  | "reschedule"
  | "reduce_volume"
  | "add_rest_day"
  | "modify_intensity"
  | "injury_protocol"
  | "travel_adjustment"
  // ── Training philosophy ──
  | "adjust_overload_rate"
  | "adjust_volume_target"
  | "shift_training_distribution"
  | "change_workout_mix"
  // ── Sport distribution (triathlon) ──
  | "adjust_sport_ratios"
  | "add_brick_sessions"
  | "focus_weakest_sport"
  // ── Plan structure ──
  | "modify_phase_duration"
  | "change_day_assignment"
  | "temporary_schedule"
  // ── Physiological updates ──
  | "update_ftp"
  | "update_run_zones"
  | "update_swim_zones"
  // ── Race / goal changes ──
  | "add_race"
  | "change_goal_time"
  | "change_sport"
  // ── Recovery philosophy ──
  | "update_recovery_philosophy";

interface PlanModification {
  needed: boolean;
  type?: ModificationType;
  description?: string;
  changes?: PlanChange[];
  injury?: {
    body_part: string;
    severity: "mild" | "moderate" | "severe";
  };
  /** Type-specific parameters extracted by GPT */
  params?: Record<string, unknown>;
}

// ---------- Injury Constants ----------

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

const SPORT_SWAP_MAP: Record<string, string> = {
  run: "bike",
  bike: "swim",
  swim: "bike",
};

// ---------- Zone Helpers (duplicated from plan-engine for independence) ----------

function calculateRunPaceZones(easyPaceSec: number) {
  return {
    easy: { min: easyPaceSec, max: Math.round(easyPaceSec * 1.15) },
    moderate: { min: Math.round(easyPaceSec * 0.9), max: easyPaceSec },
    tempo: { min: Math.round(easyPaceSec * 0.82), max: Math.round(easyPaceSec * 0.88) },
    threshold: { min: Math.round(easyPaceSec * 0.78), max: Math.round(easyPaceSec * 0.82) },
    interval: { min: Math.round(easyPaceSec * 0.72), max: Math.round(easyPaceSec * 0.78) },
    longRun: { min: easyPaceSec, max: Math.round(easyPaceSec * 1.1) },
  };
}

function calculateBikePowerZones(ftp: number) {
  return {
    z1: { min: 0, max: Math.round(ftp * 0.55) },
    z2: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75) },
    z3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.9) },
    z4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
    z5: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.2) },
  };
}

// ---------- Detection Prompt (Comprehensive) ----------

const PLAN_MODIFICATION_PROMPT = `You are analyzing a chat exchange between a triathlon/running coach AI and an athlete to determine if the athlete requested ANY change to their training plan, profile, or preferences.

A plan modification includes:
─── WORKOUT-LEVEL CHANGES ───
- swap_workout: Swap a workout for a different one
- skip_workout: Skip a workout
- reschedule: Move/reschedule a workout to a different day
- reduce_volume: Reduce training volume or duration
- add_rest_day: Add a rest day on a specific date
- modify_intensity: Make specific workout(s) easier/harder
- injury_protocol: Report an injury requiring plan adjustment
- travel_adjustment: Adjust schedule for travel/life events

─── TRAINING PHILOSOPHY ───
- adjust_overload_rate: Change how aggressively volume/intensity increases week-over-week ("make overload more/less aggressive")
  params: { "rate": "aggressive"|"moderate"|"conservative", "percent_per_week": number }
- adjust_volume_target: Increase or decrease overall weekly training hours/volume ("I want more/less volume", "I want to train more/less")
  params: { "direction": "increase"|"decrease", "percent": number (e.g. 15 for 15% change), "weekly_hours": number|null }
- shift_training_distribution: Change balance between easy/hard sessions ("focus more on intensity over volume", "more polarized")
  params: { "focus": "more_intensity"|"more_volume"|"balanced"|"polarized" }
- change_workout_mix: Change types of workouts ("more easy runs", "fewer intervals", "add more tempo work")
  params: { "more_of": ["easy","tempo","long_run","intervals","threshold"], "less_of": ["easy","tempo","long_run","intervals","threshold"] }

─── SPORT DISTRIBUTION (triathlon) ───
- adjust_sport_ratios: Change swim/bike/run volume split ("more swimming", "less cycling", "60/20/20 split")
  params: { "sport": "swim"|"bike"|"run", "direction": "more"|"less", "ratio": { "swim": number, "bike": number, "run": number }|null }
- add_brick_sessions: Add brick workouts ("I need more brick workouts", "add a brick session")
  params: { "frequency": "weekly"|"biweekly", "count": number }
- focus_weakest_sport: Auto-detect and shift focus to weakest discipline
  params: {}

─── PLAN STRUCTURE ───
- modify_phase_duration: Change training phase lengths ("extend build phase", "start taper earlier", "longer base phase")
  params: { "phase": "base"|"build"|"peak"|"taper", "action": "extend"|"shorten", "weeks": number|null }
- change_day_assignment: Move a specific workout type to a different day ("move long run to Saturday", "intervals on Tuesday")
  params: { "workout_pattern": string, "new_day": string (day name) }
- temporary_schedule: Reduce training days for a specific period ("I can only train 4 days this week", "light week next week")
  params: { "days": number, "duration_weeks": 1, "start_date": string|null }

─── PHYSIOLOGICAL UPDATES ───
- update_ftp: Update cycling FTP ("my FTP is now 230 watts")
  params: { "ftp_watts": number }
- update_run_zones: Update running pace zones from a race result or direct input ("I ran a 1:45 half marathon", "my easy pace is 5:30/km")
  params: { "pace_per_km_seconds": number|null, "race_time_seconds": number|null, "race_distance": string|null }
- update_swim_zones: Update swim CSS/pace ("my CSS is 1:40/100m", "swim pace is 1:35")
  params: { "pace_per_100m_seconds": number }

─── RACE & GOAL CHANGES ───
- add_race: Register a new race ("I signed up for a race on March 15", "I have a 10K in 6 weeks")
  params: { "race_date": "YYYY-MM-DD", "race_type": string, "is_b_race": true|false }
- change_goal_time: Change target finish time ("I want to target sub-4 marathon", "aiming for 1:30 half")
  params: { "goal_time_seconds": number, "race_type": string|null }
- change_sport: Switch primary sport entirely ("I dropped the triathlon, just doing marathon", "switching to cycling")
  params: { "new_sport": "running"|"triathlon"|"cycling"|"swimming" }

─── RECOVERY PHILOSOPHY ───
- update_recovery_philosophy: Change how the coach handles recovery ("push me harder on yellow days", "I need more rest between hard sessions", "I recover fast, don't hold me back")
  params: { "approach": "push_harder"|"more_rest"|"fast_recovery"|"conservative", "details": string }

Do NOT flag these as modifications:
- General questions about training (asking about pace zones, what a workout means)
- Asking for advice without requesting a change
- Past workout discussion/analysis
- Nutrition or gear questions
- The coach proactively suggesting something

Today's date: {today}

ATHLETE CONTEXT:
{context}

Analyze the exchange and return JSON:
{
  "needed": true/false,
  "type": "<one of the types above>",
  "description": "Brief description of what changed",
  "changes": [...],  // Only for workout-level changes (swap, skip, reschedule, etc.)
  "injury": { "body_part": "...", "severity": "mild|moderate|severe" },  // Only for injury_protocol
  "params": { ... }  // Type-specific parameters as described above
}

If no plan modification is needed, return: { "needed": false }

IMPORTANT RULES:
- "date" fields must be valid YYYY-MM-DD
- For skip_workout, set updates.status to "skipped"
- For physiological updates, convert times to seconds (e.g., 1:45:00 = 6300 sec, 5:30/km = 330 sec)
- For goal times, convert to total seconds (e.g., sub-4 marathon = 14400 sec, 1:30 half = 5400 sec)
- For race results that imply easy pace, calculate: half marathon time × 1.15 ÷ 21.1 ≈ easy pace/km in seconds
- Use context to resolve relative dates ("tomorrow", "Thursday", "this week")
- Only include changes the athlete explicitly requested`;

// ---------- Main Function ----------

/**
 * After every chat exchange, detect if the user requested a plan modification.
 * If so, execute the changes. Handles all modification types.
 */
export async function detectAndExecutePlanModification(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  coachResponse: string,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  try {
    // Quick heuristic: skip detection for very short messages
    if (userMessage.length < 10) {
      return { modified: false };
    }

    // Quick keyword check — skip GPT call if message is clearly not a plan change
    if (!mightRequestPlanChange(userMessage)) {
      return { modified: false };
    }

    const today = new Date().toISOString().split("T")[0];
    const contextSummary = formatContextForAI(context);

    const prompt = PLAN_MODIFICATION_PROMPT
      .replace("{today}", today)
      .replace("{context}", contextSummary);

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
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const modification: PlanModification = JSON.parse(content);

    if (!modification.needed || !modification.type) {
      return { modified: false };
    }

    // Use service role client for DB modifications
    const serviceSupabase = getServiceSupabase();

    // Route to the appropriate handler based on modification type
    const result = await routeModification(
      serviceSupabase,
      userId,
      modification,
      context
    );

    if (result.modified) {
      console.log(`Plan modification [${modification.type}] for user ${userId}: ${result.description}`);
    }

    return result;
  } catch (error) {
    console.error("detectAndExecutePlanModification error:", error);
    return { modified: false };
  }
}

// ---------- Modification Router ----------

async function routeModification(
  supabase: SupabaseClient,
  userId: string,
  modification: PlanModification,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const params = modification.params || {};

  switch (modification.type) {
    // ── Existing workout-level types ──
    case "injury_protocol":
      if (modification.injury) {
        return executeInjuryProtocol(supabase, userId, modification.injury, context);
      }
      break;

    case "swap_workout":
    case "skip_workout":
    case "reschedule":
    case "reduce_volume":
    case "add_rest_day":
    case "modify_intensity":
    case "travel_adjustment":
      if (modification.changes && modification.changes.length > 0) {
        await executeChanges(supabase, userId, modification.changes, context);
      }
      return {
        modified: true,
        description: modification.description || `Plan updated (${modification.type})`,
      };

    // ── Training philosophy ──
    case "adjust_overload_rate":
      return executeAdjustOverloadRate(supabase, userId, params, context);

    case "adjust_volume_target":
      return executeAdjustVolumeTarget(supabase, userId, params, context);

    case "shift_training_distribution":
      return executeShiftDistribution(supabase, userId, params, context);

    case "change_workout_mix":
      return executeChangeWorkoutMix(supabase, userId, params, context);

    // ── Sport distribution ──
    case "adjust_sport_ratios":
      return executeAdjustSportRatios(supabase, userId, params, context);

    case "add_brick_sessions":
      return executeAddBrickSessions(supabase, userId, params, context);

    case "focus_weakest_sport":
      return executeFocusWeakestSport(supabase, userId, context);

    // ── Plan structure ──
    case "modify_phase_duration":
      return executeModifyPhaseDuration(supabase, userId, params, context);

    case "change_day_assignment":
      return executeChangeDayAssignment(supabase, userId, params, context);

    case "temporary_schedule":
      return executeTemporarySchedule(supabase, userId, params, context);

    // ── Physiological updates ──
    case "update_ftp":
      return executeUpdateFtp(supabase, userId, params);

    case "update_run_zones":
      return executeUpdateRunZones(supabase, userId, params);

    case "update_swim_zones":
      return executeUpdateSwimZones(supabase, userId, params);

    // ── Race / goal ──
    case "add_race":
      return executeAddRace(supabase, userId, params, context);

    case "change_goal_time":
      return executeChangeGoalTime(supabase, userId, params);

    case "change_sport":
      return executeChangeSport(supabase, userId, params);

    // ── Recovery philosophy ──
    case "update_recovery_philosophy":
      return executeUpdateRecoveryPhilosophy(supabase, userId, params);
  }

  return { modified: false };
}

// ---------- Keyword Heuristic (Expanded) ----------

/**
 * Quick check if the message might request any kind of plan change.
 * Expanded to cover all new modification types.
 */
function mightRequestPlanChange(message: string): boolean {
  const lower = message.toLowerCase();

  const keywords = [
    // ── Swap / change (existing) ──
    "swap", "switch", "change", "replace", "instead",
    // ── Skip / cancel (existing) ──
    "skip", "cancel", "drop", "remove", "take off",
    // ── Move / reschedule (existing) ──
    "move", "reschedule", "shift", "push", "postpone", "delay",
    // ── Volume / intensity (existing) ──
    "easier", "harder", "less", "more", "reduce", "increase", "dial back", "ramp up",
    "lower", "lighter", "shorter", "longer",
    // ── Rest (existing) ──
    "rest day", "day off", "take a break", "need rest",
    // ── Injury (existing) ──
    "hurt", "injury", "injured", "sore", "pain", "strained", "pulled",
    "tweaked", "ache", "aching", "inflamed", "tendon", "knee", "ankle",
    "shoulder", "back", "hamstring", "calf", "shin",
    // ── Travel / life (existing) ──
    "travel", "trip", "vacation", "holiday", "busy", "can't make",
    "won't be able", "out of town", "conference", "work thing",

    // ── Training philosophy (NEW) ──
    "overload", "progressive", "aggressive", "conservative",
    "volume", "intensity", "distribution", "polarized",
    "easy runs", "intervals", "tempo", "threshold",
    "workout mix", "more easy", "fewer hard", "more hard",

    // ── Sport distribution (NEW) ──
    "swimming", "cycling", "biking", "running focus",
    "brick", "weakest", "discipline", "ratio",
    "swim more", "bike more", "run more",
    "swim less", "bike less", "run less",

    // ── Plan structure (NEW) ──
    "phase", "build phase", "taper", "base phase", "peak phase",
    "extend", "shorten", "long run to", "move my long",
    "only train", "days this week", "days next week",
    "add a rest", "insert rest",

    // ── Physiological (NEW) ──
    "ftp", "watts", "watt", "power zone",
    "pace zone", "pace per km", "min per km",
    "css", "critical swim", "swim pace",
    "half marathon", "marathon time", "10k time", "5k time",
    "pr ", "personal record", "personal best", " pb",
    "new best", "ran a ", "raced a",

    // ── Race / goal (NEW) ──
    "signed up", "new race", "registered",
    "target time", "goal time", "sub-", "sub ",
    "aiming for", "shooting for",
    "dropped the", "just doing", "only doing",
    "b-race", "b race", "tune-up race",

    // ── Recovery philosophy (NEW) ──
    "push me", "hold me back", "don't hold",
    "push harder", "push through",
    "more rest between", "rest between hard",
    "recover fast", "recovery approach",
    "yellow day", "green day", "red day",
    "spacing between",
  ];

  // P2-12: Require at least 2 keyword matches to reduce false positives
  // Single common words like "more", "less", "change" alone aren't enough
  const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
  return matchCount >= 2;
}

// ---------- Execute Standard Workout Changes (Existing) ----------

async function executeChanges(
  supabase: SupabaseClient,
  userId: string,
  changes: PlanChange[],
  context: CoachContext
): Promise<void> {
  const planId = context.plan?.id;

  for (const change of changes) {
    try {
      if (change.action === "update" && change.date) {
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
          const updates: Record<string, unknown> = { ...change.updates };
          await supabase
            .from("workouts")
            .update(updates)
            .eq("id", matchingWorkouts.id);
          console.log(`Updated workout ${matchingWorkouts.id} on ${change.date}:`, updates);
        } else {
          console.warn(`No matching workout for date=${change.date} type=${change.workout_type}`);
        }
      } else if (change.action === "create" && change.date && planId) {
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
        if (error) console.error(`Failed to create workout on ${change.date}:`, error);
        else console.log(`Created workout on ${change.date}: ${newWorkout.title}`);
      } else if (change.action === "delete" && change.date) {
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

// ---------- Injury Protocol (Existing) ----------

async function executeInjuryProtocol(
  supabase: SupabaseClient,
  userId: string,
  injury: { body_part: string; severity: "mild" | "moderate" | "severe" },
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysOut = addDays(today, 7);

    const { data: upcomingWorkouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_date", today)
      .lte("scheduled_date", sevenDaysOut)
      .order("scheduled_date", { ascending: true });

    if (!upcomingWorkouts || upcomingWorkouts.length === 0) {
      await storeLearnedPreference(supabase, userId, "limitations", [
        `${injury.body_part} injury (${injury.severity}) reported ${today}`,
      ]);
      return {
        modified: true,
        description: `Noted ${injury.body_part} ${injury.severity} injury. No upcoming workouts to modify.`,
      };
    }

    const bodyPart = injury.body_part.toLowerCase().replace(/\s+/g, "_");
    const affectedSports = INJURY_SPORT_MAP[bodyPart] || [];

    if (affectedSports.length === 0) {
      await storeLearnedPreference(supabase, userId, "limitations", [
        `${injury.body_part} injury (${injury.severity}) reported ${today}`,
      ]);
      return {
        modified: true,
        description: `Noted ${injury.body_part} injury. Please describe which activities are affected.`,
      };
    }

    let modifiedCount = 0;
    const modifications: string[] = [];

    for (const workout of upcomingWorkouts) {
      const workoutType = workout.workout_type?.toLowerCase();
      if (!affectedSports.includes(workoutType)) continue;

      if (injury.severity === "severe") {
        await supabase
          .from("workouts")
          .update({
            status: "skipped",
            coach_notes: `Skipped due to ${injury.body_part} injury (severe). Original: "${workout.title}".`,
          })
          .eq("id", workout.id);
        modifications.push(`Skipped ${workout.title} (${workout.scheduled_date})`);
      } else if (injury.severity === "moderate") {
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
          modifications.push(`Swapped ${workout.title} → ${altTitle} (${workout.scheduled_date})`);
        } else {
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
        const newIntensity = workout.intensity === "hard" || workout.intensity === "max" ? "moderate" : "easy";
        const reducedDuration = Math.round((workout.duration_minutes || 60) * 0.85);
        await supabase
          .from("workouts")
          .update({
            intensity: newIntensity,
            duration_minutes: reducedDuration,
            coach_notes: `Reduced intensity (${workout.intensity} → ${newIntensity}) due to mild ${injury.body_part} discomfort.`,
          })
          .eq("id", workout.id);
        modifications.push(`Eased ${workout.title} (${workout.scheduled_date})`);
      }
      modifiedCount++;
    }

    await storeLearnedPreference(supabase, userId, "limitations", [
      `${injury.body_part} injury (${injury.severity}) reported ${today}`,
    ]);

    const description =
      modifiedCount > 0
        ? `${capitalize(injury.severity)} ${injury.body_part} injury protocol: modified ${modifiedCount} workout${modifiedCount > 1 ? "s" : ""}. ${modifications.join("; ")}`
        : `Noted ${injury.body_part} injury — no affected workouts in the next 7 days.`;

    return { modified: true, description };
  } catch (error) {
    console.error("executeInjuryProtocol error:", error);
    return { modified: false };
  }
}

// ======================================================================
// NEW HANDLERS
// ======================================================================

// ---------- Training Philosophy Handlers ----------

async function executeAdjustOverloadRate(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const rate = (params.rate as string) || "moderate";
  const percentPerWeek = (params.percent_per_week as number) || (
    rate === "aggressive" ? 10 : rate === "conservative" ? 3 : 5
  );

  // Store in learned_preferences
  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `Progressive overload rate: ${rate} (~${percentPerWeek}% per week)`,
  ]);

  // Update plan_config if plan exists
  if (context.plan?.id) {
    const { data: plan } = await supabase
      .from("training_plans")
      .select("plan_config")
      .eq("id", context.plan.id)
      .single();

    if (plan?.plan_config) {
      const config = plan.plan_config as Record<string, unknown>;
      await supabase
        .from("training_plans")
        .update({
          plan_config: {
            ...config,
            overload_percent_per_week: percentPerWeek,
            overload_rate: rate,
          },
        })
        .eq("id", context.plan.id);
    }
  }

  return {
    modified: true,
    description: `Overload rate set to ${rate} (~${percentPerWeek}% weekly increase). Future weeks will reflect this.`,
  };
}

async function executeAdjustVolumeTarget(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const direction = (params.direction as string) || "increase";
  const percent = (params.percent as number) || 15;
  const explicitHours = params.weekly_hours as number | null;
  const factor = direction === "increase" ? 1 + percent / 100 : 1 - percent / 100;

  // Update profile weekly_hours_available if explicit hours given
  if (explicitHours) {
    await supabase
      .from("profiles")
      .update({ weekly_hours_available: Math.round(explicitHours) })
      .eq("id", userId);
  }

  // Scale upcoming scheduled workouts
  const today = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = addDays(today, 14);

  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, duration_minutes, distance_meters")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourteenDaysOut);

  let modifiedCount = 0;
  for (const w of upcoming || []) {
    const updates: Record<string, unknown> = {};
    if (w.duration_minutes) updates.duration_minutes = Math.round(w.duration_minutes * factor);
    if (w.distance_meters) updates.distance_meters = Math.round(w.distance_meters * factor);
    updates.coach_notes = `Volume ${direction}d by ${percent}% via chat request.`;

    await supabase.from("workouts").update(updates).eq("id", w.id);
    modifiedCount++;
  }

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `Prefers ${direction === "increase" ? "higher" : "lower"} training volume (${direction}d ${percent}%)`,
  ]);

  return {
    modified: true,
    description: `Volume ${direction}d by ${percent}% on ${modifiedCount} upcoming workouts.${explicitHours ? ` Weekly hours set to ${explicitHours}h.` : ""}`,
  };
}

async function executeShiftDistribution(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const focus = (params.focus as string) || "balanced";

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `Training distribution focus: ${focus}`,
  ]);

  // Modify upcoming workouts based on focus
  const today = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = addDays(today, 14);

  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, intensity, duration_minutes, title")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourteenDaysOut);

  let modifiedCount = 0;
  for (const w of upcoming || []) {
    const updates: Record<string, unknown> = {};

    if (focus === "more_intensity" || focus === "polarized") {
      // Easy stays easy but shorter, hard gets harder/longer
      if (w.intensity === "easy" && w.duration_minutes) {
        updates.duration_minutes = Math.round(w.duration_minutes * 0.85);
      } else if (w.intensity === "moderate") {
        updates.intensity = "hard";
      }
    } else if (focus === "more_volume") {
      // Make hard sessions moderate, increase easy duration
      if (w.intensity === "hard") {
        updates.intensity = "moderate";
      }
      if (w.intensity === "easy" && w.duration_minutes) {
        updates.duration_minutes = Math.round(w.duration_minutes * 1.15);
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.coach_notes = `Distribution shifted to ${focus} via chat request.`;
      await supabase.from("workouts").update(updates).eq("id", w.id);
      modifiedCount++;
    }
  }

  return {
    modified: true,
    description: `Training distribution shifted to ${focus}. Modified ${modifiedCount} upcoming workouts.`,
  };
}

async function executeChangeWorkoutMix(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const moreOf = (params.more_of as string[]) || [];
  const lessOf = (params.less_of as string[]) || [];

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `Workout mix preference: more ${moreOf.join(", ") || "N/A"}, fewer ${lessOf.join(", ") || "N/A"}`,
  ]);

  // Map keywords to intensity/title patterns
  const intensityMap: Record<string, string> = {
    easy: "easy",
    tempo: "moderate",
    threshold: "hard",
    intervals: "hard",
    long_run: "easy",
  };

  const today = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = addDays(today, 14);

  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, intensity, title, duration_minutes")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourteenDaysOut);

  let modifiedCount = 0;
  for (const w of upcoming || []) {
    const titleLower = (w.title || "").toLowerCase();
    const updates: Record<string, unknown> = {};

    // Check if this workout should be reduced/removed
    for (const less of lessOf) {
      if (
        titleLower.includes(less.replace("_", " ")) ||
        (intensityMap[less] && w.intensity === intensityMap[less] && less !== "easy")
      ) {
        // Convert to easy if reducing intervals/tempo/threshold
        if (less === "intervals" || less === "threshold") {
          updates.intensity = "easy";
          updates.title = "Easy Run";
          if (w.duration_minutes) updates.duration_minutes = Math.round(w.duration_minutes * 0.8);
          updates.coach_notes = `Converted from ${w.title} — fewer ${less} per athlete request.`;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("workouts").update(updates).eq("id", w.id);
      modifiedCount++;
    }
  }

  const changes = [
    moreOf.length > 0 ? `more ${moreOf.join(", ")}` : "",
    lessOf.length > 0 ? `fewer ${lessOf.join(", ")}` : "",
  ].filter(Boolean).join(", ");

  return {
    modified: true,
    description: `Workout mix updated: ${changes}. Modified ${modifiedCount} upcoming workouts.`,
  };
}

// ---------- Sport Distribution Handlers ----------

async function executeAdjustSportRatios(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const sport = (params.sport as string) || "";
  const direction = (params.direction as string) || "more";

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `Sport ratio: ${direction} ${sport}`,
  ]);

  // For triathlon athletes, swap some workouts of other sports to the requested sport
  const today = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = addDays(today, 14);

  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, workout_type, title, duration_minutes, scheduled_date")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourteenDaysOut)
    .order("scheduled_date", { ascending: true });

  if (!upcoming || upcoming.length === 0) {
    return { modified: true, description: `Sport ratio preference saved: ${direction} ${sport}. Will apply to future weeks.` };
  }

  let modifiedCount = 0;
  const otherSports = ["swim", "bike", "run"].filter((s) => s !== sport);

  if (direction === "more") {
    // Find non-key workouts of other sports and convert one to the target sport
    for (const w of upcoming) {
      if (
        otherSports.includes(w.workout_type) &&
        !isKeyWorkout(w.title) &&
        modifiedCount < 2
      ) {
        await supabase
          .from("workouts")
          .update({
            workout_type: sport,
            title: `Easy ${capitalize(sport)} Session`,
            description: `Swapped from ${w.workout_type} to increase ${sport} volume.`,
            coach_notes: `Sport ratio adjustment: more ${sport} per athlete request.`,
          })
          .eq("id", w.id);
        modifiedCount++;
      }
    }
  } else {
    // "less" — convert some workouts of this sport to alternatives
    for (const w of upcoming) {
      if (w.workout_type === sport && !isKeyWorkout(w.title) && modifiedCount < 2) {
        const altSport = otherSports[0] || "run";
        await supabase
          .from("workouts")
          .update({
            workout_type: altSport,
            title: `Easy ${capitalize(altSport)} Session`,
            description: `Swapped from ${sport} to reduce ${sport} volume.`,
            coach_notes: `Sport ratio adjustment: less ${sport} per athlete request.`,
          })
          .eq("id", w.id);
        modifiedCount++;
      }
    }
  }

  return {
    modified: true,
    description: `Sport ratio adjusted: ${direction} ${sport}. Swapped ${modifiedCount} workouts.`,
  };
}

async function executeAddBrickSessions(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const planId = context.plan?.id;
  if (!planId) {
    return { modified: false };
  }

  const count = (params.count as number) || 1;
  const today = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = addDays(today, 14);

  // Find easy/non-key workouts to convert to bricks
  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, workout_type, title, duration_minutes, scheduled_date")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourteenDaysOut)
    .order("scheduled_date", { ascending: true });

  let added = 0;
  for (const w of upcoming || []) {
    if (added >= count) break;
    // Convert easy bike or run to brick
    if ((w.workout_type === "bike" || w.workout_type === "run") && !isKeyWorkout(w.title)) {
      const brickDuration = Math.round((w.duration_minutes || 60) * 1.2);
      const bikeMin = Math.round(brickDuration * 0.65);
      const runMin = Math.round(brickDuration * 0.3);

      await supabase
        .from("workouts")
        .update({
          workout_type: "brick",
          title: "Brick: Ride + Run",
          description: `Bike: ${bikeMin} min at Zone 2\nTransition: Quick change (<5 min)\nRun: ${runMin} min at moderate effort\nFocus on finding your legs off the bike.`,
          duration_minutes: brickDuration,
          intensity: "moderate",
          coach_notes: `Added brick session per athlete request. Original: ${w.title}.`,
        })
        .eq("id", w.id);
      added++;
    }
  }

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    "Wants more brick workouts in training",
  ]);

  return {
    modified: true,
    description: `Added ${added} brick session${added > 1 ? "s" : ""} to upcoming schedule.`,
  };
}

async function executeFocusWeakestSport(
  supabase: SupabaseClient,
  userId: string,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  // Analyze recent workouts to find weakest discipline
  const recentCompleted = context.recentWorkouts.filter((w) => w.status === "completed");

  const sportMinutes: Record<string, number> = { swim: 0, bike: 0, run: 0 };
  for (const w of recentCompleted) {
    const type = w.workout_type?.toLowerCase();
    if (type && sportMinutes[type] !== undefined) {
      sportMinutes[type] += w.actual_duration_minutes || w.duration_minutes || 0;
    }
  }

  // Weakest = lowest total minutes (simple heuristic)
  const weakest = Object.entries(sportMinutes)
    .filter(([_, min]) => true)
    .sort(([, a], [, b]) => a - b)[0];

  if (!weakest) {
    return { modified: true, description: "Not enough recent data to determine weakest discipline." };
  }

  const weakSport = weakest[0];

  // Use the same logic as adjust_sport_ratios
  return executeAdjustSportRatios(
    supabase,
    userId,
    { sport: weakSport, direction: "more" },
    context
  );
}

// ---------- Plan Structure Handlers ----------

async function executeModifyPhaseDuration(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  if (!context.plan?.id) {
    return { modified: false };
  }

  const phase = (params.phase as string) || "build";
  const action = (params.action as string) || "extend";
  const weeks = (params.weeks as number) || 1;

  const { data: plan } = await supabase
    .from("training_plans")
    .select("plan_config")
    .eq("id", context.plan.id)
    .single();

  if (!plan?.plan_config) {
    return { modified: false };
  }

  const config = plan.plan_config as Record<string, unknown>;
  const phases = (config.phases as Array<{ name: string; weeks: number; volumeMultiplier: number; startWeek: number }>) || [];

  // Find and modify the target phase
  let modified = false;
  let adjustedWeeks = 0;
  for (const p of phases) {
    if (p.name === phase) {
      if (action === "extend") {
        p.weeks += weeks;
        adjustedWeeks = p.weeks;
      } else {
        p.weeks = Math.max(1, p.weeks - weeks);
        adjustedWeeks = p.weeks;
      }
      modified = true;
      break;
    }
  }

  if (!modified) {
    return { modified: true, description: `Phase "${phase}" not found in current plan.` };
  }

  // Recalculate startWeek for subsequent phases
  let weekCounter = 0;
  for (const p of phases) {
    p.startWeek = weekCounter;
    weekCounter += p.weeks;
  }

  await supabase
    .from("training_plans")
    .update({ plan_config: { ...config, phases } })
    .eq("id", context.plan.id);

  await storeLearnedPreference(supabase, userId, "training_philosophy", [
    `${capitalize(action)}ed ${phase} phase to ${adjustedWeeks} weeks`,
  ]);

  return {
    modified: true,
    description: `${capitalize(phase)} phase ${action}ed to ${adjustedWeeks} weeks. Future weeks will be generated accordingly.`,
  };
}

async function executeChangeDayAssignment(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const workoutPattern = (params.workout_pattern as string)?.toLowerCase() || "";
  const newDay = (params.new_day as string)?.toLowerCase() || "";

  if (!workoutPattern || !newDay) {
    return { modified: false };
  }

  const dayMap: Record<string, number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 0,
    mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
  };

  const targetDayNum = dayMap[newDay];
  if (targetDayNum === undefined) {
    return { modified: false };
  }

  // Find upcoming workouts matching the pattern
  const today = new Date().toISOString().split("T")[0];
  const fourWeeksOut = addDays(today, 28);

  const { data: upcoming } = await supabase
    .from("workouts")
    .select("id, title, scheduled_date")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", fourWeeksOut);

  let movedCount = 0;
  for (const w of upcoming || []) {
    if ((w.title || "").toLowerCase().includes(workoutPattern)) {
      // Calculate the new date: same week, different day
      const currentDate = new Date(w.scheduled_date);
      const currentDay = currentDate.getDay();
      const diff = targetDayNum - currentDay;
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + diff);
      const newDateStr = newDate.toISOString().split("T")[0];

      await supabase
        .from("workouts")
        .update({
          scheduled_date: newDateStr,
          coach_notes: `Moved from ${w.scheduled_date} to ${newDateStr} (${newDay}) per request.`,
        })
        .eq("id", w.id);
      movedCount++;
    }
  }

  // Update preferred training days in profile if applicable
  await storeLearnedPreference(supabase, userId, "schedule_constraints", [
    `${workoutPattern} should be on ${newDay}`,
  ]);

  return {
    modified: true,
    description: `Moved ${movedCount} "${workoutPattern}" workout${movedCount !== 1 ? "s" : ""} to ${capitalize(newDay)}.`,
  };
}

async function executeTemporarySchedule(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const targetDays = (params.days as number) || 3;
  const startDate = (params.start_date as string) || new Date().toISOString().split("T")[0];

  // Get this week's upcoming workouts
  const weekEnd = addDays(startDate, 7);

  const { data: weekWorkouts } = await supabase
    .from("workouts")
    .select("id, title, scheduled_date, intensity")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", weekEnd)
    .order("scheduled_date", { ascending: true });

  if (!weekWorkouts || weekWorkouts.length === 0) {
    return { modified: true, description: "No workouts found this week to adjust." };
  }

  const currentDays = weekWorkouts.length;
  const toRemove = Math.max(0, currentDays - targetDays);

  if (toRemove <= 0) {
    return { modified: true, description: `Already at ${currentDays} days this week — no changes needed.` };
  }

  // Sort by priority: skip easy non-key sessions first
  const sortedForRemoval = [...weekWorkouts].sort((a, b) => {
    const priorityA = isKeyWorkout(a.title) ? 10 : (a.intensity === "easy" ? 0 : 5);
    const priorityB = isKeyWorkout(b.title) ? 10 : (b.intensity === "easy" ? 0 : 5);
    return priorityA - priorityB;
  });

  let skippedCount = 0;
  for (let i = 0; i < toRemove && i < sortedForRemoval.length; i++) {
    await supabase
      .from("workouts")
      .update({
        status: "skipped",
        coach_notes: `Skipped — reduced to ${targetDays} training days this week per request.`,
      })
      .eq("id", sortedForRemoval[i].id);
    skippedCount++;
  }

  return {
    modified: true,
    description: `Reduced this week to ${targetDays} training days. Skipped ${skippedCount} session${skippedCount > 1 ? "s" : ""} (kept key workouts).`,
  };
}

// ---------- Physiological Update Handlers ----------

async function executeUpdateFtp(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  const ftpWatts = params.ftp_watts as number;
  if (!ftpWatts || ftpWatts < 50 || ftpWatts > 500) {
    return { modified: false };
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({ bike_ftp: ftpWatts })
    .eq("id", userId);

  // Recalculate power zones
  const newZones = calculateBikePowerZones(ftpWatts);

  // Update plan_config if active plan exists
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (plan?.plan_config) {
    const config = plan.plan_config as Record<string, unknown>;
    await supabase
      .from("training_plans")
      .update({
        plan_config: { ...config, bikePowerZones: newZones },
      })
      .eq("id", plan.id);
  }

  return {
    modified: true,
    description: `FTP updated to ${ftpWatts}W. Power zones recalculated: Z2 ${newZones.z2.min}-${newZones.z2.max}W, Z3 ${newZones.z3.min}-${newZones.z3.max}W, Z4 ${newZones.z4.min}-${newZones.z4.max}W. Future workouts will use new zones.`,
  };
}

async function executeUpdateRunZones(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  let pacePerKm = params.pace_per_km_seconds as number | null;
  const raceTime = params.race_time_seconds as number | null;
  const raceDistance = params.race_distance as string | null;

  // Calculate easy pace from race result if provided
  if (!pacePerKm && raceTime && raceDistance) {
    const distanceKm = parseRaceDistance(raceDistance);
    if (distanceKm && raceTime > 0) {
      const racePacePerKm = raceTime / distanceKm;
      // Easy pace ≈ race pace × 1.2-1.3 depending on distance
      const easyFactor = distanceKm >= 21 ? 1.15 : distanceKm >= 10 ? 1.2 : 1.25;
      pacePerKm = Math.round(racePacePerKm * easyFactor);
    }
  }

  if (!pacePerKm || pacePerKm < 180 || pacePerKm > 600) {
    return { modified: false };
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({ run_pace_per_km: pacePerKm })
    .eq("id", userId);

  // Recalculate pace zones
  const newZones = calculateRunPaceZones(pacePerKm);

  // Update plan_config
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (plan?.plan_config) {
    const config = plan.plan_config as Record<string, unknown>;
    await supabase
      .from("training_plans")
      .update({
        plan_config: { ...config, runPaceZones: newZones },
      })
      .eq("id", plan.id);
  }

  const easyPaceFormatted = formatPace(newZones.easy.min);
  const tempoPaceFormatted = formatPace(newZones.tempo.min);

  return {
    modified: true,
    description: `Run pace zones updated (easy pace: ${easyPaceFormatted}). Easy: ${formatPace(newZones.easy.min)}-${formatPace(newZones.easy.max)}, Tempo: ${tempoPaceFormatted}. Future workouts will use new paces.`,
  };
}

async function executeUpdateSwimZones(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  const pacePer100m = params.pace_per_100m_seconds as number;
  if (!pacePer100m || pacePer100m < 50 || pacePer100m > 300) {
    return { modified: false };
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({ swim_pace_per_100m: pacePer100m })
    .eq("id", userId);

  // Update plan_config
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, plan_config")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (plan?.plan_config) {
    const config = plan.plan_config as Record<string, unknown>;
    await supabase
      .from("training_plans")
      .update({
        plan_config: { ...config, swimPacePer100m: pacePer100m },
      })
      .eq("id", plan.id);
  }

  const formatted = formatSwimPace(pacePer100m);
  return {
    modified: true,
    description: `Swim pace updated to ${formatted}. Future swim workouts will use new targets.`,
  };
}

// ---------- Race / Goal Handlers ----------

async function executeAddRace(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  context: CoachContext
): Promise<{ modified: boolean; description?: string }> {
  const raceDate = params.race_date as string;
  const raceType = (params.race_type as string) || "race";
  const isBRace = (params.is_b_race as boolean) ?? true;

  if (!raceDate) {
    return { modified: false };
  }

  if (!isBRace) {
    // Primary race — update profile
    await supabase
      .from("profiles")
      .update({
        goal_race_date: raceDate,
        goal_race_type: raceType,
      })
      .eq("id", userId);

    // Update plan if exists
    if (context.plan?.id) {
      await supabase
        .from("training_plans")
        .update({
          goal_race_date: raceDate,
          goal_race_type: raceType,
          ends_at: raceDate,
        })
        .eq("id", context.plan.id);
    }

    return {
      modified: true,
      description: `New A-race set: ${raceType} on ${raceDate}. Plan periodization will target this date.`,
    };
  }

  // B-race: store in learned_preferences and add a taper hint
  await storeLearnedPreference(supabase, userId, "goals", [
    `B-race: ${raceType} on ${raceDate}`,
  ]);

  // Reduce volume 2-3 days before the B-race
  const twoDaysBefore = addDays(raceDate, -2);
  const dayBefore = addDays(raceDate, -1);

  const { data: preRaceWorkouts } = await supabase
    .from("workouts")
    .select("id, duration_minutes, distance_meters")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("scheduled_date", twoDaysBefore)
    .lte("scheduled_date", dayBefore);

  for (const w of preRaceWorkouts || []) {
    const updates: Record<string, unknown> = {
      intensity: "easy",
      coach_notes: `Pre-race taper for ${raceType} on ${raceDate}.`,
    };
    if (w.duration_minutes) updates.duration_minutes = Math.round(w.duration_minutes * 0.6);
    if (w.distance_meters) updates.distance_meters = Math.round(w.distance_meters * 0.6);
    await supabase.from("workouts").update(updates).eq("id", w.id);
  }

  return {
    modified: true,
    description: `B-race added: ${raceType} on ${raceDate}. Eased workouts before race day.`,
  };
}

async function executeChangeGoalTime(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  const goalTimeSeconds = params.goal_time_seconds as number;
  const raceType = params.race_type as string | null;

  if (!goalTimeSeconds || goalTimeSeconds < 600) {
    return { modified: false };
  }

  const updates: Record<string, unknown> = { goal_finish_time: goalTimeSeconds };
  if (raceType) {
    updates.goal_race_type = raceType;
  }

  await supabase.from("profiles").update(updates).eq("id", userId);

  // Update plan if exists
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (plan) {
    const planUpdates: Record<string, unknown> = { goal_finish_time: goalTimeSeconds };
    if (raceType) planUpdates.goal_race_type = raceType;
    await supabase.from("training_plans").update(planUpdates).eq("id", plan.id);
  }

  // Recalculate paces if we can infer them
  if (raceType) {
    const distanceKm = parseRaceDistance(raceType);
    if (distanceKm) {
      const racePace = goalTimeSeconds / distanceKm;
      const easyPace = Math.round(racePace * 1.2);
      await supabase.from("profiles").update({ run_pace_per_km: easyPace }).eq("id", userId);

      const newZones = calculateRunPaceZones(easyPace);
      if (plan?.id) {
        const { data: planData } = await supabase
          .from("training_plans")
          .select("plan_config")
          .eq("id", plan.id)
          .single();

        if (planData?.plan_config) {
          await supabase
            .from("training_plans")
            .update({
              plan_config: { ...(planData.plan_config as Record<string, unknown>), runPaceZones: newZones },
            })
            .eq("id", plan.id);
        }
      }
    }
  }

  const hours = Math.floor(goalTimeSeconds / 3600);
  const mins = Math.floor((goalTimeSeconds % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}:${mins.toString().padStart(2, "0")}` : `${mins} min`;

  return {
    modified: true,
    description: `Goal time updated to ${timeStr}${raceType ? ` for ${raceType}` : ""}. Paces recalculated.`,
  };
}

async function executeChangeSport(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  const newSport = params.new_sport as string;
  if (!newSport || !["running", "triathlon", "cycling", "swimming"].includes(newSport)) {
    return { modified: false };
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({ primary_sport: newSport })
    .eq("id", userId);

  // Cancel current plan (new plan will be regenerated)
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (plan) {
    await supabase
      .from("training_plans")
      .update({ status: "cancelled" })
      .eq("id", plan.id);
  }

  await storeLearnedPreference(supabase, userId, "life_context", [
    `Switched primary sport to ${newSport} on ${new Date().toISOString().split("T")[0]}`,
  ]);

  return {
    modified: true,
    description: `Primary sport changed to ${newSport}. Previous plan cancelled. A new ${newSport} plan will be generated on your next plan creation.`,
  };
}

// ---------- Recovery Philosophy Handler ----------

async function executeUpdateRecoveryPhilosophy(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<{ modified: boolean; description?: string }> {
  const approach = (params.approach as string) || "balanced";
  const details = (params.details as string) || "";

  // Map approach to preference updates
  const preferenceUpdates: Record<string, unknown> = {};

  switch (approach) {
    case "push_harder":
      preferenceUpdates.feedback_style = "push";
      preferenceUpdates.push_tolerance = 4;
      preferenceUpdates.recovery_needs = 2;
      break;
    case "more_rest":
      preferenceUpdates.feedback_style = "supportive";
      preferenceUpdates.push_tolerance = 2;
      preferenceUpdates.recovery_needs = 4;
      break;
    case "fast_recovery":
      preferenceUpdates.push_tolerance = 5;
      preferenceUpdates.recovery_needs = 1;
      break;
    case "conservative":
      preferenceUpdates.feedback_style = "supportive";
      preferenceUpdates.push_tolerance = 1;
      preferenceUpdates.recovery_needs = 5;
      break;
  }

  // Update preferences JSONB
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();

  const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
  await supabase
    .from("profiles")
    .update({
      preferences: { ...currentPrefs, ...preferenceUpdates },
    })
    .eq("id", userId);

  // Store in learned_preferences for context
  const philosophyNote = details
    ? `Recovery philosophy: ${approach} — ${details}`
    : `Recovery philosophy: ${approach}`;

  await storeLearnedPreference(supabase, userId, "recovery_notes", [philosophyNote]);

  const descriptions: Record<string, string> = {
    push_harder: "Recovery approach set to aggressive — will push through yellow days and only back off on red.",
    more_rest: "Recovery approach set to conservative — more rest between hard sessions, backing off on yellow days.",
    fast_recovery: "Recovery approach set for fast recoverer — less automatic backing-off, higher push tolerance.",
    conservative: "Recovery approach set to conservative — prioritizing health and sustainability.",
  };

  return {
    modified: true,
    description: descriptions[approach] || `Recovery philosophy updated: ${approach}.`,
  };
}

// ======================================================================
// HELPERS
// ======================================================================

/** Store a value in learned_preferences, handling deduplication */
async function storeLearnedPreference(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  values: string[]
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("learned_preferences")
      .eq("id", userId)
      .single();

    const current = (profile?.learned_preferences as Record<string, unknown>) || {};
    const existingValues: string[] = (current[key] as string[]) || [];

    // Remove entries that cover the same topic (simple substring match on key phrases)
    const updated = existingValues.filter((existing) => {
      return !values.some((newVal) => {
        const existNorm = existing.toLowerCase();
        const newNorm = newVal.toLowerCase();
        // Remove if same topic (first 3 words match or high word overlap)
        const existWords = existNorm.split(/\s+/).slice(0, 3).join(" ");
        const newWords = newNorm.split(/\s+/).slice(0, 3).join(" ");
        return existWords === newWords || existNorm.includes(newNorm) || newNorm.includes(existNorm);
      });
    });

    // Add new values
    updated.push(...values);

    await supabase
      .from("profiles")
      .update({
        learned_preferences: { ...current, [key]: updated },
      })
      .eq("id", userId);
  } catch (error) {
    console.error("storeLearnedPreference error:", error);
  }
}

function isKeyWorkout(title: string): boolean {
  const lower = (title || "").toLowerCase();
  return (
    lower.includes("long") ||
    lower.includes("race") ||
    lower.includes("tempo") ||
    lower.includes("threshold") ||
    lower.includes("interval") ||
    lower.includes("brick") ||
    lower.includes("key") ||
    lower.includes("vo2")
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function formatSwimPace(secPer100m: number): string {
  const min = Math.floor(secPer100m / 60);
  const sec = Math.round(secPer100m % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/100m`;
}

/** Parse common race distance strings to km */
function parseRaceDistance(distance: string): number | null {
  const lower = distance.toLowerCase().replace(/[_\s-]+/g, "");
  const distanceMap: Record<string, number> = {
    "5k": 5,
    "10k": 10,
    "15k": 15,
    "halfmarathon": 21.1,
    "half": 21.1,
    "marathon": 42.195,
    "ultra": 50,
    "50k": 50,
    "100k": 100,
    "sprinttri": 25.75, // rough combined
    "olympictri": 51.5,
    "70.3": 113,
    "ironman": 226,
  };

  for (const [key, km] of Object.entries(distanceMap)) {
    if (lower.includes(key)) return km;
  }

  return null;
}

// ---------- Plan Modification Proposal (for user confirmation) ----------

export interface PlanModificationProposal {
  type: ModificationType;
  description: string;
  summary: string; // Short summary for the UI card
  affectedDays: number; // Number of days/workouts affected
  params: Record<string, unknown>;
}

/**
 * Detect if a message requests a plan modification, returning a proposal for user confirmation.
 * Does NOT execute the modification — use executePlanModificationProposal for that.
 */
export async function detectPlanModification(
  userId: string,
  userMessage: string,
  coachResponse: string,
  context: CoachContext
): Promise<{ hasProposal: boolean; proposal?: PlanModificationProposal }> {
  try {
    // Quick heuristic: skip detection for very short messages
    if (userMessage.length < 10) {
      return { hasProposal: false };
    }

    // Quick keyword check — skip GPT call if message is clearly not a plan change
    if (!mightRequestPlanChange(userMessage)) {
      return { hasProposal: false };
    }

    const today = new Date().toISOString().split("T")[0];
    const contextSummary = formatContextForAI(context);

    const prompt = PLAN_MODIFICATION_PROMPT
      .replace("{today}", today)
      .replace("{context}", contextSummary);

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
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const modification: PlanModification = JSON.parse(content);

    if (!modification.needed || !modification.type) {
      return { hasProposal: false };
    }

    // Build a user-friendly summary
    const summary = buildModificationSummary(modification);

    return {
      hasProposal: true,
      proposal: {
        type: modification.type,
        description: modification.description || `Modify plan (${modification.type})`,
        summary,
        affectedDays: estimateAffectedDays(modification),
        params: modification.params || {},
      },
    };
  } catch (error) {
    console.error("detectPlanModification error:", error);
    return { hasProposal: false };
  }
}

/**
 * Execute a previously-detected plan modification proposal.
 */
export async function executePlanModificationProposal(
  userId: string,
  proposal: PlanModificationProposal,
  context: CoachContext
): Promise<{ success: boolean; description?: string }> {
  try {
    const serviceSupabase = getServiceSupabase();

    // Reconstruct the modification object for the router
    const modification: PlanModification = {
      needed: true,
      type: proposal.type,
      description: proposal.description,
      params: proposal.params,
    };

    const result = await routeModification(
      serviceSupabase,
      userId,
      modification,
      context
    );

    if (result.modified) {
      console.log(`Executed plan modification [${proposal.type}] for user ${userId}`);
    }

    return { success: result.modified, description: result.description };
  } catch (error) {
    console.error("executePlanModificationProposal error:", error);
    return { success: false };
  }
}

function buildModificationSummary(mod: PlanModification): string {
  switch (mod.type) {
    case "add_brick_sessions":
      return "Add brick workouts (bike + run) to your training";
    case "change_day_assignment":
      return "Update which days you do specific workout types";
    case "adjust_sport_ratios":
      return "Adjust time distribution between swim/bike/run";
    case "adjust_volume_target":
      return "Change your weekly training volume target";
    case "modify_phase_duration":
      return "Adjust the length of your training phases";
    case "injury_protocol":
      return "Modify training around your injury";
    case "add_rest_day":
      return "Add additional rest days";
    case "reduce_volume":
      return "Reduce your training volume";
    case "travel_adjustment":
      return "Adjust plan for travel period";
    case "change_goal_time":
      return "Update your race goal time";
    case "focus_weakest_sport":
      return "Shift focus to your weakest discipline";
    default:
      return mod.description || "Update your training plan";
  }
}

function estimateAffectedDays(mod: PlanModification): number {
  // Estimate based on modification type
  switch (mod.type) {
    case "add_brick_sessions":
    case "change_day_assignment":
    case "adjust_sport_ratios":
      return 8; // ~2 months of weeks
    case "injury_protocol":
    case "travel_adjustment":
      return 7; // typically a week
    case "add_rest_day":
    case "skip_workout":
    case "reschedule":
      return 1;
    case "adjust_volume_target":
    case "modify_phase_duration":
      return 14;
    default:
      return 4;
  }
}
