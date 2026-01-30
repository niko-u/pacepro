import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { generateDailyCheckin } from "@/lib/coach/ai";
import {
  handleMissedWorkouts,
  executeAdaptationActions,
} from "@/lib/coach/adaptation";

// Lazy init to avoid build-time errors
let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running daily check-in cron job");

    const supabase = getSupabase();

    // Get all active users
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, notifications, timezone")
      .not("id", "is", null);

    if (error) throw error;

    const now = new Date();
    const results = {
      processed: 0,
      missed_workouts_handled: 0,
      skipped: 0,
      errors: 0,
    };

    for (const user of users || []) {
      try {
        // Check if user has daily reminders enabled
        if (user.notifications?.daily_reminder === false) {
          results.skipped++;
          continue;
        }

        // Check if it's approximately 6am in the user's timezone
        const userTimezone = user.timezone || "UTC";
        if (!isApprox6AM(now, userTimezone)) {
          results.skipped++;
          continue;
        }

        // Check if we already sent a daily check-in today
        const todayStart = getTodayStart(userTimezone);
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("message_type", "daily_checkin")
          .gte("created_at", todayStart);

        if (count && count > 0) {
          results.skipped++;
          continue;
        }

        // Handle missed workouts from yesterday before generating today's check-in
        try {
          const missedResult = await handleMissedWorkouts(supabase, user.id);
          if (missedResult.actions.length > 0 || missedResult.message) {
            await executeAdaptationActions(supabase, user.id, missedResult);
            results.missed_workouts_handled++;
            console.log(
              `Missed workout adaptation: ${missedResult.actions.length} actions for user ${user.id}`
            );
          }
        } catch (missedErr) {
          console.error(
            `Missed workout handling error for user ${user.id}:`,
            missedErr
          );
        }

        // Build context and generate check-in
        const context = await buildCoachContext(user.id, supabase);
        const message = await generateDailyCheckin(context);

        // Store as chat message
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: message,
          message_type: "daily_checkin",
          metadata: { date: now.toISOString().split("T")[0] },
        });

        results.processed++;
        console.log(`Generated daily check-in for user ${user.id}`);
      } catch (err) {
        console.error(`Error generating check-in for user ${user.id}:`, err);
        results.errors++;
      }
    }

    console.log("Daily check-in complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Daily check-in cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

/**
 * Check if it's approximately 6 AM in the given timezone.
 * We allow a window of 5:30-6:30 to account for cron timing.
 */
function isApprox6AM(now: Date, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");

    const totalMinutes = hour * 60 + minute;
    // 5:30 AM = 330 min, 6:30 AM = 390 min
    return totalMinutes >= 330 && totalMinutes <= 390;
  } catch {
    // If timezone is invalid, default to running (UTC-based)
    return true;
  }
}

/**
 * Get the start of today in the user's timezone as an ISO string
 */
function getTodayStart(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatter.format(now); // YYYY-MM-DD
    return `${dateStr}T00:00:00.000Z`;
  } catch {
    return new Date().toISOString().split("T")[0] + "T00:00:00.000Z";
  }
}

// Also allow GET for testing (with auth)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return POST(req);
}
