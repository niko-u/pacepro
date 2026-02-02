import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { buildCoachContext } from "@/lib/coach/context";
import { coachChat, extractPreferences } from "@/lib/coach/ai";
import { mergePreferences } from "@/lib/coach/preferences";
import { checkAndCompressConversation } from "@/lib/coach/memory";
import { extractWorkoutProposal } from "@/lib/coach/workout-creator";
import { detectAndExecutePlanModification } from "@/lib/coach/chat-plan-modifier";
import { checkChatRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Bearer token (mobile) or cookies (web)
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    // Rate limit: 30 messages per minute per user
    const rateLimit = checkChatRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again shortly." },
        { status: 429 }
      );
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    // Fetch messages once for both context and conversation history
    // (avoids duplicate DB query — buildCoachContext also needs messages)
    const { data: allRecentMessages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .is("compressed_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const preloadedMessages = (allRecentMessages || []).reverse();

    // Build context for AI (pass pre-fetched messages to avoid second query)
    const context = await buildCoachContext(user.id, supabase, { preloadedMessages });

    // Use last 10 messages for conversation history
    const history = preloadedMessages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Store user message (after fetching history to prevent dedup)
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: message,
      message_type: "chat",
    });

    // Generate coach response
    const response = await coachChat(context, history, message);

    // Store assistant response
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: response,
      message_type: "chat",
    });

    // Extract workout proposal only if the response contains workout-related language
    // (avoids unnecessary GPT call on every response)
    let proposedWorkout = null;
    const workoutKeywords = [
      "workout", "session", "run", "ride", "swim", "intervals", "tempo",
      "easy", "recovery", "brick", "minutes", "miles", "km", "warm-up",
      "cool-down", "threshold", "fartlek", "repeats", "sets",
    ];
    const responseLower = response.toLowerCase();
    const hasWorkoutLanguage = workoutKeywords.some((kw) => responseLower.includes(kw));

    if (hasWorkoutLanguage) {
      try {
        const { hasProposal, proposal } = await extractWorkoutProposal(response, message);
        if (hasProposal && proposal) {
          proposedWorkout = proposal;
        }
      } catch (err) {
        console.error("Workout extraction error:", err);
      }
    }

    // Await background tasks before returning (Vercel kills fire-and-forget promises)
    await Promise.allSettled([
      // 1. Extract and merge preferences
      extractPreferences(message, response, user.id).then(async (prefs) => {
        if (Object.keys(prefs).length > 0) {
          await mergePreferences(supabase, user.id, prefs);
        }
      }),
      // 2. Check if conversation needs compression
      checkAndCompressConversation(supabase, user.id).then((result) => {
        if (result.compressed) {
          console.log(`Compressed ${result.messagesCompressed} messages for user ${user.id}`);
        }
      }),
      // 3. Detect and execute plan modifications from chat
      detectAndExecutePlanModification(supabase, user.id, message, response, context).then(
        async (result) => {
          if (result.modified) {
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              role: "assistant",
              content: `📋 Plan updated: ${result.description}`,
              message_type: "plan_adjustment",
            });
          }
        }
      ),
    ]);

    return NextResponse.json({ response, reply: response, proposedWorkout });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50") || 50, 200);

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .is("compressed_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ messages: (messages || []).reverse() });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
