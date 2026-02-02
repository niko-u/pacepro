import { NextRequest, NextResponse } from "next/server";
import { fetchAndAnalyzeStravaBaseline } from "@/lib/integrations/strava-baseline";
import { getApiUser } from "@/lib/auth/get-api-user";

/**
 * POST /api/integrations/strava/reimport
 * Re-runs the Strava baseline + history import for the authenticated user.
 * Useful when Strava was connected before the import feature existed.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await fetchAndAnalyzeStravaBaseline(user.id);

    return NextResponse.json({
      success: true,
      activitiesAnalyzed: result.activitiesAnalyzed,
      breakdown: result.breakdown,
      baselines: {
        runPacePerKm: result.runPacePerKm,
        bikeFtp: result.bikeFtp,
        swimPacePer100m: result.swimPacePer100m,
        weeklyVolumeHours: result.weeklyVolumeHours,
      },
    });
  } catch (error) {
    console.error("Strava reimport error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
