import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext } from "@/lib/coach/context";
import { generateRecoveryAlert } from "@/lib/coach/ai";
import {
  adaptForRecovery,
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

    console.log("Running recovery check cron job");

    const supabase = getSupabase();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get users who have recovery data (connected wearables)
    const { data: usersWithRecovery, error } = await supabase
      .from("recovery_data")
      .select("user_id")
      .eq("date", today)
      .order("synced_at", { ascending: false });

    if (error) throw error;

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set((usersWithRecovery || []).map((r) => r.user_id))];

    const results = {
      processed: 0,
      alerts_sent: 0,
      adaptations_run: 0,
      skipped: 0,
      errors: 0,
    };

    for (const userId of uniqueUserIds) {
      try {
        // Get today's recovery data first (needed for both adaptation and alerts)
        const { data: todayRecovery } = await supabase
          .from("recovery_data")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .order("synced_at", { ascending: false })
          .limit(1)
          .single();

        if (!todayRecovery) {
          results.skipped++;
          continue;
        }

        // P2-11: Check if adaptation was already run today (e.g. by WHOOP sync)
        const todayStart = new Date(today + "T00:00:00Z").toISOString();
        const { count: existingAdaptations } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("message_type", "recovery_alert")
          .gte("created_at", todayStart);

        // Run adaptation engine based on recovery data (skip if already ran today)
        if (existingAdaptations && existingAdaptations > 0) {
          console.log(`Adaptation already ran today for user ${userId}, skipping`);
        } else {
          try {
            const adaptResult = await adaptForRecovery(supabase, userId, {
              recovery_score: todayRecovery.recovery_score,
              hrv_ms: todayRecovery.hrv_ms,
              sleep_hours: todayRecovery.sleep_hours,
            });

            if (adaptResult.actions.length > 0 || adaptResult.message) {
              await executeAdaptationActions(supabase, userId, adaptResult);
              results.adaptations_run++;
              console.log(
                `Recovery adaptation: ${adaptResult.actions.length} actions for user ${userId}`
              );
            }
          } catch (adaptErr) {
            console.error(`Recovery adaptation error for user ${userId}:`, adaptErr);
          }
        }

        // Check notification preferences (for alerts only)
        const { data: profile } = await supabase
          .from("profiles")
          .select("notifications")
          .eq("id", userId)
          .single();

        if (profile?.notifications?.recovery_alerts === false) {
          results.processed++;
          continue;
        }

        // Check if recovery_alert already sent in last 12 hours
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
        const { count: recentAlerts } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("message_type", "recovery_alert")
          .gte("created_at", twelveHoursAgo);

        if (recentAlerts && recentAlerts > 0) {
          results.processed++;
          continue;
        }

        // Get 7-day average for comparison
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        const { data: weekRecovery } = await supabase
          .from("recovery_data")
          .select("hrv_ms, resting_hr, recovery_score")
          .eq("user_id", userId)
          .gte("date", sevenDaysAgo)
          .lt("date", today);

        const avgHRV = calculateAverage(weekRecovery || [], "hrv_ms");
        const avgRHR = calculateAverage(weekRecovery || [], "resting_hr");

        // Check alert conditions
        const alertData = checkAlertConditions(todayRecovery, avgHRV, avgRHR);

        if (!alertData) {
          results.processed++;
          continue;
        }

        // Generate and send recovery alert
        const context = await buildCoachContext(userId, supabase);
        const message = await generateRecoveryAlert(context, alertData);

        await supabase.from("chat_messages").insert({
          user_id: userId,
          role: "assistant",
          content: message,
          message_type: "recovery_alert",
          metadata: {
            alert_data: alertData,
            date: today,
          },
        });

        results.alerts_sent++;
        results.processed++;
        console.log(`Sent recovery alert to user ${userId}:`, alertData);
      } catch (err) {
        console.error(`Error checking recovery for user ${userId}:`, err);
        results.errors++;
      }
    }

    console.log("Recovery check complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Recovery check cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

interface RecoveryRecord {
  recovery_score?: number;
  hrv_ms?: number;
  resting_hr?: number;
  sleep_hours?: number;
}

/**
 * Calculate average for a numeric field across recovery records
 */
function calculateAverage(
  records: RecoveryRecord[],
  field: keyof RecoveryRecord
): number {
  const values = records
    .map((r) => r[field])
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Check if recovery data triggers an alert.
 * Returns alert data if triggered, null otherwise.
 */
function checkAlertConditions(
  today: RecoveryRecord,
  avgHRV: number,
  avgRHR: number
): {
  recovery_score?: number;
  hrv_drop_pct?: number;
  rhr_spike_pct?: number;
  current_hrv?: number;
  avg_hrv?: number;
  current_rhr?: number;
  avg_rhr?: number;
  sleep_hours?: number;
} | null {
  const alerts: Record<string, number> = {};
  let shouldAlert = false;

  // Condition 1: Low recovery score
  if (today.recovery_score !== undefined && today.recovery_score < 50) {
    alerts.recovery_score = today.recovery_score;
    shouldAlert = true;
  }

  // Condition 2: HRV drop > 20% from 7-day average
  if (today.hrv_ms && avgHRV > 0) {
    const hrvDropPct = ((avgHRV - today.hrv_ms) / avgHRV) * 100;
    if (hrvDropPct > 20) {
      alerts.hrv_drop_pct = Math.round(hrvDropPct);
      alerts.current_hrv = today.hrv_ms;
      alerts.avg_hrv = Math.round(avgHRV);
      shouldAlert = true;
    }
  }

  // Condition 3: Resting HR spike > 10% from 7-day average
  if (today.resting_hr && avgRHR > 0) {
    const rhrSpikePct = ((today.resting_hr - avgRHR) / avgRHR) * 100;
    if (rhrSpikePct > 10) {
      alerts.rhr_spike_pct = Math.round(rhrSpikePct);
      alerts.current_rhr = today.resting_hr;
      alerts.avg_rhr = Math.round(avgRHR);
      shouldAlert = true;
    }
  }

  if (!shouldAlert) return null;

  // Include sleep data if available
  if (today.sleep_hours) {
    alerts.sleep_hours = today.sleep_hours;
  }

  return alerts;
}

// Also allow GET for testing (with auth)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return POST(req);
}
