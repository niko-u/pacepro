import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("provider, provider_user_id, provider_data, connected_at, last_sync_at, scopes")
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to fetch integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }

  // Build status map
  const status: Record<
    string,
    {
      connected: boolean;
      username: string;
      connectedAt: string | null;
      lastSync: string | null;
    }
  > = {};

  for (const integration of integrations || []) {
    const providerData = integration.provider_data as Record<string, unknown> || {};
    let username = "";

    if (integration.provider === "strava") {
      username =
        (providerData.username as string) ||
        `${providerData.firstname || ""} ${providerData.lastname || ""}`.trim() ||
        integration.provider_user_id ||
        "";
    } else if (integration.provider === "whoop") {
      username =
        `${(providerData as Record<string, unknown>).first_name || ""} ${(providerData as Record<string, unknown>).last_name || ""}`.trim() ||
        integration.provider_user_id ||
        "Connected";
    } else {
      username = integration.provider_user_id || "Connected";
    }

    status[integration.provider] = {
      connected: true,
      username,
      connectedAt: integration.connected_at,
      lastSync: integration.last_sync_at,
    };
  }

  return NextResponse.json({ integrations: status });
}
