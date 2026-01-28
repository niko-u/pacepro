import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app")
    );
  }

  // Generate CSRF state: base64url(userId:nonce)
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(`${user.id}:${nonce}`).toString("base64url");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pacepro.vercel.app";
  const redirectUri = `${appUrl}/api/integrations/whoop/callback`;

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID || "ff187cd9-53d6-4725-ba42-2f1bc0f279d4",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read:recovery read:sleep read:workout read:profile read:body_measurement",
    state,
  });

  const whoopAuthUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`;

  return NextResponse.redirect(whoopAuthUrl);
}
