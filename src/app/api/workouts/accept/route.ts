import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { acceptWorkoutProposal, WorkoutProposal } from "@/lib/coach/workout-creator";

export async function POST(req: NextRequest) {
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const body = await req.json();
    const proposal = body.proposal as WorkoutProposal;

    if (!proposal || !proposal.type || !proposal.target_date) {
      return NextResponse.json(
        { error: "Invalid workout proposal" },
        { status: 400 }
      );
    }

    const result = await acceptWorkoutProposal(supabase, user.id, proposal);

    if (!result.created) {
      return NextResponse.json(
        { error: "Failed to create workout. Do you have an active plan?" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      workoutId: result.workoutId,
    });
  } catch (error) {
    console.error("Accept workout error:", error);
    return NextResponse.json(
      { error: "Failed to accept workout" },
      { status: 500 }
    );
  }
}
