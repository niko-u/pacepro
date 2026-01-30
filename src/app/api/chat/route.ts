import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCoachContext } from "@/lib/coach/context";
import { coachChat, extractPreferences } from "@/lib/coach/ai";
import { mergePreferences } from "@/lib/coach/preferences";
import { checkAndCompressConversation } from "@/lib/coach/memory";
import { extractAndCreateWorkout } from "@/lib/coach/workout-creator";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Store user message
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: message,
      message_type: "chat",
    });

    // Build context for AI
    const context = await buildCoachContext(user.id);

    // Get recent messages for conversation history
    const { data: recentMessages } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = (recentMessages || []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Generate coach response
    const response = await coachChat(context, history, message);

    // Store assistant response
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: response,
      message_type: "chat",
    });

    // Background tasks: preference extraction + memory compression + workout creation (don't block response)
    // 1. Extract and merge preferences
    extractPreferences(message, response).then(async (prefs) => {
      if (Object.keys(prefs).length > 0) {
        await mergePreferences(supabase, user.id, prefs);
      }
    }).catch((err) => console.error("Preference extraction error:", err));

    // 2. Check if conversation needs compression
    checkAndCompressConversation(supabase, user.id)
      .then((result) => {
        if (result.compressed) {
          console.log(`Compressed ${result.messagesCompressed} messages for user ${user.id}`);
        }
      })
      .catch((err) => console.error("Conversation compression error:", err));

    // 3. Check if coach response contains a workout prescription → create it
    extractAndCreateWorkout(supabase, user.id, response, message)
      .then((result) => {
        if (result.created) {
          console.log(`Created workout ${result.workoutId} from chat for user ${user.id}`);
        }
      })
      .catch((err) => console.error("Workout extraction error:", err));

    return NextResponse.json({ response, reply: response });
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
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
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
