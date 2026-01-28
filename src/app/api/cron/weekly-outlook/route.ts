import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { generateWeeklyOutlook } from "@/lib/coach/ai";

// Use service role for cron jobs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running weekly outlook cron job");

    // Get all active users with notifications enabled
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, notifications")
      .eq("subscription_status", "active")
      .not("id", "is", null);

    if (error) throw error;

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
    };

    for (const user of users || []) {
      try {
        // Check if user has weekly outlook enabled
        if (user.notifications?.weekly_outlook === false) {
          results.skipped++;
          continue;
        }

        await generateWeeklyOutlookForUser(user.id);
        results.processed++;
      } catch (err) {
        console.error(`Error generating outlook for user ${user.id}:`, err);
        results.errors++;
      }
    }

    console.log("Weekly outlook complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Weekly outlook cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

async function generateWeeklyOutlookForUser(userId: string) {
  // Build context
  const context = await buildCoachContext(userId);

  // Get last week's workouts
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const { data: lastWeekWorkouts } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", lastWeekStart.toISOString().split("T")[0])
    .lt("scheduled_date", new Date().toISOString().split("T")[0])
    .order("scheduled_date", { ascending: true });

  // Get this week's plan
  const thisWeekEnd = new Date();
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  
  const { data: thisWeekWorkouts } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", new Date().toISOString().split("T")[0])
    .lte("scheduled_date", thisWeekEnd.toISOString().split("T")[0])
    .order("scheduled_date", { ascending: true });

  // Generate outlook
  const outlook = await generateWeeklyOutlook(
    context,
    lastWeekWorkouts || [],
    thisWeekWorkouts || []
  );

  // Store as chat message
  await supabase.from("chat_messages").insert({
    user_id: userId,
    role: "assistant",
    content: outlook,
    message_type: "weekly_outlook",
    metadata: { week_of: new Date().toISOString().split("T")[0] },
  });

  console.log(`Generated weekly outlook for user ${userId}`);
}

// Also allow GET for testing (with auth)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return POST(req);
}
