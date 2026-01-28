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

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

/**
 * Refresh a WHOOP access token using the refresh token.
 */
export async function refreshWhoopToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WHOOP token refresh failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get a valid WHOOP access token for a user.
 * Automatically refreshes if expired.
 */
export async function getWhoopAccessToken(userId: string): Promise<string | null> {
  const supabase = getServiceClient();

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .single();

  if (error || !integration) {
    console.error("No WHOOP integration found for user:", userId);
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
  console.log("Refreshing WHOOP token for user:", userId);
  try {
    const refreshed = await refreshWhoopToken(integration.refresh_token);

    // Calculate new expiry
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    // Update stored tokens
    await supabase
      .from("integrations")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: newExpiresAt,
      })
      .eq("user_id", userId)
      .eq("provider", "whoop");

    return refreshed.access_token;
  } catch (err) {
    console.error("Failed to refresh WHOOP token:", err);
    return null;
  }
}
