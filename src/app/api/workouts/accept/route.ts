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

    // P2-10: Validate proposal fields to prevent untrusted client data
    const validWorkoutTypes = ["run", "bike", "swim", "strength", "brick", "rest"];
    if (!validWorkoutTypes.includes(proposal.type)) {
      return NextResponse.json(
        { error: `Invalid workout type: ${proposal.type}` },
        { status: 400 }
      );
    }

    // Validate target_date is a valid ISO date string (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(proposal.target_date) || isNaN(Date.parse(proposal.target_date))) {
      return NextResponse.json(
        { error: "Invalid target_date format (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Bounds-check duration_minutes (1-600)
    if (proposal.duration_minutes !== undefined && proposal.duration_minutes !== null) {
      const dur = Number(proposal.duration_minutes);
      if (isNaN(dur) || dur < 1 || dur > 600) {
        return NextResponse.json(
          { error: "duration_minutes must be between 1 and 600" },
          { status: 400 }
        );
      }
      proposal.duration_minutes = dur;
    }

    // Bounds-check distance_meters (0-500000)
    if (proposal.distance_meters !== undefined && proposal.distance_meters !== null) {
      const dist = Number(proposal.distance_meters);
      if (isNaN(dist) || dist < 0 || dist > 500000) {
        return NextResponse.json(
          { error: "distance_meters must be between 0 and 500000" },
          { status: 400 }
        );
      }
      proposal.distance_meters = dist;
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
