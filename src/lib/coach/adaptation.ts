import { SupabaseClient } from "@supabase/supabase-js";

// ---------- Types ----------

export interface AdaptationAction {
  type:
    | "modify_workout"
    | "swap_workout"
    | "skip_workout"
    | "add_rest_day"
    | "adjust_volume";
  workoutId?: string;
  changes?: Record<string, unknown>;
  reason: string;
}

export interface AdaptationResult {
  actions: AdaptationAction[];
  message?: string; // chat message to send the athlete
}

interface WorkoutRow {
  id: string;
  scheduled_date: string;
  workout_type: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  distance_meters?: number;
  status: string;
  intensity?: string;
  coach_notes?: string;
  actual_duration_minutes?: number;
  actual_distance_meters?: number;
  actual_data?: Record<string, unknown>;
}

interface ProfilePreferences {
  feedback_style?: string;
  [key: string]: unknown;
}

type CoachingStyle = "supportive" | "balanced" | "push";

// ---------- Helpers ----------

function getCoachingStyle(preferences: ProfilePreferences | null): CoachingStyle {
  const style = preferences?.feedback_style;
  if (style === "supportive" || style === "balanced" || style === "push") {
    return style;
  }
  return "balanced";
}

function isKeySession(workout: WorkoutRow): boolean {
  const title = (workout.title || "").toLowerCase();
  const type = (workout.workout_type || "").toLowerCase();
  const duration = workout.duration_minutes || 0;

  return (
    type === "brick" ||
    title.includes("long") ||
    title.includes("race") ||
    title.includes("tempo") ||
    title.includes("threshold") ||
    title.includes("interval") ||
    title.includes("brick") ||
    title.includes("key") ||
    duration > 90
  );
}

function isHardSession(workout: WorkoutRow): boolean {
  const title = (workout.title || "").toLowerCase();
  return (
    isKeySession(workout) ||
    title.includes("hard") ||
    title.includes("speed") ||
    title.includes("fartlek") ||
    title.includes("vo2") ||
    title.includes("hill")
  );
}

function getRecoveryZone(score: number): "red" | "yellow" | "green" {
  if (score < 33) return "red";
  if (score < 66) return "yellow";
  return "green";
}

function reduceVolume(
  workout: WorkoutRow,
  reductionPct: number
): Record<string, unknown> {
  const factor = 1 - reductionPct / 100;
  const changes: Record<string, unknown> = {};

  if (workout.duration_minutes) {
    changes.duration_minutes = Math.round(workout.duration_minutes * factor);
  }
  if (workout.distance_meters) {
    changes.distance_meters = Math.round(workout.distance_meters * factor);
  }

  return changes;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterday(): string {
  return addDays(getToday(), -1);
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

// ---------- Post-Workout Adaptation ----------

/**
 * Called after a Strava activity is processed.
 * Compares actual vs prescribed and decides if future workouts need adjustment.
 */
export async function adaptAfterWorkout(
  supabase: SupabaseClient,
  userId: string,
  completedWorkout: WorkoutRow | null,
  actualData: Record<string, unknown>
): Promise<AdaptationResult> {
  const actions: AdaptationAction[] = [];
  const messageParts: string[] = [];

  try {
    // No prescribed workout → unscheduled activity, skip comparison
    if (!completedWorkout || !completedWorkout.duration_minutes) {
      return { actions: [] };
    }

    // Fetch preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const style = getCoachingStyle(profile?.preferences);

    // Fetch upcoming workouts (next 3 days)
    const today = getToday();
    const threeDaysOut = addDays(today, 3);
    const { data: upcoming } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_date", today)
      .lte("scheduled_date", threeDaysOut)
      .order("scheduled_date", { ascending: true });

    const upcomingWorkouts: WorkoutRow[] = (upcoming || []) as WorkoutRow[];

    // Fetch latest recovery
    const { data: latestRecovery } = await supabase
      .from("recovery_data")
      .select("recovery_score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const recoveryScore: number | null = latestRecovery?.recovery_score ?? null;

    // --- Compare actual vs prescribed ---

    const prescribedDuration = completedWorkout.duration_minutes;
    const actualDuration =
      typeof actualData.duration_minutes === "number"
        ? actualData.duration_minutes
        : 0;

    const durationDiffPct =
      prescribedDuration > 0
        ? ((actualDuration - prescribedDuration) / prescribedDuration) * 100
        : 0;

    // Case 1: Over-duration (>20% longer)
    if (durationDiffPct > 20) {
      const note = buildOverDurationNote(style, durationDiffPct);
      messageParts.push(note);
      // Don't auto-escalate future workouts — just note it
    }

    // Case 2: Significantly worse performance (duration much shorter or pace much slower)
    if (durationDiffPct < -20) {
      // Possible fatigue — check recovery
      if (recoveryScore !== null && recoveryScore < 50) {
        // Confirmed fatigue: ease off next session
        const nextHard = upcomingWorkouts.find(isHardSession);
        if (nextHard) {
          const volumeChanges = reduceVolume(nextHard, 20);
          actions.push({
            type: "modify_workout",
            workoutId: nextHard.id,
            changes: {
              ...volumeChanges,
              coach_notes: `Reduced volume (${nextHard.duration_minutes}min → ${volumeChanges.duration_minutes}min) — recovery was low and last session was cut short.`,
            },
            reason: "Under-performance + low recovery → reduce next hard session",
          });
          messageParts.push(
            buildUnderPerformanceNote(style, nextHard.title)
          );
        }
      }
    }

    // Case 3: Overperformance detection — increase load if consistently beating targets
    // Only check if we're not already reducing load (avoid conflicting adaptations)
    if (actions.length === 0) {
      const sevenDaysAgo = addDays(today, -7);
      const { data: recentCompleted } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("scheduled_date", sevenDaysAgo)
        .lte("scheduled_date", today);

      const completedRecent = (recentCompleted || []) as WorkoutRow[];

      // Count workouts where actual exceeded prescribed by >10%
      let overperformCount = 0;
      for (const w of completedRecent) {
        if (!w.duration_minutes || !w.actual_duration_minutes) continue;
        const ratio =
          (w.actual_duration_minutes - w.duration_minutes) / w.duration_minutes;
        if (ratio > 0.1) {
          overperformCount++;
        }
      }

      if (overperformCount >= 3) {
        // Style-aware increase percentage
        const increaseMap: Record<CoachingStyle, number> = {
          push: 10,
          balanced: 7,
          supportive: 5,
        };
        const increasePct = increaseMap[style];
        const factor = 1 + increasePct / 100;

        // Find next upcoming workout of the same type
        const { data: nextSimilar } = await supabase
          .from("workouts")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .eq("workout_type", completedWorkout.workout_type)
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(1);

        const nextWorkout = (nextSimilar || [])[0] as WorkoutRow | undefined;

        if (nextWorkout) {
          const changes: Record<string, unknown> = {};
          if (nextWorkout.duration_minutes) {
            changes.duration_minutes = Math.round(
              nextWorkout.duration_minutes * factor
            );
          }
          if (nextWorkout.distance_meters) {
            changes.distance_meters = Math.round(
              nextWorkout.distance_meters * factor
            );
          }
          changes.coach_notes = `Increased prescription by ${increasePct}% — you've been consistently exceeding targets. Time to raise the bar! 📈`;

          actions.push({
            type: "modify_workout",
            workoutId: nextWorkout.id,
            changes,
            reason: `Overperformance (${overperformCount} workouts exceeded targets in last 7 days) → increase next ${completedWorkout.workout_type} by ${increasePct}%`,
          });

          messageParts.push(
            buildOverperformanceNote(
              style,
              completedWorkout.workout_type,
              increasePct
            )
          );
        }
      }
    }

    // Case 4: Wrong workout type — flexible approach, just log it
    // (The webhook already handles unmatched types by creating a new workout entry,
    //  so no action needed here)

    const message =
      messageParts.length > 0 ? messageParts.join("\n\n") : undefined;
    return { actions, message };
  } catch (error) {
    console.error("adaptAfterWorkout error:", error);
    return { actions: [] };
  }
}

// ---------- Recovery-Based Adaptation ----------

/**
 * Called when new recovery data arrives.
 * Checks if today's/tomorrow's workout needs modification based on recovery score.
 */
export async function adaptForRecovery(
  supabase: SupabaseClient,
  userId: string,
  recoveryData: {
    recovery_score: number;
    hrv_ms?: number;
    sleep_hours?: number;
  }
): Promise<AdaptationResult> {
  const actions: AdaptationAction[] = [];
  const messageParts: string[] = [];

  try {
    const zone = getRecoveryZone(recoveryData.recovery_score);

    // GREEN → no changes
    if (zone === "green") {
      return { actions: [] };
    }

    // Fetch preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const style = getCoachingStyle(profile?.preferences);

    // YELLOW + push → no changes
    if (zone === "yellow" && style === "push") {
      return { actions: [] };
    }

    // Fetch today's and tomorrow's workouts
    const today = getToday();
    const tomorrow = addDays(today, 1);
    const twoDaysOut = addDays(today, 2);

    const { data: soonWorkouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_date", today)
      .lte("scheduled_date", twoDaysOut)
      .order("scheduled_date", { ascending: true });

    const workouts: WorkoutRow[] = (soonWorkouts || []) as WorkoutRow[];

    if (workouts.length === 0) {
      return { actions: [] };
    }

    if (zone === "red") {
      // RED: Always back off. Swap hard sessions for easy/rest. Reduce next 2 days by 30%.
      for (const w of workouts) {
        if (isHardSession(w)) {
          actions.push({
            type: "swap_workout",
            workoutId: w.id,
            changes: {
              title: `Easy Recovery ${w.workout_type === "run" ? "Run" : w.workout_type === "bike" ? "Ride" : "Session"}`,
              description: `Swapped from "${w.title}" due to red recovery (${recoveryData.recovery_score}%). Easy effort only — Zone 1-2, keep it short and comfortable.`,
              ...reduceVolume(w, 30),
              coach_notes: `Original: "${w.title}" (${w.duration_minutes}min). Swapped to easy recovery — recovery score ${recoveryData.recovery_score}%.`,
            },
            reason: `Red recovery (${recoveryData.recovery_score}%) → swap hard session for easy`,
          });
        } else {
          // Even easy sessions get volume reduction
          const volumeChanges = reduceVolume(w, 30);
          actions.push({
            type: "modify_workout",
            workoutId: w.id,
            changes: {
              ...volumeChanges,
              coach_notes: `Reduced volume by 30% — recovery score ${recoveryData.recovery_score}%.`,
            },
            reason: `Red recovery (${recoveryData.recovery_score}%) → reduce volume`,
          });
        }
      }

      messageParts.push(buildRedRecoveryNote(style, recoveryData.recovery_score));
    } else if (zone === "yellow") {
      // YELLOW: style-dependent
      if (style === "supportive") {
        // Suggest easier alternative for hard sessions
        const nextHard = workouts.find(isHardSession);
        if (nextHard) {
          actions.push({
            type: "swap_workout",
            workoutId: nextHard.id,
            changes: {
              title: `Easy ${nextHard.workout_type === "run" ? "Run" : nextHard.workout_type === "bike" ? "Ride" : "Session"} (adjusted)`,
              description: `Swapped from "${nextHard.title}" — recovery is a bit low (${recoveryData.recovery_score}%). Let's take it easy today and come back stronger.`,
              ...reduceVolume(nextHard, 20),
              coach_notes: `Supportive adaptation: swapped hard session for easy — yellow recovery (${recoveryData.recovery_score}%).`,
            },
            reason: `Yellow recovery + supportive style → swap hard session`,
          });
        }
        messageParts.push(buildYellowRecoverySupportiveNote(recoveryData.recovery_score));
      } else if (style === "balanced") {
        // Minor volume reduction (-10%) on all upcoming
        for (const w of workouts) {
          const volumeChanges = reduceVolume(w, 10);
          actions.push({
            type: "modify_workout",
            workoutId: w.id,
            changes: {
              ...volumeChanges,
              coach_notes: `Minor volume reduction (-10%) — yellow recovery (${recoveryData.recovery_score}%).`,
            },
            reason: `Yellow recovery + balanced style → minor volume reduction`,
          });
        }
        messageParts.push(buildYellowRecoveryBalancedNote(recoveryData.recovery_score));
      }
      // push style: already returned above
    }

    const message =
      messageParts.length > 0 ? messageParts.join("\n\n") : undefined;
    return { actions, message };
  } catch (error) {
    console.error("adaptForRecovery error:", error);
    return { actions: [] };
  }
}

// ---------- Missed Workout Detection ----------

/**
 * Called daily to check for missed workouts from yesterday.
 * Decides whether to reschedule key sessions or just skip.
 */
export async function handleMissedWorkouts(
  supabase: SupabaseClient,
  userId: string
): Promise<AdaptationResult> {
  const actions: AdaptationAction[] = [];
  const messageParts: string[] = [];

  try {
    const yesterday = getYesterday();

    // Find yesterday's workouts still in 'scheduled' status (missed)
    const { data: missedRaw } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .eq("scheduled_date", yesterday)
      .eq("status", "scheduled");

    const missed: WorkoutRow[] = (missedRaw || []) as WorkoutRow[];

    if (missed.length === 0) {
      return { actions: [] };
    }

    // Fetch preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const style = getCoachingStyle(profile?.preferences);

    // Count weekly misses (Mon-Sun of current week)
    const today = getToday();
    const monday = getMondayOfWeek(today);
    const { data: weekWorkouts } = await supabase
      .from("workouts")
      .select("status, scheduled_date")
      .eq("user_id", userId)
      .gte("scheduled_date", monday)
      .lte("scheduled_date", today);

    const weekMissed = (weekWorkouts || []).filter(
      (w) => (w.status === "scheduled" && (w as any).scheduled_date < today) || w.status === "skipped"
    );
    const weeklyMissCount = weekMissed.length;

    // Mark missed workouts
    for (const workout of missed) {
      if (isKeySession(workout)) {
        // Key session: try to reschedule within 2 days
        const rescheduleDate = await findRescheduleSlot(
          supabase,
          userId,
          today,
          2
        );

        if (rescheduleDate) {
          actions.push({
            type: "modify_workout",
            workoutId: workout.id,
            changes: {
              scheduled_date: rescheduleDate,
              coach_notes: `Rescheduled from ${yesterday} — this is a key session we don't want to skip.`,
            },
            reason: `Key session missed → reschedule to ${rescheduleDate}`,
          });
          messageParts.push(
            buildMissedKeySessionNote(style, workout.title, rescheduleDate)
          );
        } else {
          // No slot available, skip
          actions.push({
            type: "skip_workout",
            workoutId: workout.id,
            changes: {
              status: "skipped",
              coach_notes: `Missed on ${yesterday}. Couldn't reschedule within 2 days — moving on.`,
            },
            reason: "Key session missed, no slot to reschedule",
          });
        }
      } else {
        // Non-key session: skip, don't pile on
        actions.push({
          type: "skip_workout",
          workoutId: workout.id,
          changes: {
            status: "skipped",
            coach_notes: `Missed on ${yesterday}. Skipping — no need to make it up.`,
          },
          reason: "Non-key session missed → skip",
        });
      }
    }

    // 3+ missed in a week: reduce next week's volume + send check-in
    if (weeklyMissCount >= 3) {
      const nextWeekMonday = addDays(monday, 7);
      const nextWeekSunday = addDays(nextWeekMonday, 6);

      const { data: nextWeekWorkouts } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .gte("scheduled_date", nextWeekMonday)
        .lte("scheduled_date", nextWeekSunday);

      for (const w of (nextWeekWorkouts || []) as WorkoutRow[]) {
        const volumeChanges = reduceVolume(w, 20);
        actions.push({
          type: "adjust_volume",
          workoutId: w.id,
          changes: {
            ...volumeChanges,
            coach_notes: `Volume reduced 20% — missed ${weeklyMissCount} sessions this week. Adjusting to a more manageable load.`,
          },
          reason: `3+ missed sessions this week → reduce next week volume`,
        });
      }

      messageParts.push(buildMultipleMissedNote(style, weeklyMissCount));
    }

    const message =
      messageParts.length > 0 ? messageParts.join("\n\n") : undefined;
    return { actions, message };
  } catch (error) {
    console.error("handleMissedWorkouts error:", error);
    return { actions: [] };
  }
}

// ---------- Execute Adaptation Actions ----------

/**
 * Execute the actions returned by an adaptation function.
 * Updates workout rows and optionally inserts a chat message.
 */
export async function executeAdaptationActions(
  supabase: SupabaseClient,
  userId: string,
  result: AdaptationResult
): Promise<void> {
  try {
    for (const action of result.actions) {
      if (!action.workoutId || !action.changes) continue;

      switch (action.type) {
        case "modify_workout":
        case "swap_workout":
        case "adjust_volume":
          await supabase
            .from("workouts")
            .update(action.changes)
            .eq("id", action.workoutId);
          break;

        case "skip_workout":
          await supabase
            .from("workouts")
            .update({ status: "skipped", ...(action.changes || {}) })
            .eq("id", action.workoutId);
          break;

        case "add_rest_day":
          await supabase
            .from("workouts")
            .update({
              status: "skipped",
              coach_notes: action.reason,
              ...(action.changes || {}),
            })
            .eq("id", action.workoutId);
          break;
      }

      console.log(
        `Adaptation [${action.type}] workout ${action.workoutId}: ${action.reason}`
      );
    }

    // Send chat message if adaptation generated one
    if (result.message) {
      await supabase.from("chat_messages").insert({
        user_id: userId,
        role: "assistant",
        content: result.message,
        message_type: "plan_adjustment",
      });
    }
  } catch (error) {
    console.error("executeAdaptationActions error:", error);
  }
}

// ---------- Internal Helpers ----------

/**
 * Find an open slot within `daysAhead` to reschedule a workout.
 * Returns the date string or null if no slot is available.
 */
async function findRescheduleSlot(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string,
  daysAhead: number
): Promise<string | null> {
  for (let i = 0; i <= daysAhead; i++) {
    const candidate = addDays(fromDate, i);

    const { data: existing } = await supabase
      .from("workouts")
      .select("id, title, workout_type, duration_minutes")
      .eq("user_id", userId)
      .eq("scheduled_date", candidate)
      .eq("status", "scheduled");

    // Slot is open if no hard sessions already scheduled
    const hasHard = ((existing || []) as WorkoutRow[]).some(isHardSession);
    if (!hasHard) {
      return candidate;
    }
  }
  return null;
}

// ---------- Message Templates (Style-Aware) ----------

function buildOverDurationNote(style: CoachingStyle, diffPct: number): string {
  const pct = Math.round(diffPct);
  switch (style) {
    case "supportive":
      return `Wow, you went ${pct}% longer than prescribed today! 💪 That enthusiasm is amazing, but let's make sure we're not overdoing it. Your body needs recovery to adapt — trust the plan and save some energy for the key sessions ahead.`;
    case "push":
      return `Extra ${pct}% on top of the prescription — I see you. Just make sure tomorrow's session doesn't suffer for it. Smart training beats hard training every time.`;
    case "balanced":
    default:
      return `You went about ${pct}% longer than prescribed today. Good effort — just be mindful that consistency at the right volume matters more than big individual days. Keep tomorrow's session honest.`;
  }
}

function buildUnderPerformanceNote(
  style: CoachingStyle,
  nextWorkoutTitle: string
): string {
  switch (style) {
    case "supportive":
      return `Not every session is going to feel great, and that's totally okay! 💙 Your recovery numbers are low, so I've eased up "${nextWorkoutTitle}" to give your body what it needs. Rest up — you'll bounce back.`;
    case "push":
      return `Numbers were off today. Recovery data confirms fatigue, so I've dialed back "${nextWorkoutTitle}". Not a pass — just loading you smarter. We're coming back harder after this.`;
    case "balanced":
    default:
      return `Today's session was tougher than expected, and your recovery data backs that up. I've scaled back "${nextWorkoutTitle}" to keep things on track. We'll build back up once you're fresh.`;
  }
}

function buildRedRecoveryNote(
  style: CoachingStyle,
  score: number
): string {
  switch (style) {
    case "supportive":
      return `Your body is telling us it needs rest — recovery is at ${score}%. I've adjusted your upcoming workouts, no hard sessions until you're back in the green. Take care of yourself! ❤️ This is how we stay healthy long-term.`;
    case "push":
      return `Recovery at ${score}% — red zone. Not the time to push through. I've scaled back the next 2 days. Trust the process: rest now, attack later. You'll thank me when you're flying next week.`;
    case "balanced":
    default:
      return `Recovery is at ${score}%, which is low. I've modified your next couple of sessions to easier efforts and reduced volume by 30%. We'll get back to intensity when your body's ready — no sense digging a hole.`;
  }
}

function buildYellowRecoverySupportiveNote(score: number): string {
  return `Recovery is looking a bit low today (${score}%). I've swapped your next hard session for something easier — better safe than sorry! 💛 Listen to your body and we'll push when you're feeling good.`;
}

function buildYellowRecoveryBalancedNote(score: number): string {
  return `Yellow recovery today (${score}%). Made a minor adjustment — volume is down 10% on your upcoming sessions. Nothing drastic, just smart planning. We're still moving forward.`;
}

function buildMissedKeySessionNote(
  style: CoachingStyle,
  workoutTitle: string,
  newDate: string
): string {
  switch (style) {
    case "supportive":
      return `I noticed you missed "${workoutTitle}" yesterday — no worries, life happens! I've moved it to ${newDate} since it's an important session for your plan. You've got this! 💪`;
    case "push":
      return `"${workoutTitle}" didn't happen yesterday. That's a key session, so I've rescheduled it to ${newDate}. Don't miss it twice — this one matters.`;
    case "balanced":
    default:
      return `I've moved "${workoutTitle}" to ${newDate}. This is a key session in your plan, so I didn't want to just skip it. Let's make it count.`;
  }
}

function buildMultipleMissedNote(
  style: CoachingStyle,
  missedCount: number
): string {
  switch (style) {
    case "supportive":
      return `Hey, I noticed you've missed ${missedCount} sessions this week. Everything okay? 💙 Life gets in the way sometimes, and that's completely fine. I've adjusted next week to be a bit lighter so we can ease back in and build momentum again.`;
    case "push":
      return `${missedCount} missed sessions this week. That's a pattern we need to break. I've reduced next week's volume — not as a reward, but because we need to reset and actually get the work done. Consistency is what separates good athletes from great ones.`;
    case "balanced":
    default:
      return `You've missed ${missedCount} sessions this week. I've reduced next week's volume by 20% to make it more manageable. Let's regroup and get back on track — a lighter week done consistently beats a big week half-completed.`;
  }
}

function buildOverperformanceNote(
  style: CoachingStyle,
  workoutType: string,
  increasePct: number
): string {
  const typeLabel = workoutType === "run" ? "running" : workoutType === "bike" ? "cycling" : workoutType;
  switch (style) {
    case "supportive":
      return `You've been crushing it lately! 🔥 Your ${typeLabel} sessions have consistently exceeded what I prescribed, so I've bumped up your next ${typeLabel} workout by ${increasePct}%. You've earned this — keep up the amazing work!`;
    case "push":
      return `Numbers don't lie — you've been outperforming your prescriptions on ${typeLabel}. I've increased your next ${typeLabel} session by ${increasePct}%. The old targets were too easy. Let's see what you're really made of. 🚀`;
    case "balanced":
    default:
      return `I've noticed you've been consistently exceeding your ${typeLabel} targets — great work! 📈 I've bumped up your next ${typeLabel} workout by ${increasePct}% to keep the challenge appropriate. You're ready for it.`;
  }
}
