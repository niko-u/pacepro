import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/get-api-user";
import { extendPlan } from "@/lib/coach/plan-engine";

// Lazy-init service role client
let _serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceClient;
}

export async function POST(req: NextRequest) {
  try {
    let userId: string;

    // Check for service role auth (cron jobs / internal calls)
    const authHeader = req.headers.get("authorization") || "";
    const isServiceCall =
      authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (isServiceCall) {
      const body = await req.json().catch(() => ({}));
      if (!body.userId || typeof body.userId !== "string") {
        return NextResponse.json(
          { error: "userId required for service role calls" },
          { status: 400 }
        );
      }
      userId = body.userId;
    } else {
      // Regular user auth via Bearer token (mobile) or cookies (web)
      const auth = await getApiUser(req);
      if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = auth.user.id;
    }

    const supabase = getServiceClient();
    const result = await extendPlan(supabase, userId);

    return NextResponse.json({
      workoutsCreated: result.workoutsCreated,
    });
  } catch (error) {
    console.error("Plan extend error:", error);
    const message =
      error instanceof Error ? error.message : "Plan extension failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
