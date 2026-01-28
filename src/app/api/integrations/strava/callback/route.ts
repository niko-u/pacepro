import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app";
  const settingsUrl = new URL("/settings", appUrl);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle user denial
    if (error) {
      settingsUrl.searchParams.set("error", "strava_denied");
      return NextResponse.redirect(settingsUrl.toString());
    }

    if (!code || !state) {
      settingsUrl.searchParams.set("error", "strava_missing_params");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Decode state to get user_id and returnTo
    let userId: string;
    let returnTo = "/settings";
    try {
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      const parts = decoded.split(":");
      userId = parts[0];
      if (!userId) throw new Error("No user ID in state");
      // Third part (if present) is returnTo path
      if (parts.length >= 3) {
        returnTo = parts.slice(2).join(":");
      }
    } catch {
      settingsUrl.searchParams.set("error", "strava_invalid_state");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Verify user is authenticated and matches state
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      settingsUrl.searchParams.set("error", "strava_auth_mismatch");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Strava token exchange failed:", tokenResponse.status, errText);
      settingsUrl.searchParams.set("error", "strava_token_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    // Use service role client to upsert integration (RLS bypass)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert integration record
    const { error: dbError } = await serviceClient
      .from("integrations")
      .upsert(
        {
          user_id: userId,
          provider: "strava",
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
          provider_user_id: String(athlete.id),
          strava_athlete_id: athlete.id,
          provider_data: {
            username: athlete.username,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            profile: athlete.profile,
            city: athlete.city,
            state: athlete.state,
            country: athlete.country,
          },
          scopes: "read,activity:read_all",
          connected_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (dbError) {
      console.error("Failed to store Strava integration:", dbError);
      settingsUrl.searchParams.set("error", "strava_db_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    console.log(`Strava connected for user ${userId}, athlete ${athlete.id}`);
    const redirectUrl = new URL(returnTo, appUrl);
    redirectUrl.searchParams.set("connected", "strava");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Strava callback error:", err);
    settingsUrl.searchParams.set("error", "strava_unexpected");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
