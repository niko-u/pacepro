import OpenAI from "openai";
import { 
  COACH_SYSTEM_PROMPT, 
  WORKOUT_ANALYSIS_PROMPT, 
  WEEKLY_OUTLOOK_PROMPT,
  PREFERENCE_EXTRACTION_PROMPT,
} from "./prompts";
import { CoachContext, formatContextForAI } from "./context";

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
 * Main chat completion with coach persona
 */
export async function coachChat(
  context: CoachContext,
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  const contextSummary = formatContextForAI(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `${COACH_SYSTEM_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
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

  return response.choices[0]?.message?.content || "I'm here to help! What's on your mind?";
}

/**
 * Analyze a completed workout
 */
export async function analyzeWorkout(
  context: CoachContext,
  prescribed: Record<string, unknown>,
  actual: Record<string, unknown>
): Promise<string> {
  const contextSummary = formatContextForAI(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `${COACH_SYSTEM_PROMPT}\n\n${WORKOUT_ANALYSIS_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: JSON.stringify({ prescribed, actual }),
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || "Great work on completing your workout!";
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

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `${COACH_SYSTEM_PROMPT}\n\n${WEEKLY_OUTLOOK_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
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

  return response.choices[0]?.message?.content || "Let's have a great week of training!";
}

/**
 * Extract preferences from conversation
 */
export async function extractPreferences(
  userMessage: string,
  coachResponse: string
): Promise<Record<string, string[]>> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
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

  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Generate a quick response for simple queries
 */
export async function quickCoachResponse(
  context: CoachContext,
  prompt: string
): Promise<string> {
  const contextSummary = formatContextForAI(context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `${COACH_SYSTEM_PROMPT}\n\n--- ATHLETE CONTEXT ---\n${contextSummary}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || "";
}
