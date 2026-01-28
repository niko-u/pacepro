import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCoachContext } from "@/lib/coach/context";
import { coachChat, extractPreferences } from "@/lib/coach/ai";

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

    // Extract and store any preferences (async, don't block response)
    extractPreferences(message, response).then(async (prefs) => {
      if (Object.keys(prefs).length > 0) {
        // Get current learned preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("learned_preferences")
          .eq("id", user.id)
          .single();

        const current = profile?.learned_preferences || {};
        
        // Merge new preferences
        const updated = { ...current };
        for (const [key, values] of Object.entries(prefs)) {
          if (Array.isArray(values) && values.length > 0) {
            updated[key] = [...new Set([...(current[key] || []), ...values])];
          }
        }

        // Update profile
        await supabase
          .from("profiles")
          .update({ learned_preferences: updated })
          .eq("id", user.id);
      }
    }).catch(console.error);

    return NextResponse.json({ response });
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
