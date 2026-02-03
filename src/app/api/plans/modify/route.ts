import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { buildCoachContext } from "@/lib/coach/context";
import {
  executePlanModificationProposal,
  PlanModificationProposal,
} from "@/lib/coach/chat-plan-modifier";

/**
 * POST /api/plans/modify
 * Execute a user-confirmed plan modification proposal.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const body = await req.json();
    const proposal = body.proposal as PlanModificationProposal;

    if (!proposal || !proposal.type) {
      return NextResponse.json(
        { error: "Invalid plan modification proposal" },
        { status: 400 }
      );
    }

    // Build context for the modification execution
    const context = await buildCoachContext(user.id, supabase);

    // Execute the modification
    const result = await executePlanModificationProposal(user.id, proposal, context);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to apply plan changes" },
        { status: 400 }
      );
    }

    // Log the change in chat
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: `📋 Plan updated: ${result.description || proposal.summary}`,
      message_type: "plan_adjustment",
    });

    return NextResponse.json({
      success: true,
      description: result.description,
    });
  } catch (error) {
    console.error("Plan modify error:", error);
    return NextResponse.json(
      { error: "Failed to modify plan" },
      { status: 500 }
    );
  }
}
