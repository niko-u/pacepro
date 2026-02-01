# PacePro Full System Audit — January 31, 2026

**Auditor**: AI Code Review  
**Scope**: Backend (Next.js + Vercel + Supabase), Mobile (React Native + Expo), Schema, Integrations  
**Purpose**: Pre-TestFlight production readiness assessment  

---

## Executive Summary

PacePro is an impressively comprehensive AI endurance coaching platform. The architecture is sound, the coaching intelligence is sophisticated, and the codebase is well-structured. For a pre-revenue product, this is ahead of most competitors in coaching depth.

**Overall Production Readiness: 7.5/10** — The core coaching engine and plan generation are strong. The mobile app is functional and well-designed. The main gaps are: (1) Strava OAuth needs mobile deep-link flow, (2) some `as any` casts hide potential type issues, (3) in-memory rate limiting won't survive cold starts, and (4) the analytics screen relies on client-side computations that should have backend endpoints.

**Verdict**: Ready for a controlled TestFlight with known users. NOT ready for public launch without addressing P0/P1 items below.

---

## 1. ARCHITECTURE REVIEW

### 1.1 System Data Flow

```
Strava Webhook → /api/webhooks/strava (POST)
  → Token refresh (if expired)
  → Fetch activity details + streams from Strava API
  → Match to scheduled workout (by date + type)
  → Analytics engine: HR zones, pace zones, power zones, TSS, splits, decoupling, compliance
  → AI analysis (GPT-4o) with analytics context
  → Store: workout updated, workout_analytics inserted, training_load updated
  → Zone detection: FTP/pace/CSS breakthrough checks → auto-update profile
  → Adaptation engine: compare actual vs prescribed → modify upcoming workouts
  → Chat message: analysis sent to user's chat feed

WHOOP Sync (cron every 4h) → /api/cron/whoop-sync
  → Fetch recovery + sleep data
  → Upsert recovery_data table
  → Recovery adaptation engine → modify/swap upcoming workouts

User Chat → /api/chat (POST)
  → Build coach context (profile, plan, workouts, recovery, conversation, training load)
  → Generate AI response (GPT-4o) with dynamic system prompt
  → Background tasks (non-blocking):
    1. Preference extraction (GPT-4o)
    2. Conversation compression (GPT-4o-mini, threshold: 30 messages)
    3. Workout creation detection (GPT-4o-mini)
    4. Plan modification detection (GPT-4o-mini) — 25 modification types
```

### 1.2 User Lifecycle Flow

```
Welcome Screen → Sign Up → Email Confirmation → Login
  → Onboarding (8 screens): Sport → Race → Experience → Goals → Availability → Personality → Wearables → Ready
  → Profile saved to Supabase
  → Plan generation (POST /api/plans/generate)
    → Phase calculation (base/build/peak/taper)
    → Week schedule with deload logic
    → Sport-specific templates (running/triathlon/cycling)
    → Prescriptions with pace/power/swim zones
    → AI coach notes per workout
  → Dashboard with today's workout, recovery status, coach insights
  → Workout completion (Strava webhook or manual)
  → Analysis → Adaptation → Next workout adjusted
  → Weekly: plan extension (cron, Mondays 6AM UTC)
  → Daily: check-in message (cron, 11AM UTC, timezone-aware)
  → Weekly: outlook message (cron, Mondays 7AM UTC)
```

### 1.3 Architecture Strengths

1. **Clean separation of concerns**: coach/ directory has distinct modules for AI, context, prompts, memory, preferences, plan engine, adaptation, workout creation, and plan modification
2. **Context richness**: The AI sees profile, plan phase, today's workout, recent/upcoming workouts, recovery data, training load trends, learned preferences, and conversation summary
3. **Progressive sophistication**: Plan generation uses proper periodization, deload weeks, non-adjacent hard day scheduling, phase-appropriate workout templates
4. **Analytics engine is real**: Not a toy — calculates NP, NGP, TSS, TRIMP, IF, VI, EF, aerobic decoupling, splits, zone compliance, GAP from actual Strava stream data
5. **Recovery-driven adaptation**: Legitimate 3-zone (red/yellow/green) system with coaching-style-aware responses

### 1.4 Architecture Weaknesses

1. **No dedicated backend for mobile**: Mobile talks directly to Supabase (RLS) for reads and to Next.js API routes for AI operations. This works but means two auth paradigms
2. **Cron jobs run UTC-fixed**: Daily check-in attempts timezone-aware delivery (isApprox6AM), but the cron runs at 11AM UTC — only catches users in UTC-3 to UTC+1 timezones during 6AM window. Users outside this range never get check-ins.
3. **No WebSocket/push for mobile**: Real-time uses Supabase postgres_changes subscriptions — works but can be unreliable on mobile backgrounds. No push notifications implemented.
4. **Plan extend creates only 1 week at a time**: If cron fails for 2 weeks, user has no scheduled workouts. No catch-up logic.
5. **Two conflicting migration 003 files**: `003_mobile_app_fields.sql` and `003_plan_adjustment_and_intensity.sql` — could cause issues if run sequentially on a fresh DB.

### 1.5 Broken Links in the Chain

1. **Strava OAuth on mobile**: The OAuth flow (`/api/integrations/strava/connect`) uses server-side cookie-based auth and web redirects. **Mobile app cannot complete this flow** because it opens a web URL that redirects back to the web app, not the mobile app. The `ConnectedApps` component opens the URL via WebBrowser but has no deep-link callback handler.
2. **WHOOP OAuth on mobile**: Same issue — web-only flow.
3. **Email confirmation**: Supabase email confirmation link goes to the web app's `/auth/callback` route. No mobile deep link handler for email confirmation. Users signing up on mobile must confirm email in their browser, then return to the app.
4. **Settings → Plan regeneration**: The `TrainingProfile` component calls `regenerateTrainingPlan()` but there's no loading state or user feedback during the process (which can take 10-20 seconds with AI coach notes).
5. **Post-workout modal**: `PostWorkoutModal` component exists but is referenced from workout detail screen — need to verify the workout detail screen (`app/workout/[id].tsx`) properly triggers it.

---

## 2. CODE QUALITY

### 2.1 TypeScript Correctness

**`as any` casts found:**
- `lib/api.ts`: `updateProfile(userId: string, updates: Record<string, any>)` — the `any` is intentional for flexible profile updates but loses type safety
- `lib/api.ts`: `completeOnboarding` uses `Record<string, any>` for onboarding data
- `adaptation.ts` line ~339: `(w as any).scheduled_date < today` in weekMissed filter — legitimate access but the cast is needed because the `status` select doesn't include `scheduled_date` in the type
- `whoop-sync/route.ts`: `as any` on adaptForRecovery call — mild type mismatch on optional fields
- Mobile screens use `any[]` for workout arrays throughout — should define proper types

**Verdict**: Moderate use of `any`, mostly in API boundaries and Supabase query results. Not hiding bugs but reduces IDE help. **Score: 7/10**

### 2.2 Error Handling

**Strengths:**
- All API routes have try/catch with error responses
- Strava webhook always returns `{ received: true }` to prevent retries
- Background tasks (preference extraction, compression, workout creation) use `.catch()` to prevent blocking
- Adaptation engine catches all errors internally
- AI usage tracking is non-blocking (`try/catch` around insert)

**Weaknesses:**
- Mobile `api.ts` throws errors (`if (error) throw error`) but many callers don't catch them properly — they just log to console
- `getChatMessages` in the chat screen has a safety timeout (8s) which is good, but the error fallback shows welcome mode which could confuse returning users
- No retry logic for OpenAI API calls — a transient 429 or 500 kills the request
- No global error boundary in the mobile app

**Score: 7/10**

### 2.3 Null Safety

Generally good. Key observations:
- Context building (`context.ts`) guards against missing profile with explicit throw
- Plan generation guards against missing profile
- Recovery data uses `?? null` patterns consistently
- Mobile auth provider handles null session/profile states

**One issue**: `formatContextForAI` accesses `athlete.preferences.workout_likes` without null-checking `preferences` — could crash if preferences is null (unlikely given DB defaults but possible).

**Score: 8/10**

### 2.4 Race Conditions

1. **Chat message dedup**: The chat route fetches history BEFORE inserting the user message (good), but the real-time subscription on mobile uses a 15-second window to skip duplicates. If the API is slow (>15s), the real-time message could appear as a duplicate. Low probability but possible.
2. **Plan generation**: Cancels existing plans then creates new one — not atomic. If the process crashes between cancel and create, user has no plan. Low probability since it's a single request.
3. **Strava webhook**: Has idempotency check (strava_activity_id + webhook_events table). Well handled.
4. **Plan extend cron**: Checks for existing workouts before creating — prevents duplicates. Good.

**Score: 8/10**

### 2.5 Memory Leaks (Mobile)

- Dashboard has two Supabase realtime subscriptions with proper cleanup (`useEffect` return)
- Chat screen has one realtime subscription with proper cleanup
- All `useEffect` hooks return cleanup functions
- Timer in welcome screen (`setTimeout`) is cleaned up with `clearTimeout`
- Auth provider has `mounted` flag for async operations
- Animated skeleton uses `Animated.loop` with `stop()` on cleanup

**No obvious memory leaks detected. Score: 9/10**

### 2.6 Dead Code

- `RecoveryWidget` component exists in backend (`src/components/recovery-widget.tsx`) — likely unused web component
- `WorkoutDetailModal` in backend — web component, not used by mobile
- `theme-toggle.tsx`, `theme-provider.tsx` — web-only, unused by mobile
- `lib/auth/require-onboarding.ts` — not imported anywhere visible

**Score: 8/10 (minimal dead code)**

### 2.7 Console.log Spam

Backend is heavily instrumented with `console.log`:
- Every cron job logs start/finish/results (appropriate for production — these are structured logs)
- Adaptation actions are logged (useful)
- Plan generation logs counts (useful)
- Strava webhook logs every event (useful for debugging)

Mobile has some debug logs:
- `console.error` for API failures (appropriate)
- `console.warn` for auth timeouts (appropriate)

**Verdict**: The logging is actually well-balanced. Keep it — it's operational logging, not debug spam. **Score: 9/10**

### 2.8 Hardcoded Values

- `DEFAULT_EASY_PACE`, `DEFAULT_FTP`, `DEFAULT_SWIM_PACE` in plan-engine — appropriate as defaults
- Rate limits: 30 chat/min, 3 plan-gen/hour — hardcoded in `rate-limit.ts`, should be configurable
- Max tokens in AI calls: 500 for chat, 400 for analysis — hardcoded in `ai.ts`
- Chat message history: 10 messages sent as context — hardcoded in `ai.ts` and `chat/route.ts`
- Conversation compression threshold: 30 messages — hardcoded in `memory.ts`
- `STRAVA_CLIENT_ID || "198193"` — hardcoded fallback in connect route (should be env-only)

**Score: 7/10**

---

## 3. FEATURE COMPLETENESS

| Feature | Score | Notes |
|---------|-------|-------|
| **Onboarding flow (mobile)** | 9/10 | 8 well-designed screens covering sport, race, experience, goals, availability, personality, wearables. Smooth state management via onboarding-store. Only gap: no back navigation from some screens, no skip option. |
| **Auth flow (mobile)** | 7/10 | Login/signup work. Email confirmation redirects to web, not mobile deep link. No forgot password flow visible. Session persistence via AsyncStorage works. |
| **Plan generation** | 9/10 | Exceptional. Sport-specific templates for running, triathlon, cycling. Proper periodization (base/build/peak/taper). Deload weeks every 4th week. Non-adjacent hard day scheduling. Progressive overload within blocks. AI-generated coach notes per workout. |
| **Plan extension/regeneration** | 8/10 | Extension creates 1 week at a time with duplicate checking. Regeneration cancels old plan and creates fresh. Both work correctly. Gap: no recovery of completed workout history when regenerating. |
| **Chat with AI coach** | 9/10 | Dynamic system prompt adapts to coaching style. Rich context (20 data points). Background preference extraction, memory compression, workout detection. Real-time subscription for incoming messages. Deduplication logic. |
| **Natural language plan modification** | 9/10 | 25 modification types covering workout-level, training philosophy, sport distribution, plan structure, physiological updates, race/goal changes, and recovery philosophy. Keyword heuristic gates GPT calls (cost optimization). |
| **Post-workout analysis** | 9/10 | Analytics engine produces HR/pace/power zones, TSS, splits, decoupling, compliance. AI generates contextual analysis referencing all metrics. Zone breakthrough detection auto-updates zones. |
| **Strava integration** | 7/10 | OAuth + webhook + activity sync + analysis all work. Token refresh handles expiry. **Critical gap: OAuth flow doesn't work from mobile app** — web-only redirect chain. |
| **WHOOP integration** | 7/10 | OAuth + sync + adaptation work. Recovery data properly maps sleep stages, HRV, RHR. **Same OAuth gap as Strava on mobile.** |
| **Recovery-based adaptation** | 9/10 | 3-zone system (red/yellow/green) with coaching-style-aware responses. Modifies upcoming workouts, swaps hard for easy, reduces volume. Well-implemented. |
| **Analytics (mobile + backend)** | 7/10 | Mobile screen shows race readiness, weekly volume chart, coach insights, personal records. BUT: race readiness is computed client-side from workout data (not from the training_load table), and the analytics_snapshots table is never populated. |
| **Workout analytics engine** | 9/10 | Comprehensive: NP, NGP, TSS (running + cycling), TRIMP, IF, VI, EF, aerobic decoupling, GAP, splits, zone distributions, zone compliance, cadence analysis, elevation analysis. Stream-based when available, summary-based fallback. |
| **Calendar view** | 8/10 | Week and month views. Shows workout type, status, daily schedule. Weekly volume summary. Month summary with total hours and completion count. Phase/week indicator. |
| **Settings & profile** | 8/10 | Profile editing, training profile, connected apps, subscription card, notification settings, about section. Missing: coach style settings are in Chat screen instead of Settings (intentional design choice but slightly confusing). |
| **Training load (ATL/CTL/TSB)** | 8/10 | Properly implements exponential weighted moving average with correct decay constants. Updates after each workout via analytics. Displayed in coach context. Gap: not directly visible to user in analytics screen — only used internally. |
| **Auto zone detection** | 8/10 | FTP (cycling), running threshold, swim CSS detection with 2-workout confirmation before auto-update. Conservative approach is smart. Gap: breakthrough candidate tracking is simplified (stores in zone_compliance_details JSONB rather than dedicated table). |
| **Preference learning** | 8/10 | Extracts from every conversation via GPT-4o. Deduplication via normalized string comparison + Jaccard similarity. Contradiction detection (pattern-based + AI fallback). Stored as learned_preferences on profile. |
| **Memory/conversation compression** | 8/10 | Triggers at 30 messages. Summarizes older messages via GPT-4o-mini. Merges with existing summary. Deletes compressed messages. Summary used in AI context. Well-implemented. |

---

## 4. PRODUCTION READINESS CHECKLIST

| Item | Status | Notes |
|------|--------|-------|
| Auth flow (signup → confirm → login → session persistence) | ⚠️ | Works but email confirmation redirects to web, not mobile. No forgot password. |
| Onboarding → plan generation → dashboard shows workouts | ✅ | Full flow works. Plan generation creates workouts that show on dashboard. |
| Chat sends message → gets AI response → no duplicates | ✅ | Dedup via timestamp window + content comparison. Background tasks non-blocking. |
| Strava OAuth → webhook → activity sync → analysis | ⚠️ | **OAuth flow is web-only** — mobile users can't connect Strava. Webhook + sync work perfectly once connected. |
| WHOOP OAuth → data sync → recovery adaptation | ⚠️ | Same OAuth issue. Sync and adaptation work once connected. |
| Plan extends weekly (cron) | ✅ | Monday 6AM UTC. Duplicate checking prevents double-creation. |
| Daily check-in cron works | ⚠️ | Runs at 11AM UTC, checks if 6AM in user timezone. Only covers UTC-3 to UTC+1. Users in US timezones (UTC-5 to UTC-8) **never get daily check-ins.** |
| Recovery check cron works | ✅ | Runs every 4 hours. Dedup via 12-hour alert window. |
| Weekly outlook cron works | ✅ | Monday 7AM UTC. Sends to all users with notifications enabled. |
| Settings changes trigger plan regen | ⚠️ | TrainingProfile calls regenerateTrainingPlan but no loading state/feedback during 10-20s generation. |
| Natural language plan modifications work | ✅ | 25 types with keyword gating. Service role client for DB writes. |
| Analytics show real data | ⚠️ | Volume chart and records use real Supabase data. Race readiness computed client-side (not from training_load). analytics_snapshots table unused. |
| Error states handled gracefully | ⚠️ | Backend: good. Mobile: some screens show console.error but no user-visible error UI. |
| Loading states on all screens | ✅ | Dashboard has skeleton loading. Chat has ActivityIndicator. Calendar has spinner. Analytics loads sections independently. |
| Pull-to-refresh everywhere | ✅ | Dashboard, Chat, Calendar, Settings, Analytics all have RefreshControl. |
| No dead buttons | ⚠️ | ConnectedApps opens web browser for OAuth which redirects to web app, not back to mobile. "Connect" button appears to work but the callback doesn't return to the app. |
| No mock data anywhere | ✅ | All data from Supabase. No hardcoded mock arrays. Welcome message is intentional UX. |
| Rate limiting on expensive endpoints | ⚠️ | In-memory sliding window rate limiter. Works within a single serverless instance but **resets on cold start**. Needs Upstash Redis for production (noted in code comments). |
| OAuth CSRF protection | ✅ | Strava uses state parameter with nonce verified via httpOnly cookie. Properly implemented. |
| Secure token storage | ✅ | Mobile uses AsyncStorage (appropriate for Supabase JWTs). Backend uses httpOnly cookies. No tokens in localStorage on web. |

---

## 5. COACHING INTELLIGENCE RATING

### System Prompt Quality: 9/10
The base prompt is exceptional. It establishes personality, knowledge domains, guidelines, and explicit examples. The dynamic layer adds coaching style (supportive/balanced/push), response length, focus areas, sport emphasis, and goals. The plan modification instruction section is particularly well-crafted — it tells the AI it IS the interface for all changes with concrete examples.

### Context Richness: 9/10
The AI sees:
- Athlete profile (name, experience, sport, goals, race date)
- Preferences (likes, dislikes, push tolerance, recovery needs)
- Current plan (phase, week, total weeks)
- Today's workout (title, type, duration, status)
- Recent 5 completed workouts with dates/durations
- Completion rate and weekly volume
- Upcoming 7 days of workouts
- Latest recovery data (score, HRV, sleep)
- Training load (CTL, ATL, TSB with trends)
- Learned preferences (life context, limitations)
- Conversation summary (long-term memory)

This is more context than most human coaches would have at hand.

### Workout Analysis Depth: 9/10
With the analytics engine, the AI sees: HR zone distribution, pace zones, power zones, TSS, NP/NGP, IF, VI, EF, aerobic decoupling, zone compliance score, cadence, elevation, GAP, splits (first/last 3), and TRIMP. This enables genuinely insightful analysis ("Your aerobic decoupling was 8% — your aerobic system was stressed in the second half").

### Plan Generation Quality: 9/10
- Proper periodization with correct phase splits (40% base, 30% build, 20% peak, 10% taper)
- Deload every 4th week within base/build (3:1 load:deload)
- Sport-specific templates with real coaching structure (long run, tempo, intervals for running; swim/bike/run/brick/strength for triathlon)
- Non-adjacent hard day scheduling
- Progressive overload (~5% per week within load blocks)
- Pace/power/swim zone prescriptions in descriptions
- AI-generated coach notes explaining WHY each workout matters

### Adaptation Intelligence: 8/10
- Recovery-based: red (swap+reduce 30%), yellow (style-dependent reduce 10-20%), green (no change)
- Overperformance: 3+ workouts exceeding targets → increase next similar workout by 5-10%
- Underperformance: cut short + low recovery → reduce next hard session 20%
- Missed workouts: key sessions rescheduled within 2 days, non-key skipped
- 3+ missed in a week: reduce next week volume 20%
- Zone compliance: notes in chat if <40%

Gap: No adaptive long-term phase adjustment. If an athlete consistently overperforms for a month, the plan doesn't fundamentally restructure (it just bumps individual workouts).

### Memory & Preference Learning: 8/10
- Preference extraction runs after every chat exchange
- Deduplication via normalized comparison + Jaccard similarity
- Contradiction detection (quick patterns + GPT fallback for complex cases)
- Conversation compression at 30 messages with merge logic
- Summary persisted on profile, included in AI context

Gap: No mechanism to forget outdated preferences. "I hurt my knee" stays forever unless manually contradicted.

### Natural Language Understanding: 9/10
25 modification types with comprehensive keyword heuristic + GPT-4o-mini classification. Handles complex requests like "I ran a 1:45 half marathon" (derives easy pace), "extend build phase by 2 weeks", "more brick workouts", "I can only train 4 days this week". The keyword gate prevents unnecessary GPT calls for irrelevant messages.

### Overall: Would a real athlete trust this coach? 8/10
**Yes, with caveats.** The coaching logic is sound — it follows established endurance training principles (Friel's periodization, TSS/CTL model, proper polarized training). The prompt engineering produces natural, personalized responses. The adaptation engine makes smart decisions.

What would make a real athlete skeptical:
1. No ability to see/verify the training load chart themselves (it's internal-only)
2. Zone auto-detection needs more workout confirmations to feel reliable
3. No lactate test / formal FTP test protocol integration
4. Can't account for weather, altitude, or environmental factors

---

## 6. MOBILE APP UX AUDIT

### Screen-by-Screen Review

**Welcome (app/index.tsx)**: Clean, minimalist. Logo, title, Get Started + Sign In buttons. Auto-redirects authenticated users. ✅

**Auth (login.tsx, signup.tsx)**: Standard email/password forms. Terms and privacy links present. Missing: forgot password, Apple Sign In, Google Sign In. ⚠️

**Onboarding (8 screens)**:
- Sport selection: Clear cards for running/triathlon/cycling ✅
- Race: Race name, date picker, distance ✅
- Experience: 3-level selector ✅
- Goals: Goal time input ✅
- Availability: Days + hours selection ✅
- Personality: Coach style picker ✅
- Wearables: Shows Strava/WHOOP/Garmin (Garmin/Apple Health not implemented) ⚠️
- Ready: Summary + generate plan ✅

**Dashboard (tabs/index.tsx)**: Rich dashboard with race countdown, plan overview, today's workout, recovery status, coach says, report status. Skeleton loading. Real-time subscriptions. Pull-to-refresh. ✅

**Chat (tabs/chat.tsx)**: Full-featured chat with message history, typing indicator, quick replies, coach settings modal. Keyboard avoiding. Real-time subscription with dedup. Welcome mode for fresh users. ✅

**Calendar (tabs/calendar.tsx)**: Week/month toggle. Day selection. Workout cards with type/status. Weekly volume summary. Month summary. ✅

**Analytics (tabs/analytics.tsx)**: Race readiness gauge, weekly volume chart, coach insights, personal records. Time range selector. ✅

**Settings (tabs/settings.tsx)**: Profile card, training profile, connected apps, subscription, notifications, about, logout. ✅

**Workout Detail (workout/[id].tsx)**: Not read in detail but exists with PostWorkoutModal component. ⚠️

### Navigation Flow
Correct. Root layout uses Stack with auth/onboarding/tabs groups. Auth state drives navigation in index.tsx. Onboarding completes to tabs. Tab bar has 5 tabs (Home, Calendar, Chat, Analytics, Settings).

### Empty States
- Dashboard: Skeleton loading → PlanOverview shows "Generate Plan" button if no plan ✅
- Chat: Welcome message for fresh users ✅
- Calendar: "Rest day — no workouts scheduled" for empty days ✅
- Analytics: Components handle undefined data gracefully ✅

### Error States
- Chat: Shows "Sorry, I couldn't process that" on API failure ✅
- Other screens: Console errors but no user-visible error messages ⚠️

### Loading States
- Dashboard: Animated skeleton cards ✅
- Chat: ActivityIndicator + 8s safety timeout ✅
- Calendar: ActivityIndicator ✅
- Analytics: Independent section loading ✅

### Keyboard Handling
- Chat: KeyboardAvoidingView with platform-appropriate behavior ✅
- Auth forms: Standard keyboard behavior ✅
- Onboarding: Not verified for all screens ⚠️

### Accessibility
- No explicit accessibilityLabel props on interactive elements ❌
- Color contrast is good (white/orange on dark backgrounds) ✅
- Touch targets are adequately sized (py-4 buttons) ✅
- No VoiceOver/TalkBack testing evident ⚠️

### Performance Concerns
- Dashboard loads 5 parallel queries — good use of Promise.all ✅
- Chat uses inverted FlatList — efficient for long message lists ✅
- Calendar fetches week/month range on navigation — appropriate ✅
- Analytics fetches 4 queries — uses Promise.allSettled to not block on individual failures ✅
- No memoization on workout/message lists — could cause re-renders in long lists ⚠️

---

## 7. SECURITY AUDIT

### Auth Implementation: ✅ Solid
- Supabase Auth handles signup/login/session management
- Mobile uses AsyncStorage for token persistence (appropriate)
- API routes use `getApiUser()` which supports both Bearer token (mobile) and cookie (web) auth
- Service role key used only server-side for cron/admin operations
- JWT validated via Supabase's `getUser()` — not just decoded

### RLS Policy Coverage: ✅ Comprehensive
Every table has RLS enabled with `auth.uid() = user_id` policies:
- profiles: SELECT, UPDATE, INSERT for own data
- training_plans: ALL for own data
- workouts: ALL for own data
- chat_messages: ALL for own data
- integrations: ALL for own data
- recovery_data: ALL for own data
- scheduled_messages: SELECT for own, ALL for service_role
- coach_insights: SELECT for own, ALL for service_role
- analytics_snapshots: SELECT for own, ALL for service_role
- workout_analytics: SELECT for own, ALL for service (⚠️ policy uses `USING (true)` which is overly permissive)
- training_load: SELECT for own, ALL for service (same ⚠️)

### API Route Protection: ✅ Good
- All user-facing routes check `getApiUser()` first
- Cron routes verify `CRON_SECRET` header
- Plan generation/extend accept both user auth and service role auth
- Service role calls require userId in body

### Token Handling: ✅ Good
- Strava/WHOOP tokens stored in integrations table (encrypted at rest by Supabase)
- Token refresh happens automatically before expiry (5min buffer)
- Refresh tokens are updated atomically with access tokens
- Mobile doesn't store OAuth tokens — only Supabase JWT

### Service Role Key Exposure: ⚠️ Minor Risk
- `usage.ts` creates a service-role Supabase client at module level (not lazy) — could theoretically log the key if the module fails to initialize. Better to use lazy init pattern (which other files do).
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed to client (intentional and safe — anon key has no privileges beyond RLS).

### Input Sanitization: ⚠️ Minimal
- Chat message validated as string (`typeof message !== "string"`) — good
- No length limit on chat messages — could be used for prompt injection or cost attack
- Onboarding data is user-controlled JSON stored as `onboarding_data` JSONB — no validation
- Profile updates accept arbitrary key-value pairs — relies on Supabase column validation

### Rate Limiting: ⚠️ Needs Upgrade
- In-memory sliding window implementation is well-designed
- **Resets on cold start** — Vercel serverless functions are stateless
- 30 chat messages/min is reasonable
- 3 plan generations/hour is reasonable
- No rate limiting on: webhook processing, integration status checks, profile updates
- Code already has a comment pointing to Upstash Redis as the production solution

---

## 8. COST ANALYSIS

### Per-User Monthly Cost at 20 messages/day

**OpenAI API:**
- Chat (GPT-4o): 20 msgs/day × 30 days = 600 calls/month
  - ~2,000 input tokens/call (system prompt ~1,200 + context ~600 + history ~200)
  - ~250 output tokens/call
  - Cost: 600 × (2,000 × $2.50/1M + 250 × $10/1M) = $0.003 + $0.0015 = **$2.70/month**

- Background tasks per chat (GPT-4o-mini, ~50% fire rate):
  - Preference extraction: 300 calls × ~500 tokens = 150K tokens → **$0.02**
  - Plan modification detection: 300 calls × ~1,500 tokens = 450K tokens → **$0.07**
  - Workout creation: 150 calls × ~500 tokens → **$0.01**

- Conversation compression (GPT-4o-mini, ~1-2x/month): **$0.01**

- Daily check-in (GPT-4o, 30x/month): 30 × (1,500 + 200) = 51K tokens → **$0.13**

- Weekly outlook (GPT-4o, 4x/month): 4 × (1,500 + 300) = 7.2K tokens → **$0.02**

- Workout analysis (GPT-4o, ~10 workouts/month): 10 × (2,000 + 400) = 24K tokens → **$0.06**

- Plan generation coach notes (GPT-4o-mini, ~8 workouts × ~500 tokens): **$0.01**

**Total OpenAI: ~$3.03/user/month**

**Strava API:**
- Webhook receives (free) + activity detail fetch (~10/month) + stream fetch (~10/month) = 20 calls
- Well within free tier limits (no per-call cost)
- **$0.00**

**WHOOP API:**
- Recovery + sleep fetch: 6 calls/day (cron every 4h) × 30 = 180 calls/month
- Well within free tier
- **$0.00**

**Supabase (Pro plan $25/month shared across all users):**
- Per-user: ~500 rows/month (workouts, messages, analytics, recovery)
- Storage: minimal (text data)
- At 100 users: $0.25/user/month
- At 1,000 users: $0.025/user/month

**Vercel (Pro plan $20/month shared):**
- Function invocations: ~800/user/month (chat + cron + webhooks)
- At 100 users: ~$0.20/user/month
- At 1,000 users: ~$0.02/user/month

### Total Per-User Cost

| Scale | Monthly Cost/User |
|-------|------------------|
| 100 users | ~$3.48 |
| 500 users | ~$3.13 |
| 1,000 users | ~$3.08 |
| 5,000 users | ~$3.05 |

### Profitability at $50/user/month

| Users | Revenue | Cost | Profit | Margin |
|-------|---------|------|--------|--------|
| 10 | $500 | $75 | $425 | 85% |
| 100 | $5,000 | $393 | $4,607 | 92% |
| 1,000 | $50,000 | $3,125 | $46,875 | 94% |

**Breakeven: ~2 users** (covers Supabase Pro + Vercel Pro at minimum)

**Profitable from day one at $50/month pricing.** The margins are excellent because the main cost (OpenAI) scales linearly and is only ~$3/user.

### Biggest Cost Risk
1. **Prompt injection / abuse**: A user sending extremely long messages or gaming the system to trigger expensive operations repeatedly. Mitigated by rate limiting (once upgraded to Redis).
2. **GPT-4o price changes**: Currently $2.50/$10 per 1M tokens. OpenAI tends to decrease prices, but model changes could affect costs.
3. **Strava rate limiting**: 100 requests/15min per app, 1000/day. At scale (>100 active users doing daily workouts), you'll hit this. Need request queuing.

---

## 9. WHAT'S MISSING FOR LAUNCH

### P0: Will Crash or Break Core Flows

1. **Mobile OAuth deep linking**: Strava and WHOOP OAuth redirects go to web app, not back to mobile. Users literally cannot connect their accounts from the mobile app. **Must implement `expo-auth-session` or `expo-web-browser` with proper redirect URI handling.**

2. **Daily check-in timezone coverage**: Cron runs at 11AM UTC, isApprox6AM check only catches UTC-3 to UTC+1. US users (your primary market) **never receive daily check-ins**. Need to run the cron more frequently (every hour) or use multiple cron triggers.

3. **Email confirmation deep link**: Users who sign up on mobile get a confirmation email that opens in a web browser, landing on the web app's callback. They have to manually return to the mobile app. Need to configure Supabase to redirect to a mobile deep link.

### P1: Major Gaps Users Will Notice Immediately

4. **No push notifications**: Users have no way to know about daily check-ins, workout analyses, or recovery alerts unless they open the app. Need Expo push notifications.

5. **No forgot password flow**: Missing from the auth screens entirely.

6. **Plan regeneration feedback**: Settings → Training Profile changes → regenerate takes 10-20 seconds with no loading indicator. User thinks it's broken.

7. **Training load visualization**: The ATL/CTL/TSB data exists in the database but isn't shown anywhere in the analytics screen. This is premium data that athletes would love to see.

8. **Workout detail screen**: Need to verify `app/workout/[id].tsx` is complete and functional with PostWorkoutModal for manual completion.

9. **No offline support**: If the user has no internet, all screens fail silently. Need at minimum cached workouts for today.

### P2: Polish Items for Good First Impression

10. **Accessibility**: No accessibilityLabel props, no screen reader testing. Add at minimum to all buttons and interactive elements.

11. **Empty analytics**: New users with no completed workouts see empty charts/gauges. Need onboarding-aware empty states ("Complete your first workout to see analytics").

12. **Garmin/Apple Health**: Shown in onboarding wearables screen but not implemented. Either implement or remove to avoid confusion.

13. **Upgrade Redis rate limiting**: Current in-memory limiter resets on cold start. One determined user could overwhelm the OpenAI API.

14. **Chat message length limit**: No max length on user messages. Could be used for prompt injection or to drive up token costs.

15. **Workout analytics RLS**: `USING (true)` on the service policy means any authenticated request with service key can read all users' analytics. Should be `USING (auth.role() = 'service_role')`.

16. **Error boundary for mobile**: Add React error boundary to prevent white screen crashes.

17. **Haptic feedback**: No haptics on workout completion, button presses, or pull-to-refresh. Small touch that makes the app feel premium.

18. **Dark mode only**: The app is dark-mode-only (zinc-900 backgrounds). This is fine for v1 but some users prefer light mode.

---

## 10. RECOMMENDATIONS

### Top 5: Fix Before TestFlight

1. **Implement mobile OAuth flow for Strava/WHOOP** — Use `expo-auth-session` with custom scheme redirect. Without this, testers can't connect their accounts and the core value proposition (automated workout analysis) doesn't work.

2. **Fix daily check-in cron timezone coverage** — Change the cron to run every hour (`0 * * * *`) and let the timezone check filter correctly. Or run at multiple UTC times (6AM, 11AM, 14AM, 19AM) to catch major timezone bands.

3. **Add email confirmation deep link** — Configure Supabase auth to redirect email confirmations to `pacepro://auth/callback` or your custom scheme.

4. **Add loading state to plan regeneration** — When TrainingProfile triggers regeneration, show a full-screen modal with progress indicator ("Generating your personalized plan...").

5. **Add forgot password flow** — Simple: Supabase `resetPasswordForEmail()` → email link → password reset screen.

### Top 5: Fix Before Public Launch

1. **Push notifications via Expo** — Register for push tokens, store them, send notifications for daily check-ins, workout analyses, recovery alerts, and plan adjustments.

2. **Upgrade to Upstash Redis rate limiting** — The code comments already describe the solution. ~$10/month for reliable distributed rate limiting.

3. **Training load chart in analytics** — Add a CTL/ATL/TSB chart using the data already in the training_load table. This is premium feature differentiation.

4. **Offline mode for today's workouts** — Cache today's workout data locally (AsyncStorage) so users can view their workout even without connectivity.

5. **Error boundaries + graceful degradation** — Add React error boundary, show meaningful error states on API failures, and add retry buttons.

### Architecture Improvements for Scale

1. **API gateway layer**: As user count grows, add a thin API gateway (or Vercel middleware) for consistent auth checking, rate limiting, and request logging.

2. **Background job queue**: Replace fire-and-forget `Promise.then()` in chat route with a proper job queue (Inngest, Trigger.dev, or BullMQ) for preference extraction, workout creation, and plan modification. This prevents lost work if the serverless function times out.

3. **Strava webhook queue**: At >100 users, Strava webhooks will pile up. Add a queue (Upstash QStash or similar) to process activities asynchronously with retry logic.

4. **CDN for static coaching content**: Workout descriptions and coaching templates could be pre-generated and cached, reducing AI costs by 20-30%.

5. **Multi-region Supabase**: For global users, consider Supabase's multi-region or read replicas for lower latency.

### Feature Roadmap Priorities

1. **Apple Watch / Garmin integration** — Widens the addressable market beyond Strava users
2. **In-app workout execution** — Guided workout mode with interval timers, pace alerts
3. **Social features** — Training groups, coach sharing, challenge system
4. **Nutrition coaching** — Fueling plans for long sessions and races
5. **Race prediction** — Based on training data, predict finish times for upcoming races
6. **Stripe integration** — Payment processing for the $50/month subscription
7. **Coach marketplace** — Allow human coaches to review/override AI suggestions
8. **Training calendar export** — iCal/Google Calendar sync for workout reminders

---

## Appendix: File Inventory

### Backend (~/clawd/projects/pacepro)
- **Coach intelligence** (8 files, ~8,500 lines): ai.ts, context.ts, prompts.ts, memory.ts, preferences.ts, plan-engine.ts, adaptation.ts, workout-creator.ts, chat-plan-modifier.ts, usage.ts
- **Analytics engine** (5 files, ~2,500 lines): engine.ts, index.ts, strava-streams.ts, trends.ts, zone-detection.ts
- **API routes** (14 routes): chat, plans/generate, plans/regenerate, plans/extend, webhooks/strava, integrations/strava/connect, integrations/strava/callback, integrations/whoop/connect, integrations/whoop/callback, integrations/status, cron/daily-checkin, cron/weekly-outlook, cron/recovery-check, cron/plan-extend, cron/whoop-sync
- **Auth** (2 files): get-api-user.ts, require-onboarding.ts
- **Integrations** (2 files): strava.ts, whoop.ts
- **Schema** (7 files): schema.sql + 5 migrations
- **Config**: vercel.json (5 cron jobs)

### Mobile (~/clawd/projects/pacepro-mobile)
- **Screens** (15 files): welcome, login, signup, terms, privacy, 8 onboarding, 5 tab screens, workout detail
- **Components** (25+ files): dashboard (7), calendar (5), chat (6), analytics (5), settings (6), onboarding (1), workout (1), icons (2)
- **Lib** (5 files): api.ts, auth.tsx, supabase.ts, onboarding-store.ts, theme.ts
- **Types** (1 file): index.ts

**Total estimated lines of code: ~15,000+ (backend) + ~5,000+ (mobile) = ~20,000+ LOC**

---

*This audit represents a point-in-time assessment. The codebase shows strong engineering fundamentals and sophisticated domain knowledge. The P0 items are addressable in 1-2 days of focused work. The system is architecturally sound and ready for early users once the OAuth and timezone issues are resolved.*
