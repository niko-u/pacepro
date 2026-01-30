import { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Universal auth helper for API routes.
 * Supports both:
 *   1. Bearer token auth (mobile app / external clients)
 *   2. Cookie-based session auth (web app)
 *
 * Returns the authenticated user or null.
 */
export async function getApiUser(
  req: NextRequest
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  // 1. Check for Bearer token (mobile / external)
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Skip if it's the cron secret or service role key (not a user token)
    if (
      token === process.env.CRON_SECRET ||
      token === process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return null;
    }

    // Create a Supabase client with the user's JWT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return { user, supabase };
  }

  // 2. Fall back to cookie-based auth (web)
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return { user, supabase };
  } catch {
    return null;
  }
}
