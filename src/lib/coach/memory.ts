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

const CONVERSATION_SUMMARY_PROMPT = `You are summarizing a conversation history between an AI running coach and an athlete.

Preserve ALL of the following if present:
- Key decisions made (race choices, plan changes, schedule shifts)
- Preferences expressed (likes, dislikes, constraints)
- Injury or health mentions (any body part, pain, soreness)
- Race updates (registrations, results, goals)
- Emotional state patterns (motivation levels, stress, excitement)
- Commitments made (by athlete or coach)
- Life context (work, family, travel schedules)
- Training feedback (what felt good/bad, RPE patterns)

Format as a concise narrative, organized by topic. Use present tense for ongoing things, past tense for events.
Be thorough but concise — this is the athlete's long-term memory.`;

const MERGE_SUMMARY_PROMPT = `You have two conversation summaries for the same athlete. Merge them into one comprehensive summary.

EXISTING SUMMARY:
{existing}

NEW SUMMARY:
{new}

Rules:
- Keep all unique information from both
- If there are contradictions, prefer the NEW summary (more recent)
- Remove redundant/duplicate information
- Organize by topic (goals, preferences, injuries, schedule, life context, emotional patterns)
- Keep concise but comprehensive
- Use present tense for current state, past tense for historical events`;

/**
 * Check if conversation needs compression and compress if so.
 * Called after each chat exchange.
 */
export async function checkAndCompressConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<{ compressed: boolean; messagesCompressed?: number }> {
  // Count total messages for user
  const { count, error: countError } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError || !count || count <= 30) {
    return { compressed: false };
  }

  // Get all messages ordered by creation time
  const { data: allMessages, error: msgError } = await supabase
    .from("chat_messages")
    .select("id, role, content, message_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (msgError || !allMessages) {
    console.error("Failed to fetch messages for compression:", msgError);
    return { compressed: false };
  }

  // Keep the most recent 20, compress everything older
  const messagesToKeep = allMessages.slice(-20);
  const messagesToCompress = allMessages.slice(0, -20);

  if (messagesToCompress.length < 10) {
    // Not enough old messages to bother compressing
    return { compressed: false };
  }

  // Format messages for summarization
  const conversationText = messagesToCompress
    .map((m) => {
      const prefix = m.role === "user" ? "Athlete" : "Coach";
      const typeLabel = m.message_type !== "chat" ? ` [${m.message_type}]` : "";
      return `${prefix}${typeLabel} (${m.created_at}): ${m.content}`;
    })
    .join("\n\n");

  // Generate summary via GPT
  const newSummary = await summarizeConversation(conversationText);

  if (!newSummary) {
    console.error("Failed to generate conversation summary");
    return { compressed: false };
  }

  // Get existing summary from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("conversation_summary")
    .eq("id", userId)
    .single();

  // Merge with existing summary if one exists
  let finalSummary: string;
  if (profile?.conversation_summary) {
    finalSummary = await mergeSummaries(profile.conversation_summary, newSummary);
  } else {
    finalSummary = newSummary;
  }

  // Update profile with merged summary
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ conversation_summary: finalSummary })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update conversation summary:", updateError);
    return { compressed: false };
  }

  // Delete the compressed messages
  const idsToDelete = messagesToCompress.map((m) => m.id);
  const { error: deleteError } = await supabase
    .from("chat_messages")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    console.error("Failed to delete compressed messages:", deleteError);
    // Summary was saved, so partial success
  }

  console.log(
    `Compressed ${messagesToCompress.length} messages for user ${userId}. Kept ${messagesToKeep.length}.`
  );

  return { compressed: true, messagesCompressed: messagesToCompress.length };
}

/**
 * Summarize a block of conversation into a concise narrative
 */
async function summarizeConversation(conversationText: string): Promise<string | null> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CONVERSATION_SUMMARY_PROMPT },
        { role: "user", content: conversationText },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("Error summarizing conversation:", error);
    return null;
  }
}

/**
 * Merge an existing summary with a new one
 */
async function mergeSummaries(
  existingSummary: string,
  newSummary: string
): Promise<string> {
  try {
    const prompt = MERGE_SUMMARY_PROMPT
      .replace("{existing}", existingSummary)
      .replace("{new}", newSummary);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You merge conversation summaries accurately." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    return response.choices[0]?.message?.content || existingSummary + "\n\n" + newSummary;
  } catch (error) {
    console.error("Error merging summaries:", error);
    // Fallback: just concatenate
    return existingSummary + "\n\n--- Updated ---\n\n" + newSummary;
  }
}
