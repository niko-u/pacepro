import { NextRequest, NextResponse } from "next/server";
import { fetchAndAnalyzeStravaBaseline } from "@/lib/integrations/strava-baseline";
import { getApiUser } from "@/lib/auth/get-api-user";

/**
 * POST /api/integrations/strava/reimport
 * Re-runs the Strava baseline + history import for the authenticated user.
 * Auth: Bearer token (user) OR cron secret + userId (admin/server)
 */
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;

    // Check for cron/admin auth first
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");

    if (
      authHeader === `Bearer ${process.env.CRON_SECRET}` &&
      body.userId
    ) {
      // Admin/server auth with explicit userId
      userId = body.userId;
    } else {
      // Normal user auth
      const user = await getApiUser(req);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }

    const result = await fetchAndAnalyzeStravaBaseline(userId);

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
