import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy init service-role client for server-side token operations
let _supabase: SupabaseClient | null = null;
function getServiceClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

/**
 * Refresh a Strava access token using the refresh token.
 */
export async function refreshStravaToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token refresh failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get a valid Strava access token for a user.
 * Automatically refreshes if expired.
 */
export async function getStravaAccessToken(userId: string): Promise<string | null> {
  const supabase = getServiceClient();

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "strava")
    .single();

  if (error || !integration) {
    console.error("No Strava integration found for user:", userId);
    return null;
  }

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(integration.token_expires_at).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt - now > bufferMs) {
    return integration.access_token;
  }

  // Token expired or expiring soon — refresh
  console.log("Refreshing Strava token for user:", userId);
  try {
    const refreshed = await refreshStravaToken(integration.refresh_token);

    // Update stored tokens
    await supabase
      .from("integrations")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "strava");

    return refreshed.access_token;
  } catch (err) {
    console.error("Failed to refresh Strava token:", err);
    return null;
  }
}
