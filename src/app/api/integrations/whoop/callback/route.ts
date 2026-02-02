import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_RECOVERY_URL = "https://api.prod.whoop.com/developer/v1/recovery";
const WHOOP_SLEEP_URL = "https://api.prod.whoop.com/developer/v1/activity/sleep";

/**
 * Fetch and store WHOOP recovery + sleep data immediately after connect.
 */
async function syncWhoopDataOnConnect(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string
) {
  try {
    const [recoveryRes, sleepRes] = await Promise.all([
      fetch(`${WHOOP_RECOVERY_URL}?limit=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${WHOOP_SLEEP_URL}?limit=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const recoveryData = recoveryRes.ok ? await recoveryRes.json() : null;
    const sleepData = sleepRes.ok ? await sleepRes.json() : null;

    const recovery = recoveryData?.records?.[0] ?? null;
    const sleep = sleepData?.records?.[0] ?? null;

    if (!recovery && !sleep) {
      console.log(`No WHOOP data available yet for user ${userId}`);
      return;
    }

    const recordDate = recovery?.created_at
      ? new Date(recovery.created_at).toISOString().split("T")[0]
      : sleep?.end
        ? new Date(sleep.end).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

    const recoveryScore = recovery?.score?.recovery_score ?? null;
    const hrvMs = recovery?.score?.hrv_rmssd_milli
      ? Math.round(recovery.score.hrv_rmssd_milli * 100) / 100
      : null;
    const restingHr = recovery?.score?.resting_heart_rate ?? null;

    let sleepHours: number | null = null;
    let sleepQuality: number | null = null;
    const sleepStages: Record<string, number> = {};

    if (sleep?.score) {
      const s = sleep.score.stage_summary;
      const totalSleepMilli = s.total_in_bed_time_milli - s.total_awake_time_milli;
      sleepHours = Math.round((totalSleepMilli / 3600000) * 100) / 100;
      sleepQuality = sleep.score.sleep_performance_percentage
        ? Math.round(sleep.score.sleep_performance_percentage)
        : null;
      sleepStages.deep = Math.round((s.total_slow_wave_sleep_time_milli / 3600000) * 100) / 100;
      sleepStages.rem = Math.round((s.total_rem_sleep_time_milli / 3600000) * 100) / 100;
      sleepStages.light = Math.round((s.total_light_sleep_time_milli / 3600000) * 100) / 100;
      sleepStages.awake = Math.round((s.total_awake_time_milli / 3600000) * 100) / 100;
    }

    await supabase.from("recovery_data").upsert(
      {
        user_id: userId,
        date: recordDate,
        source: "whoop",
        recovery_score: recoveryScore,
        hrv_ms: hrvMs,
        resting_hr: restingHr,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        sleep_stages: Object.keys(sleepStages).length > 0 ? sleepStages : {},
        raw_data: { recovery, sleep },
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date,source" }
    );

    console.log(
      `WHOOP initial sync for ${userId}: recovery=${recoveryScore}, sleep=${sleepHours}h`
    );
  } catch (err) {
    // Non-fatal — data will sync on next cron run
    console.error("WHOOP initial sync failed (non-fatal):", err);
  }
}
const WHOOP_PROFILE_URL = "https://api.prod.whoop.com/developer/v1/user/profile/basic";

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
      settingsUrl.searchParams.set("error", "whoop_denied");
      return NextResponse.redirect(settingsUrl.toString());
    }

    if (!code || !state) {
      settingsUrl.searchParams.set("error", "whoop_missing_params");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Decode state to get user_id, nonce, returnTo, and mobile flag
    let userId: string;
    let nonce: string;
    let returnTo = "/settings";
    let isMobile = false;
    try {
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      const parts = decoded.split(":");
      userId = parts[0];
      nonce = parts[1];
      if (!userId || !nonce) throw new Error("Missing user ID or nonce in state");
      if (parts[parts.length - 1] === "mobile") {
        isMobile = true;
        if (parts.length >= 4) returnTo = parts.slice(2, -1).join(":");
      } else if (parts.length >= 3) {
        returnTo = parts.slice(2).join(":");
      }
    } catch {
      settingsUrl.searchParams.set("error", "whoop_invalid_state");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // CSRF verification — skip for mobile (no cookies in in-app browser)
    if (!isMobile) {
      const cookieNonce = req.cookies.get("whoop_oauth_nonce")?.value;
      if (!cookieNonce || cookieNonce !== nonce) {
        console.error("WHOOP OAuth CSRF validation failed: nonce mismatch");
        settingsUrl.searchParams.set("error", "whoop_csrf_failed");
        return NextResponse.redirect(settingsUrl.toString());
      }

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.id !== userId) {
        settingsUrl.searchParams.set("error", "whoop_auth_mismatch");
        return NextResponse.redirect(settingsUrl.toString());
      }
    }

    // Exchange code for tokens
    const redirectUri = `${appUrl}/api/integrations/whoop/callback`;
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    });

    const tokenResponse = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("WHOOP token exchange failed:", tokenResponse.status, errText);
      settingsUrl.searchParams.set("error", "whoop_token_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Fetch WHOOP user profile
    let profile = null;
    let whoopUserId = "";
    try {
      const profileResponse = await fetch(WHOOP_PROFILE_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (profileResponse.ok) {
        profile = await profileResponse.json();
        whoopUserId = String(profile.user_id);
      }
    } catch (err) {
      console.warn("Failed to fetch WHOOP profile:", err);
    }

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
          provider: "whoop",
          access_token,
          refresh_token,
          token_expires_at: expiresAt,
          provider_user_id: whoopUserId,
          provider_data: profile || {},
          scopes: "read:recovery read:sleep read:workout read:profile read:body_measurement",
          connected_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (dbError) {
      console.error("Failed to store WHOOP integration:", dbError);
      settingsUrl.searchParams.set("error", "whoop_db_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    console.log(`WHOOP connected for user ${userId}, whoop user ${whoopUserId}`);

    // Immediately sync recovery + sleep data
    await syncWhoopDataOnConnect(serviceClient, userId, access_token);

    // Redirect back — deep link for mobile, web URL for browser
    if (isMobile) {
      return NextResponse.redirect("pacepro://oauth-callback?connected=whoop");
    }

    const redirectUrl = new URL(returnTo, appUrl);
    redirectUrl.searchParams.set("connected", "whoop");
    const response = NextResponse.redirect(redirectUrl.toString());
    response.cookies.set("whoop_oauth_nonce", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("WHOOP callback error:", err);
    settingsUrl.searchParams.set("error", "whoop_unexpected");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
