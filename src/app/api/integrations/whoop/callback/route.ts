import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
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

    // Decode state to get user_id
    let userId: string;
    try {
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      userId = decoded.split(":")[0];
      if (!userId) throw new Error("No user ID in state");
    } catch {
      settingsUrl.searchParams.set("error", "whoop_invalid_state");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Verify user is authenticated and matches state
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      settingsUrl.searchParams.set("error", "whoop_auth_mismatch");
      return NextResponse.redirect(settingsUrl.toString());
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
    settingsUrl.searchParams.set("connected", "whoop");
    return NextResponse.redirect(settingsUrl.toString());
  } catch (err) {
    console.error("WHOOP callback error:", err);
    settingsUrl.searchParams.set("error", "whoop_unexpected");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
