# PacePro Backend Audit — 2026-02-02

**Auditor:** Jarvis (automated code audit)  
**Scope:** All API routes, coach AI, analytics, auth, integrations, cron jobs, schema  
**Severity:** P0 = will break in production, P1 = significant reliability/security issue, P2 = quality/performance concern

---

## Executive Summary

The backend is architecturally sound with good separation of concerns, comprehensive features (adaptive coaching, zone detection, analytics engine), and reasonable error handling. However, there are **4 P0 issues** that will cause production failures, **12 P1 issues** affecting reliability/security, and **14 P2 issues** impacting quality and performance.

**Critical path:** The Strava webhook handler is the most complex and fragile route — it chains 8+ async operations that can exceed Vercel's 10s timeout. The in-memory rate limiter is effectively useless on serverless. Several fire-and-forget async operations will silently die on Vercel after the response is sent.

---

## P0 — Will Break in Production

### P0-1: Fire-and-forget promises die on Vercel after response (multiple files)

**Files:**
- `src/app/api/chat/route.ts` lines 76-99
- `src/app/api/integrations/strava/callback/route.ts` line 118

**Issue:** After `NextResponse.json()` is returned, Vercel terminates the Lambda. The following `.then()` chains in the chat route will be killed mid-execution:

```typescript
// Line 76 — preference extraction (fire-and-forget)
extractPreferences(message, response, user.id).then(async (prefs) => { ... })

// Line 85 — conversation compression (fire-and-forget)
checkAndCompressConversation(supabase, user.id).then(...)

// Line 92 — plan modification detection (fire-and-forget)
detectAndExecutePlanModification(supabase, user.id, ...).then(...)
```

Similarly, `fetchAndAnalyzeStravaBaseline(userId).catch(...)` on the Strava callback (line 118) is fire-and-forget after redirect.

**Impact:** Preferences never get extracted. Conversation memory never gets compressed (messages pile up forever). Plan modifications from chat silently fail. Users say "move my long run to Saturday" → coach acknowledges → nothing happens.

**Fix:** Use `waitUntil()` from `next/server` (available in Next.js 15+), or use Vercel's `@vercel/functions` `waitUntil`, or move these to a background job queue (Inngest, QStash). Alternatively, `await` all three before responding (adds ~1-2s latency but guarantees execution).

---

### P0-2: Strava webhook handler will timeout on Vercel (10s limit)

**File:** `src/app/api/webhooks/strava/route.ts`, `processStravaActivity()` (lines 90-280)

**Issue:** `processStravaActivity` chains: Strava token refresh → fetch activity → fetch streams → fetch scheduled workout → fetch profile → fetch plan → run analytics engine → AI workout analysis (GPT-4o) → DB upsert workout → store analytics → update training load → detect zone breakthroughs → AI chat message → adaptation engine → execute adaptations → mark processed.

That's **2 external API calls (Strava) + 1 OpenAI call + 10+ DB queries + computation**. The OpenAI call alone is ~2-5 seconds. Total: 5-15 seconds easily.

**Impact:** Webhook returns `{ received: true }` immediately (good — the ACK is correct), but `processStravaActivity` runs as a fire-and-forget promise. On Vercel Serverless, the function is killed after the response is sent. The activity will never be processed. On Hobby plan (10s max function duration), even if you `await` it, it'll timeout.

**Fix:**
1. ACK the webhook immediately (already done — good).
2. Queue the activity processing via Vercel KV/QStash or a dedicated background worker.
3. Or split processing: webhook writes to `webhook_events`, a separate cron polls unprocessed events.
4. If staying serverless, split into 2 endpoints: webhook ACK → internal trigger for processing.

---

### P0-3: `usage.ts` creates Supabase client at module top level — build-time crash

**File:** `src/lib/coach/usage.ts` lines 2-5

```typescript
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Issue:** Unlike every other file that uses lazy initialization (`let _client = null; function getClient() { ... }`), `usage.ts` creates the client at **module evaluation time**. During `next build`, `SUPABASE_SERVICE_ROLE_KEY` is undefined → the `!` non-null assertion passes `undefined` to `createClient` → client is created with undefined credentials → all `trackAiUsage` calls fail silently at runtime (since errors are caught and logged).

**Impact:** All AI usage tracking silently fails. No cost monitoring data. The `ai_usage` table stays empty.

**Fix:** Use the lazy-init pattern like every other file:
```typescript
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabaseAdmin;
}
```

---

### P0-4: Schema mismatch — `training_plans` missing `goal_finish_time` column

**File:** `supabase/schema.sql` — `training_plans` table definition (lines 44-63)

**Issue:** The `training_plans` table in `schema.sql` does not have a `goal_finish_time` column. But `plan-engine.ts` line (plan insert, ~line 1438) inserts `goal_finish_time: athlete.goal_finish_time || null` and `chat-plan-modifier.ts` `executeChangeGoalTime()` updates `goal_finish_time` on the plan.

Additionally, `training_plans` is missing `current_phase`, `current_week`, `total_weeks` in the base schema (added in migration 001 but would fail on a fresh `schema.sql`-only setup).

**Impact:** Plan generation will fail with a Supabase error if `goal_finish_time` column doesn't exist. The migration adds `current_phase` etc. but not `goal_finish_time`.

**Fix:** Add `goal_finish_time INTEGER` to the `training_plans` table in schema.sql or create a migration for it.

---

## P1 — Significant Reliability / Security Issues

### P1-1: In-memory rate limiter is useless on Vercel Serverless

**File:** `src/lib/rate-limit.ts`

**Issue:** The file's own comment explains the problem: "Vercel serverless functions are stateless — this rate limiter resets between cold starts." On Vercel, each request may hit a different Lambda instance. The `Map<string, RateLimitEntry>` is per-instance and resets on cold start.

**Impact:** Rate limiting is effectively non-functional. A user could send 1000 chat messages/minute without being throttled (each hitting a different cold instance).

**Fix:** Use Upstash Redis (`@upstash/ratelimit`) as suggested in the file's own comment. This is the standard Vercel approach.

---

### P1-2: WHOOP OAuth nonce cookie collision with Strava

**Files:**
- `src/app/api/integrations/strava/connect/route.ts` line 28
- `src/app/api/integrations/whoop/connect/route.ts` line 27

**Issue:** Both Strava and WHOOP OAuth flows use the same cookie name: `oauth_state_nonce`. If a user initiates both connections simultaneously (or one right after another), the second one overwrites the first cookie, causing CSRF validation to fail for the first.

**Impact:** Rare but possible: connecting both integrations in quick succession causes one to fail with a CSRF error.

**Fix:** Use provider-specific cookie names: `strava_oauth_nonce` and `whoop_oauth_nonce`.

---

### P1-3: No idempotency guard on workout creation via Strava webhook

**File:** `src/app/api/webhooks/strava/route.ts` lines 205-225

**Issue:** When no `scheduledWorkout` is found, the code creates a new workout entry. But the idempotency check on line 105 uses `strava_activity_id` to check for duplicates. If the webhook fires twice before the first processes (race condition), two identical workouts could be created because the first check on line 105 passes for both, and neither has been inserted yet.

The `webhook_events` upsert with `ignoreDuplicates` (line 62) guards against *event* duplication but not against the activity processing race — two Lambda instances could both get past the event check simultaneously.

**Impact:** Duplicate workout entries with the same Strava activity. Duplicate chat messages. Double adaptation actions.

**Fix:** Add a unique constraint on `workouts(strava_activity_id)` in the DB. Use upsert instead of insert for unscheduled workouts. Or use a Postgres advisory lock / `INSERT ... ON CONFLICT DO NOTHING`.

---

### P1-4: `getApiUser` returns `null` for service tokens but callers handle it as "unauthorized"

**File:** `src/lib/auth/get-api-user.ts` lines 21-27

**Issue:** When the Authorization header is `Bearer <CRON_SECRET>` or `Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `getApiUser` returns `null`. This is correct — service tokens aren't user tokens. But routes that accept *both* service calls and user calls (like `plans/generate`, `plans/extend`) handle this by checking for service auth *before* calling `getApiUser`, which is fragile.

If the `isServiceCall` check in `plans/generate/route.ts` (line 26) is ever removed or refactored, the CRON_SECRET token would be passed to `supabase.auth.getUser()` which would fail, and the cron job would get a 401.

**Impact:** Low immediate risk, but architectural fragility. Any refactoring of auth could break cron→API calls.

**Fix:** Document this pattern clearly. Or better: have `getApiUser` return a discriminated union: `{ type: 'user', user, supabase } | { type: 'service' } | null`.

---

### P1-5: Plan generation uses service client — bypasses RLS for all user data reads

**File:** `src/app/api/plans/generate/route.ts` lines 55, 69

**Issue:** For *user-initiated* plan generation (not just service calls), the code switches to the service client on line 69: `supabase = getServiceClient()`. This means all subsequent reads (plan deletion, workout creation) bypass RLS entirely.

While functionally correct (the plan engine needs cross-table access), this means a compromised user token + plan generation request could theoretically be used as an escalation vector if combined with other bugs.

**Impact:** Not exploitable alone, but violates principle of least privilege. If a bug in `generatePlan` ever reads/writes data for a different user, RLS won't catch it.

**Fix:** Use the user's authenticated Supabase client for reads and the service client only for writes that need RLS bypass.

---

### P1-6: Auth callback has open redirect vulnerability

**File:** `src/app/auth/callback/route.ts` line 6

```typescript
const next = searchParams.get("next") ?? "/dashboard";
return NextResponse.redirect(`${origin}${next}`);
```

**Issue:** The `next` parameter is user-controlled. An attacker could craft: `/auth/callback?code=xxx&next=//evil.com` which results in `redirect("https://pacepro.vercel.app//evil.com")` — which browsers may interpret as `https://evil.com`. Or `next=@evil.com` depending on URL parsing.

**Impact:** Open redirect. Could be used in phishing attacks: "Click this PacePro link to log in" → redirects to attacker site.

**Fix:** Validate that `next` starts with `/` and doesn't contain `//`, `@`, or other redirect bypass characters. Or use a whitelist of allowed redirect paths.

---

### P1-7: Strava webhook has no signature verification

**File:** `src/app/api/webhooks/strava/route.ts` POST handler (line 47)

**Issue:** Strava sends webhook events without HMAC signatures (unlike Stripe). The only "verification" is the GET subscription challenge. Anyone who knows the webhook URL can POST fake events to it.

**Impact:** An attacker could inject fake activities, trigger AI analysis on fabricated data, or cause denial-of-service by flooding fake events.

**Fix:** Strava doesn't support webhook signatures, but you can mitigate by:
1. Always verify the activity exists by fetching from Strava API (already done — good).
2. Rate limit the webhook endpoint by IP.
3. Validate the `owner_id` matches a known user before processing.
4. Consider Strava's `subscription_id` field for validation.

---

### P1-8: Daily check-in timezone calculation has off-by-one issue

**File:** `src/app/api/cron/daily-checkin/route.ts`, `getTodayStart()` function (lines 125-135)

```typescript
function getTodayStart(timezone: string): string {
  // ...
  return `${dateStr}T00:00:00.000Z`; // ← BUG: This is midnight UTC, not midnight in user's timezone
}
```

**Issue:** The function formats the date in the user's timezone (e.g., `2026-02-02` for someone in EST) but then appends `T00:00:00.000Z` (UTC midnight). This means for a user in `America/New_York`, "today at midnight" becomes midnight UTC, which is actually 7pm the previous day in EST.

**Impact:** The deduplication check (`gte created_at, todayStart`) could either allow duplicate check-ins or miss legitimate ones, depending on the timezone offset direction.

**Fix:** Calculate the actual UTC timestamp of midnight in the user's timezone:
```typescript
const utcOffset = ... // calculate from timezone
return `${dateStr}T00:00:00.000+${offset}`;
```
Or use a proper timezone library.

---

### P1-9: Chat endpoint doesn't validate message length

**File:** `src/app/api/chat/route.ts` line 33

**Issue:** The message is validated as a non-empty string, but there's no maximum length check. A user could send a 1MB message, which gets:
1. Stored in Supabase (cost)
2. Sent to OpenAI as part of the conversation (token cost explosion)
3. Processed by extractPreferences, extractWorkoutProposal, and detectPlanModification (3 more OpenAI calls on the same massive input)

**Impact:** A single malicious request could cost $10+ in OpenAI tokens. Repeated abuse could drain the API budget.

**Fix:** Add `if (message.length > 5000) return NextResponse.json({ error: "Message too long" }, { status: 400 });`

---

### P1-10: Multiple static module-level Supabase clients — no connection pooling

**Files:** `src/lib/coach/usage.ts`, `src/lib/analytics/trends.ts`, `src/lib/analytics/zone-detection.ts`, `src/app/api/webhooks/strava/route.ts`, `src/app/api/cron/*.ts`

**Issue:** At least 8 different files create their own static `SupabaseClient` instances via lazy-init patterns. On Vercel Serverless, this isn't pooling — each is an independent HTTP client. But there's also no cleanup, and the global `let _supabase` pattern means in development (hot reload), old clients linger.

**Impact:** Not a production crasher, but wasteful. In development, you could leak connections.

**Fix:** Create a single shared `getServiceClient()` in `src/lib/supabase/admin.ts` and import everywhere. Minor optimization but improves maintainability.

---

### P1-11: Zone breakthrough confirmation count is always 0

**File:** `src/lib/analytics/zone-detection.ts`, `countRecentBreakthroughs()` (lines 262-276)

```typescript
async function countRecentBreakthroughs(...): Promise<number> {
  // ...query workout_analytics...
  // This is simplified — in production we'd store breakthrough candidates
  // in a dedicated table or JSONB field. For now, return 0...
  return 0; // ← ALWAYS RETURNS 0
}
```

**Issue:** The function always returns 0. This means every single breakthrough detection starts at `confirmCount = 0`, and after adding 1, `totalConfirming = 1`. Since `CONFIRMATION_COUNT = 2`, no breakthrough is ever auto-confirmed on the first detection. But on the *next* detection, it still returns 0 → `totalConfirming = 1` again → never reaches the threshold.

**Impact:** FTP breakthroughs, run zone updates, and swim CSS improvements are **never auto-applied**. The feature is completely non-functional. Users get the "one more confirming workout" message forever.

**Fix:** Implement the actual count by querying the `zone_compliance_details.breakthrough` JSONB field that `storeBreakthroughCandidate` writes to:
```typescript
const { count } = await supabase
  .from("workout_analytics")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)
  .gte("created_at", startDate)
  .contains("zone_compliance_details", { breakthrough: { type } });
```

---

### P1-12: Cron jobs iterate all users sequentially — Vercel timeout risk

**Files:** All cron routes (`daily-checkin`, `recovery-check`, `weekly-outlook`, `plan-extend`, `whoop-sync`)

**Issue:** Every cron job fetches ALL users, then iterates sequentially. For each user: build context (6 parallel DB queries) + call OpenAI. With 50 users: 50 × (context build ~500ms + OpenAI ~2s) = ~125 seconds. Vercel Hobby has 10s timeout, Pro has 60s.

**Impact:** Cron jobs will timeout once user count exceeds ~3-5 users on Hobby, ~20 on Pro. Partial processing with no resumption — some users get check-ins, others don't.

**Fix:**
1. Process users in parallel batches (`Promise.all` with concurrency limit).
2. Or: dispatch individual user processing to separate serverless invocations (fan-out pattern via QStash or Inngest).
3. Or: paginate and use the cron to dispatch, not process.

---

## P2 — Quality / Performance Concerns

### P2-1: `GET /api/chat` doesn't cap the `limit` query param

**File:** `src/app/api/chat/route.ts` line 107

```typescript
const limit = parseInt(url.searchParams.get("limit") || "50");
```

**Issue:** No upper bound. A client could request `?limit=100000` and fetch the entire chat history in one query.

**Fix:** `const limit = Math.min(parseInt(...) || 50, 200);`

---

### P2-2: Chat history fetched twice — once for context, once for conversation

**File:** `src/app/api/chat/route.ts` lines 39-45 + `src/lib/coach/context.ts` lines 109-114

**Issue:** The chat route fetches the last 10 messages (lines 39-45). Then `buildCoachContext` fetches the last 20 messages again (context.ts line 114). These are independent queries hitting Supabase twice for overlapping data.

**Fix:** Fetch once and pass to both consumers.

---

### P2-3: `extractWorkoutProposal` called on every coach response

**File:** `src/app/api/chat/route.ts` lines 64-72

**Issue:** Every single chat response gets an OpenAI call to check if it contains a workout prescription. This adds ~500ms latency and ~$0.0003 per message. For casual conversation ("how are you?"), this is wasted.

**Fix:** Add a heuristic pre-filter (similar to `mightRequestPlanChange` in chat-plan-modifier.ts). Check for workout-related keywords before calling GPT.

---

### P2-4: Weekly outlook cron doesn't check timezone — sends at fixed UTC time

**File:** `vercel.json` + `src/app/api/cron/weekly-outlook/route.ts`

**Issue:** Weekly outlook runs at `0 7 * * 1` (7:00 UTC Monday). For US West Coast users, that's 11PM Sunday night. For Tokyo users, that's 4PM Monday afternoon.

The daily check-in route *does* have timezone awareness (`isApprox6AM`), but weekly outlook doesn't.

**Fix:** Add the same timezone check as daily-checkin, or batch users by timezone.

---

### P2-5: `buildCoachContext` throws on missing profile — crashes entire request

**File:** `src/lib/coach/context.ts` line 121

```typescript
if (!profile) {
  throw new Error(`Profile not found for user ${userId}`);
}
```

**Issue:** If the profile creation trigger fails (e.g., auth user exists but profile doesn't), this throws an unhandled error that propagates up. In cron jobs that iterate users, one bad profile kills the entire cron.

**Fix:** Return a null context and handle gracefully in callers, or `try/catch` in the cron loop (already partially done, but the error message is generic).

---

### P2-6: Strava token refresh has no retry logic

**File:** `src/app/api/webhooks/strava/route.ts`, `getValidStravaToken()` (lines 73-103)

**Issue:** If the token refresh fails (network blip, Strava outage), the error propagates and the webhook event is logged as failed. There's no retry logic, and the event won't be reprocessed since the `webhook_events` table already has it (with `processed: false`).

**Fix:** Add retry logic (exponential backoff, max 2 retries). Or: ensure failed events are re-queued for processing.

---

### P2-7: No workout-to-workout dedup for scheduled matching

**File:** `src/app/api/webhooks/strava/route.ts` lines 155-163

```typescript
const { data: scheduledWorkout } = await supabase
  .from("workouts")
  .select("*")
  .eq("user_id", integration.user_id)
  .eq("scheduled_date", activityDate)
  .eq("workout_type", workoutType)
  .eq("status", "scheduled")
  .single();
```

**Issue:** `.single()` throws if there are 0 or 2+ matches. If a user has two scheduled runs on the same day (e.g., easy run + interval), this will error because `.single()` returns an error for multiple results. Should use `.maybeSingle()` or `.limit(1)`.

**Impact:** Webhook processing fails for users with 2+ same-type workouts on one day.

**Fix:** Use `.maybeSingle()` or `.limit(1).maybeSingle()`, and add matching heuristics (time of day, distance, etc.) to pick the best match.

---

### P2-8: Plan extend doesn't recalculate zones from latest profile data

**File:** `src/lib/coach/plan-engine.ts`, `extendPlan()` (~line 1520)

**Issue:** `extendPlan` reads `planConfig.runPaceZones` and `planConfig.bikePowerZones` from the plan's stored config. But if the user's FTP or pace was updated (via zone detection or chat), the stored config may be stale. The zone detection code updates the plan_config, but there's a window where extend could use old zones.

**Fix:** Always re-derive zones from the profile's current `run_pace_per_km` and `bike_ftp` in `extendPlan`, falling back to plan config as default.

---

### P2-9: Conversation compression deletes messages — no soft delete

**File:** `src/lib/coach/memory.ts` lines 80-85

```typescript
const { error: deleteError } = await supabase
  .from("chat_messages")
  .delete()
  .in("id", idsToDelete);
```

**Issue:** Hard-deletes old messages after summarizing. If the summary is bad or loses critical info, the original messages are unrecoverable. Also, if the summary save succeeds but the delete fails, you get orphaned messages that will be re-summarized next time.

**Fix:** Soft-delete (add a `compressed_at` timestamp) or move to an archive table. Use a transaction or at least check for partial failure.

---

### P2-10: `acceptWorkoutProposal` trusts client-provided proposal data

**File:** `src/app/api/workouts/accept/route.ts` lines 14-17

```typescript
const proposal = body.proposal as WorkoutProposal;
if (!proposal || !proposal.type || !proposal.target_date) { ... }
```

**Issue:** The proposal comes directly from the client with minimal validation. `proposal.type` is checked for existence but not against the valid workout types enum. `target_date` isn't validated as a proper date string. `duration_minutes` and `distance_meters` aren't bounds-checked.

**Fix:** Validate `type` against `VALID_WORKOUT_TYPES`, validate `target_date` format, bounds-check numeric fields.

---

### P2-11: Recovery check cron and WHOOP sync both run adaptation — double adaptation

**Files:** 
- `src/app/api/cron/recovery-check/route.ts` lines 70-82
- `src/app/api/cron/whoop-sync/route.ts` lines 175-185

**Issue:** WHOOP sync fetches recovery data and runs `adaptForRecovery()`. Then recovery-check cron *also* reads recovery data and runs `adaptForRecovery()`. If both run on the same day (WHOOP sync at 10:00 UTC, recovery-check at 15:00 UTC per `vercel.json`), the same user gets adaptation applied twice.

**Impact:** Double volume reduction. If recovery is "red" (30% reduction), applying twice gives 30% + 30% of the already-reduced value = 51% total reduction.

**Fix:** Add an idempotency check: track `last_adaptation_date` per user, or check if adaptation was already run today before executing.

---

### P2-12: `chat-plan-modifier.ts` keyword heuristic is too broad

**File:** `src/lib/coach/chat-plan-modifier.ts`, `mightRequestPlanChange()` (~line 345)

**Issue:** Keywords like "more", "less", "push", "change", "lower", "longer", "shorter", "trip", "running", "swimming", "cycling" are absurdly common in coaching conversations. "I ran a great running session" triggers the keyword check. "Can I push harder on intervals?" triggers it. This means nearly every chat message goes through GPT plan-modification detection.

**Impact:** Unnecessary OpenAI calls (~$0.001 each × every message × every user) and ~500ms added latency per chat. With the fire-and-forget issue (P0-1), these calls are probably dying anyway.

**Fix:** Require 2+ keywords matching, or use more specific phrases. Better: only run detection if the coach's response *acknowledges a change* (simpler heuristic on the response, not the user message).

---

### P2-13: Cron schedule timing conflicts

**File:** `vercel.json`

```json
"daily-checkin":   "0 11 * * *"   // 11:00 UTC
"whoop-sync":      "0 10 * * *"   // 10:00 UTC  
"recovery-check":  "0 15 * * *"   // 15:00 UTC
"plan-extend":     "0 6 * * 1"    // 6:00 UTC Monday
"weekly-outlook":  "0 7 * * 1"    // 7:00 UTC Monday
```

**Issue:**
1. WHOOP sync (10:00) runs *before* daily check-in (11:00). But daily check-in's `handleMissedWorkouts` should run *before* recovery-based adaptation. The ordering is: WHOOP sync → daily check-in → recovery check, which means adaptation may be applied before missed workout handling.
2. Plan extend (6:00 Mon) runs before weekly outlook (7:00 Mon). Plan extend adds workouts that weekly outlook should include. This ordering is correct, but the 1-hour gap could be an issue if plan extend fails.

**Fix:** Reorder: daily check-in → WHOOP sync → recovery check. Or combine into a single orchestrator cron.

---

### P2-14: No request deduplication for plan generation race condition

**File:** `src/app/api/plans/generate/route.ts` lines 67-76

**Issue:** The 30-second race condition guard checks for recently-created active plans. But the check and the insert are not atomic. Two simultaneous requests could both pass the check, then both create plans. The `status: "cancelled"` update on line 78 would cancel the first plan created by the first request, but the second request's plan would also cancel it again — leaving two plans, one cancelled and one active, but with duplicate workouts.

**Fix:** Use a Postgres advisory lock or a `SELECT ... FOR UPDATE` pattern. Or use a `unique` constraint on `(user_id, status)` where `status = 'active'` (partial unique index).

---

## Security Summary

| Issue | Severity | Status |
|-------|----------|--------|
| Open redirect in auth callback | P1 | P1-6 |
| No Strava webhook signature verification | P1 | P1-7 |
| No chat message length limit | P1 | P1-9 |
| Rate limiter non-functional on serverless | P1 | P1-1 |
| Client-trusted workout proposal data | P2 | P2-10 |
| CRON_SECRET/Service key exposed to `getApiUser` | P1 | P1-4 |
| SQL injection risk | None | All queries use Supabase client (parameterized) ✅ |
| Secrets in code | None | All secrets via env vars ✅ |
| CSRF on OAuth flows | Good | Nonce cookie pattern implemented ✅ |
| RLS on all tables | Good | Enabled with appropriate policies ✅ |

---

## Architecture Observations (Not Bugs)

### Good Patterns
1. **Lazy-init pattern** for OpenAI/Supabase clients avoids build-time crashes (except usage.ts — P0-3)
2. **Webhook idempotency** via upsert with `ignoreDuplicates` on `webhook_events`
3. **Adaptive coaching** with style-aware messaging (supportive/balanced/push) is well-designed
4. **Zone detection** with confirmation-based auto-updates is a sound architecture (when `countRecentBreakthroughs` is fixed)
5. **Context building** with parallel Supabase queries is efficient
6. **CSRF protection** on OAuth flows with nonce cookies
7. **Progressive overload** in plan engine with deload weeks

### Architecture Risks
1. **Single-threaded cron processing** will not scale past ~20 users on Vercel Pro
2. **No dead letter queue** for failed webhook events — they're logged but never retried
3. **No graceful degradation** — if OpenAI is down, all coach features fail simultaneously
4. **No streaming** — chat responses wait for full GPT completion before returning (latency)
5. **Coach prompt is ~2000 tokens** before user message — expensive for every chat turn

---

## Recommended Fix Priority

### Immediate (before launch)
1. **P0-1:** Fix fire-and-forget promises (use waitUntil or await)
2. **P0-2:** Fix Strava webhook timeout (queue-based processing)
3. **P0-3:** Fix usage.ts top-level client
4. **P0-4:** Fix schema mismatch
5. **P1-1:** Replace in-memory rate limiter with Upstash
6. **P1-6:** Fix open redirect
7. **P1-9:** Add message length validation

### Before scaling to 50+ users
8. **P1-12:** Fix cron sequential processing (fan-out or parallel)
9. **P1-11:** Fix zone breakthrough confirmation count
10. **P1-3:** Add strava_activity_id unique constraint
11. **P2-11:** Fix double adaptation from recovery check + WHOOP sync

### Quality improvements
12. **P1-2:** Fix OAuth nonce cookie collision
13. **P2-3:** Add heuristic filter for workout extraction
14. **P2-7:** Fix `.single()` → `.maybeSingle()` in workout matching
15. **P2-12:** Tighten plan modification keyword heuristic
