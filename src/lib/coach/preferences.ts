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

interface LearnedPreferences {
  schedule_constraints?: string[];
  workout_likes?: string[];
  workout_dislikes?: string[];
  recovery_notes?: string[];
  goals?: string[];
  limitations?: string[];
  life_context?: string[];
  [key: string]: string[] | undefined;
}

const CONTRADICTION_CHECK_PROMPT = `You are checking if a new preference contradicts or updates any existing preferences.

EXISTING PREFERENCES:
{existing}

NEW PREFERENCE:
{new_pref}

Does the new preference contradict, update, or supersede any existing preference?
If yes, return the exact text of the existing preference(s) that should be REMOVED.
If no contradiction, return empty array.

Return JSON: { "remove": ["exact text of preference to remove", ...] }
Only return preferences that are directly contradicted. Be conservative.`;

/**
 * Merge new preferences into the user's profile, handling deduplication and contradictions.
 */
export async function mergePreferences(
  supabase: SupabaseClient,
  userId: string,
  newPrefs: Record<string, string[]>
): Promise<{ merged: boolean; changes: string[] }> {
  if (!newPrefs || Object.keys(newPrefs).length === 0) {
    return { merged: false, changes: [] };
  }

  // Get current learned preferences
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("learned_preferences")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch profile for preference merge:", error);
    return { merged: false, changes: [] };
  }

  const current: LearnedPreferences = profile?.learned_preferences || {};
  const updated: LearnedPreferences = { ...current };
  const changes: string[] = [];

  for (const [key, values] of Object.entries(newPrefs)) {
    if (!Array.isArray(values) || values.length === 0) continue;

    const existingValues: string[] = current[key] || [];

    for (const newValue of values) {
      // Check for exact or near-exact duplicates
      if (isDuplicate(newValue, existingValues)) {
        continue;
      }

      // Check for contradictions
      const contradicted = await findContradictions(existingValues, newValue);
      if (contradicted.length > 0) {
        // Remove contradicted preferences
        updated[key] = (updated[key] || []).filter(
          (existing) => !contradicted.includes(existing)
        );
        changes.push(
          `Updated: removed "${contradicted.join('", "')}" → added "${newValue}"`
        );
      } else {
        changes.push(`Added: "${newValue}" to ${key}`);
      }

      // Add the new preference
      if (!updated[key]) {
        updated[key] = [];
      }
      updated[key]!.push(newValue);
    }
  }

  if (changes.length === 0) {
    return { merged: false, changes: [] };
  }

  // Update profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ learned_preferences: updated })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update preferences:", updateError);
    return { merged: false, changes: [] };
  }

  console.log(`Merged preferences for user ${userId}:`, changes);
  return { merged: true, changes };
}

/**
 * Check if a new preference is a duplicate of any existing one.
 * Uses normalized string comparison and substring matching.
 */
function isDuplicate(newPref: string, existingPrefs: string[]): boolean {
  const normalized = normalize(newPref);

  for (const existing of existingPrefs) {
    const existingNorm = normalize(existing);

    // Exact match after normalization
    if (normalized === existingNorm) return true;

    // One contains the other (substring match)
    if (normalized.includes(existingNorm) || existingNorm.includes(normalized)) {
      return true;
    }

    // High similarity (simple Jaccard on words)
    if (wordSimilarity(normalized, existingNorm) > 0.8) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a string for comparison
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple word-level Jaccard similarity
 */
function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Use AI to detect if a new preference contradicts existing ones.
 * Only called when there are existing preferences in the same category.
 */
async function findContradictions(
  existingPrefs: string[],
  newPref: string
): Promise<string[]> {
  if (existingPrefs.length === 0) return [];

  // Quick heuristic: check for obvious negation patterns
  const quickContradictions = findQuickContradictions(existingPrefs, newPref);
  if (quickContradictions.length > 0) {
    return quickContradictions;
  }

  // For non-obvious cases, use AI (only if there are enough existing prefs to warrant it)
  if (existingPrefs.length >= 3) {
    return await findAIContradictions(existingPrefs, newPref);
  }

  return [];
}

/**
 * Quick pattern-based contradiction detection
 */
function findQuickContradictions(
  existingPrefs: string[],
  newPref: string
): string[] {
  const contradicted: string[] = [];
  const newNorm = normalize(newPref);

  // Patterns like "can X" vs "can't X", "now X" vs "don't X"
  const negationPairs = [
    { positive: /can\s+(.+)/, negative: /can(?:'?t|not)\s+(.+)/ },
    { positive: /like\s+(.+)/, negative: /(?:don'?t|do not)\s+like\s+(.+)/ },
    { positive: /prefer\s+(.+)/, negative: /(?:don'?t|do not)\s+prefer\s+(.+)/ },
    { positive: /available\s+(?:on\s+)?(.+)/, negative: /(?:not|un)available\s+(?:on\s+)?(.+)/ },
  ];

  for (const existing of existingPrefs) {
    const existNorm = normalize(existing);

    for (const pair of negationPairs) {
      const newPos = newNorm.match(pair.positive);
      const existNeg = existNorm.match(pair.negative);
      if (newPos && existNeg && wordSimilarity(newPos[1], existNeg[1]) > 0.6) {
        contradicted.push(existing);
        continue;
      }

      const newNeg = newNorm.match(pair.negative);
      const existPos = existNorm.match(pair.positive);
      if (newNeg && existPos && wordSimilarity(newNeg[1], existPos[1]) > 0.6) {
        contradicted.push(existing);
        continue;
      }
    }

    // "actually" + similar topic = likely update
    if (newNorm.includes("actually") && wordSimilarity(newNorm, existNorm) > 0.5) {
      contradicted.push(existing);
    }
  }

  return contradicted;
}

/**
 * Use AI to find contradictions (for complex cases)
 */
async function findAIContradictions(
  existingPrefs: string[],
  newPref: string
): Promise<string[]> {
  try {
    const prompt = CONTRADICTION_CHECK_PROMPT
      .replace("{existing}", existingPrefs.map((p, i) => `${i + 1}. ${p}`).join("\n"))
      .replace("{new_pref}", newPref);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You detect contradictions in user preferences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    return Array.isArray(result.remove) ? result.remove : [];
  } catch (error) {
    console.error("Error checking contradictions:", error);
    return [];
  }
}
