import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Support mobile token-based auth (no cookies in in-app browser)
  const mobileToken = url.searchParams.get("token");
  let user: { id: string } | null = null;
  let isMobile = false;

  if (mobileToken) {
    // Mobile flow: validate token via Supabase
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await serviceClient.auth.getUser(mobileToken);
    user = data.user;
    isMobile = true;
  } else {
    // Web flow: use cookie session
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app")
    );
  }

  const returnTo = url.searchParams.get("returnTo") || "/settings";

  // Generate CSRF state: base64url(userId:nonce:returnTo:mobile)
  const nonce = randomBytes(16).toString("hex");
  const stateParts = [user.id, nonce, returnTo];
  if (isMobile) stateParts.push("mobile");
  const state = Buffer.from(stateParts.join(":")).toString("base64url");

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

  // Store nonce in an httpOnly cookie for CSRF verification in the callback
  const response = NextResponse.redirect(stravaAuthUrl);
  response.cookies.set("strava_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
