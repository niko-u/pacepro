// AI Usage Tracking — logs input/output tokens per call
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AiCallType =
  | "chat"
  | "workout_analysis"
  | "daily_checkin"
  | "weekly_outlook"
  | "recovery_alert"
  | "preference_extraction"
  | "plan_generation"
  | "plan_modification"
  | "workout_creation"
  | "conversation_compression";

// GPT-4 Turbo pricing (as of 2024): $10/1M input, $30/1M output
// GPT-4o pricing: $2.50/1M input, $10/1M output
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4-turbo-preview": { inputPer1M: 10, outputPer1M: 30 },
  "gpt-4-turbo": { inputPer1M: 10, outputPer1M: 30 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
};

function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4-turbo-preview"];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M * 100; // convert $ to cents
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M * 100;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
}

export async function trackAiUsage(params: {
  userId: string;
  callType: AiCallType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  chatMessageId?: string;
}): Promise<void> {
  try {
    const costCents = estimateCostCents(
      params.model,
      params.inputTokens,
      params.outputTokens
    );

    await supabaseAdmin.from("ai_usage").insert({
      user_id: params.userId,
      call_type: params.callType,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_cents: costCents,
      chat_message_id: params.chatMessageId || null,
    });
  } catch (err) {
    // Non-blocking — never let usage tracking break the user flow
    console.error("[ai-usage] Failed to track:", err);
  }
}

export async function getUserUsageThisMonth(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("ai_usage")
    .select("input_tokens, output_tokens, cost_cents, call_type")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    console.error("[ai-usage] Failed to fetch usage:", error);
    return null;
  }

  const totals = (data || []).reduce(
    (acc, row) => ({
      totalCalls: acc.totalCalls + 1,
      inputTokens: acc.inputTokens + (row.input_tokens || 0),
      outputTokens: acc.outputTokens + (row.output_tokens || 0),
      costCents: acc.costCents + Number(row.cost_cents || 0),
    }),
    { totalCalls: 0, inputTokens: 0, outputTokens: 0, costCents: 0 }
  );

  return totals;
}
