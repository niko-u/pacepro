import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getWhoopAccessToken } from "@/lib/integrations/whoop";
import { adaptForRecovery, executeAdaptationActions } from "@/lib/coach/adaptation";

const WHOOP_RECOVERY_URL = "https://api.prod.whoop.com/developer/v1/recovery";
const WHOOP_SLEEP_URL = "https://api.prod.whoop.com/developer/v1/activity/sleep";

// Lazy init service-role client
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

interface WhoopRecoveryRecord {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  } | null;
}

interface WhoopSleepRecord {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  } | null;
}

/**
 * Fetch the latest recovery data from WHOOP for a user.
 */
async function fetchWhoopRecovery(
  accessToken: string
): Promise<WhoopRecoveryRecord | null> {
  try {
    const response = await fetch(`${WHOOP_RECOVERY_URL}?limit=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("WHOOP recovery fetch failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const records = data.records || [];
    return records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error("WHOOP recovery fetch error:", err);
    return null;
  }
}

/**
 * Fetch the latest sleep data from WHOOP for a user.
 */
async function fetchWhoopSleep(
  accessToken: string
): Promise<WhoopSleepRecord | null> {
  try {
    const response = await fetch(`${WHOOP_SLEEP_URL}?limit=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("WHOOP sleep fetch failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const records = data.records || [];
    return records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error("WHOOP sleep fetch error:", err);
    return null;
  }
}

/**
 * Convert WHOOP sleep duration from milliseconds to hours.
 */
function milliToHours(milli: number): number {
  return Math.round((milli / (1000 * 60 * 60)) * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running WHOOP sync cron job");

    const supabase = getSupabase();

    // Fetch all users with WHOOP integrations
    const { data: integrations, error: integError } = await supabase
      .from("integrations")
      .select("user_id")
      .eq("provider", "whoop");

    if (integError) {
      throw new Error(`Failed to fetch WHOOP integrations: ${integError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log("No WHOOP integrations found");
      return NextResponse.json({ synced: 0, errors: 0, skipped: 0 });
    }

    const results = {
      synced: 0,
      errors: 0,
      skipped: 0,
    };

    for (const integration of integrations) {
      const userId = integration.user_id as string;

      try {
        // Get valid access token (auto-refreshes if expired)
        const accessToken = await getWhoopAccessToken(userId);
        if (!accessToken) {
          console.warn(`No valid WHOOP token for user ${userId}, skipping`);
          results.skipped++;
          continue;
        }

        // Fetch recovery and sleep data in parallel
        const [recovery, sleep] = await Promise.all([
          fetchWhoopRecovery(accessToken),
          fetchWhoopSleep(accessToken),
        ]);

        if (!recovery && !sleep) {
          console.log(`No WHOOP data available for user ${userId}`);
          results.skipped++;
          continue;
        }

        // Determine the date for this record
        const recordDate = recovery?.created_at
          ? new Date(recovery.created_at).toISOString().split("T")[0]
          : sleep?.end
            ? new Date(sleep.end).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

        // Map WHOOP data to recovery_data fields
        const recoveryScore = recovery?.score?.recovery_score ?? null;
        const hrvMs = recovery?.score?.hrv_rmssd_milli
          ? Math.round(recovery.score.hrv_rmssd_milli * 100) / 100
          : null;
        const restingHr = recovery?.score?.resting_heart_rate ?? null;

        // Calculate sleep hours from sleep record
        let sleepHours: number | null = null;
        let sleepQuality: number | null = null;
        const sleepStages: Record<string, number> = {};

        if (sleep?.score) {
          const stageSummary = sleep.score.stage_summary;
          // Total sleep time = total in bed - awake time
          const totalSleepMilli =
            stageSummary.total_in_bed_time_milli - stageSummary.total_awake_time_milli;
          sleepHours = milliToHours(totalSleepMilli);

          sleepQuality = sleep.score.sleep_performance_percentage
            ? Math.round(sleep.score.sleep_performance_percentage)
            : null;

          sleepStages.deep = milliToHours(stageSummary.total_slow_wave_sleep_time_milli);
          sleepStages.rem = milliToHours(stageSummary.total_rem_sleep_time_milli);
          sleepStages.light = milliToHours(stageSummary.total_light_sleep_time_milli);
          sleepStages.awake = milliToHours(stageSummary.total_awake_time_milli);
        }

        // Build raw_data for full context
        const rawData: Record<string, unknown> = {};
        if (recovery) rawData.recovery = recovery;
        if (sleep) rawData.sleep = sleep;

        // Upsert into recovery_data table
        const { error: upsertError } = await supabase
          .from("recovery_data")
          .upsert(
            {
              user_id: userId,
              date: recordDate,
              source: "whoop",
              recovery_score: recoveryScore,
              hrv_ms: hrvMs,
              resting_hr: restingHr,
              sleep_hours: sleepHours,
              sleep_quality: sleepQuality,
              sleep_stages: Object.keys(sleepStages).length > 0 ? sleepStages : {},
              raw_data: rawData,
              synced_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,date,source",
            }
          );

        if (upsertError) {
          console.error(`Failed to upsert WHOOP data for user ${userId}:`, upsertError);
          results.errors++;
          continue;
        }

        console.log(
          `WHOOP sync for user ${userId}: recovery=${recoveryScore}, HRV=${hrvMs}ms, ` +
            `sleep=${sleepHours}h, quality=${sleepQuality}%`
        );

        // Trigger recovery-based adaptation if we have a recovery score
        if (recoveryScore !== null) {
          try {
            const adaptResult = await adaptForRecovery(supabase, userId, {
              recovery_score: recoveryScore,
              hrv_ms: hrvMs ?? undefined,
              sleep_hours: sleepHours ?? undefined,
            } as any);
            if (adaptResult.actions.length > 0 || adaptResult.message) {
              await executeAdaptationActions(supabase, userId, adaptResult);
              console.log(`WHOOP adaptation triggered for user ${userId}: ${adaptResult.actions.length} actions`);
            }
          } catch (adaptErr) {
            console.error(`WHOOP adaptation error for user ${userId}:`, adaptErr);
          }
        }

        results.synced++;
      } catch (err) {
        console.error(`WHOOP sync error for user ${userId}:`, err);
        results.errors++;
      }
    }

    console.log("WHOOP sync complete:", results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("WHOOP sync cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
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
