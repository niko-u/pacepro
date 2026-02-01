import OpenAI from "openai";
import { 
  COACH_SYSTEM_PROMPT, 
  WORKOUT_ANALYSIS_PROMPT, 
  WEEKLY_OUTLOOK_PROMPT,
  PREFERENCE_EXTRACTION_PROMPT,
  DAILY_CHECKIN_PROMPT,
  RECOVERY_ALERT_PROMPT,
  buildCoachSystemPrompt,
} from "./prompts";
import { CoachContext, formatContextForAI } from "./context";
import { trackAiUsage, AiCallType } from "./usage";

// Lazy-load OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Build the dynamic system prompt from athlete context.
 * Extracts preferences, sport, and goals from the context to personalize the prompt.
 */
function buildDynamicPrompt(context: CoachContext): string {
  return buildCoachSystemPrompt(
    {
      ...(context.athlete.preferences || {}),
      sport: context.athlete.primary_sport,
      goals: context.athlete.goal_race_type,
    },
    {
      stravaConnected: context.stravaConnected,
      whoopConnected: context.whoopConnected,
      conversationLength: context.conversation?.length ?? 0,
    }
  );
}

/** Helper to log usage from an OpenAI response */
function logUsage(
  userId: string,
  callType: AiCallType,
  response: OpenAI.Chat.Completions.ChatCompletion
): void {
  if (response.usage) {
    trackAiUsage({
      userId,
      callType,
      model: response.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });
  }
}

/**
 * Main chat completion with coach persona
 */
export async function coachChat(
  context: CoachContext,
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      // Include recent conversation history
      ...messages.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  logUsage(context.athlete.id, "chat", response);

  return response.choices[0]?.message?.content || "I'm here to help! What's on your mind?";
}

/**
 * Analyze a completed workout.
 * Accepts optional structured analytics from the analytics engine.
 */
export async function analyzeWorkout(
  context: CoachContext,
  prescribed: Record<string, unknown>,
  actual: Record<string, unknown>,
  analytics?: Record<string, unknown> | null
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  // Build enriched workout data for the AI
  const workoutData: Record<string, unknown> = { prescribed, actual };

  if (analytics) {
    const analyticsContext: string[] = [];

    // HR zone distribution
    if (analytics.hrZones && typeof analytics.hrZones === "object") {
      const hz = analytics.hrZones as Record<string, number>;
      analyticsContext.push(`HR Zone Distribution: Z1=${hz.z1}% Z2=${hz.z2}% Z3=${hz.z3}% Z4=${hz.z4}% Z5=${hz.z5}%`);
    }

    // Pace zones
    if (analytics.paceZones && typeof analytics.paceZones === "object") {
      const pz = analytics.paceZones as Record<string, number>;
      const parts = Object.entries(pz).map(([k, v]) => `${k}=${v}%`).join(" ");
      analyticsContext.push(`Pace Zone Distribution: ${parts}`);
    }

    // Power zones
    if (analytics.powerZones && typeof analytics.powerZones === "object") {
      const pwz = analytics.powerZones as Record<string, number>;
      const parts = Object.entries(pwz).map(([k, v]) => `${k}=${v}%`).join(" ");
      analyticsContext.push(`Power Zone Distribution: ${parts}`);
    }

    // Core metrics
    if (analytics.trainingStressScore) analyticsContext.push(`Training Stress Score: ${analytics.trainingStressScore}`);
    if (analytics.normalizedPower) analyticsContext.push(`Normalized Power: ${analytics.normalizedPower}W`);
    if (analytics.normalizedGradedPace) analyticsContext.push(`Normalized Graded Pace: ${formatSecPerKm(analytics.normalizedGradedPace as number)}`);
    if (analytics.intensityFactor) analyticsContext.push(`Intensity Factor: ${analytics.intensityFactor}`);
    if (analytics.variabilityIndex) analyticsContext.push(`Variability Index: ${analytics.variabilityIndex}`);
    if (analytics.efficiencyFactor) analyticsContext.push(`Efficiency Factor: ${analytics.efficiencyFactor}`);

    // Aerobic decoupling
    if (analytics.aerobicDecoupling != null) {
      const dc = analytics.aerobicDecoupling as number;
      const dcLabel = dc > 5 ? "(high — aerobic system stressed)" : dc > 3 ? "(moderate)" : "(low — good aerobic fitness)";
      analyticsContext.push(`Aerobic Decoupling: ${dc}% ${dcLabel}`);
    }

    // Zone compliance
    if (analytics.zoneComplianceScore != null) {
      const score = analytics.zoneComplianceScore as number;
      const label = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "moderate" : "poor";
      analyticsContext.push(`Zone Compliance: ${score}/100 (${label})`);
    }

    // Cadence
    if (analytics.avgCadence) analyticsContext.push(`Avg Cadence: ${analytics.avgCadence} spm`);

    // Elevation
    if (analytics.totalAscent) analyticsContext.push(`Elevation: +${analytics.totalAscent}m / -${analytics.totalDescent || 0}m`);
    if (analytics.gradeAdjustedPace) analyticsContext.push(`Grade Adjusted Pace: ${formatSecPerKm(analytics.gradeAdjustedPace as number)}`);

    // TRIMP
    if (analytics.trimp) analyticsContext.push(`TRIMP: ${analytics.trimp}`);

    if (analyticsContext.length > 0) {
      workoutData.analytics = analyticsContext.join("\n");
    }

    // Splits summary (first/last 3 only to save tokens)
    if (Array.isArray(analytics.splits) && analytics.splits.length > 0) {
      const splits = analytics.splits as Array<{ km: number; pace: number; hr: number | null }>;
      const summary = splits.slice(0, 3).map((s) =>
        `km${s.km}: ${formatSecPerKm(s.pace)}${s.hr ? ` @${s.hr}bpm` : ""}`
      );
      if (splits.length > 6) summary.push("...");
      if (splits.length > 3) {
        summary.push(...splits.slice(-3).map((s) =>
          `km${s.km}: ${formatSecPerKm(s.pace)}${s.hr ? ` @${s.hr}bpm` : ""}`
        ));
      }
      workoutData.splits_summary = summary.join(", ");
    }
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${WORKOUT_ANALYSIS_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: JSON.stringify(workoutData),
      },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  logUsage(context.athlete.id, "workout_analysis", response);

  return response.choices[0]?.message?.content || "Great work on completing your workout!";
}

/** Format seconds per km as pace string */
function formatSecPerKm(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

/**
 * Generate weekly outlook (Monday morning message)
 */
export async function generateWeeklyOutlook(
  context: CoachContext,
  lastWeekWorkouts: unknown[],
  thisWeekPlan: unknown[]
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${WEEKLY_OUTLOOK_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          lastWeek: lastWeekWorkouts,
          thisWeek: thisWeekPlan,
        }),
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  logUsage(context.athlete.id, "weekly_outlook", response);

  return response.choices[0]?.message?.content || "Let's have a great week of training!";
}

/**
 * Extract preferences from conversation
 */
export async function extractPreferences(
  userMessage: string,
  coachResponse: string,
  userId?: string
): Promise<Record<string, string[]>> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: PREFERENCE_EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({ userMessage, coachResponse }),
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  if (userId) logUsage(userId, "preference_extraction", response);

  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Generate daily check-in message for an athlete
 */
export async function generateDailyCheckin(
  context: CoachContext
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${DAILY_CHECKIN_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: "Generate a morning check-in message for this athlete.",
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  logUsage(context.athlete.id, "daily_checkin", response);

  return response.choices[0]?.message?.content || "Good morning! Ready for today?";
}

/**
 * Generate recovery alert message when metrics are concerning
 */
export async function generateRecoveryAlert(
  context: CoachContext,
  alertData: {
    recovery_score?: number;
    hrv_drop_pct?: number;
    rhr_spike_pct?: number;
    current_hrv?: number;
    avg_hrv?: number;
    current_rhr?: number;
    avg_rhr?: number;
    sleep_hours?: number;
  }
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${RECOVERY_ALERT_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: `Recovery alert data: ${JSON.stringify(alertData)}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 250,
  });

  logUsage(context.athlete.id, "recovery_alert", response);

  return response.choices[0]?.message?.content || "Hey, your recovery numbers look a bit low. Take it easy today.";
}

/**
 * Generate a quick response for simple queries
 */
export async function quickCoachResponse(
  context: CoachContext,
  prompt: string
): Promise<string> {
  const contextSummary = formatContextForAI(context);
  const systemPrompt = buildDynamicPrompt(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  logUsage(context.athlete.id, "chat", response);

  return response.choices[0]?.message?.content || "";
}
