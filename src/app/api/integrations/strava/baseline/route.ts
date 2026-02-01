import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { fetchAndAnalyzeStravaBaseline } from "@/lib/integrations/strava-baseline";

/**
 * POST /api/integrations/strava/baseline
 *
 * Fetch the user's recent Strava activities, analyze them to extract
 * training baselines (run pace, bike FTP, swim pace, weekly volume),
 * and update their profile + active plan zones.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baselines = await fetchAndAnalyzeStravaBaseline(auth.user.id);

    return NextResponse.json({
      success: true,
      baselines,
    });
  } catch (error) {
    console.error("Strava baseline error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch baselines";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
