import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app")
    );
  }

  // Check for returnTo param (e.g., /onboarding)
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/settings";

  // Generate CSRF state: base64url(userId:nonce:returnTo)
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(`${user.id}:${nonce}:${returnTo}`).toString("base64url");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app";
  const redirectUri = `${appUrl}/api/integrations/strava/callback`;

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID || "198193",
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(stravaAuthUrl);
}
