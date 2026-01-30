# Coach Architecture — PacePro AI Brain

## Overview

The coach brain has 5 layers that work together to deliver personalized, adaptive training:

```
┌──────────────────────────────────────────────────────┐
│  LAYER 5: PROACTIVE OUTREACH                         │
│  Morning check-in, post-workout analysis,            │
│  weekly outlook, recovery alerts, nudges             │
├──────────────────────────────────────────────────────┤
│  LAYER 4: ADAPTATION ENGINE                          │
│  Reacts to real data — adjusts future workouts       │
│  based on performance, recovery, missed sessions     │
├──────────────────────────────────────────────────────┤
│  LAYER 3: TRAINING PLAN ENGINE                       │
│  Periodized plan generation, weekly workout          │
│  prescriptions, session structure                    │
├──────────────────────────────────────────────────────┤
│  LAYER 2: ATHLETE MODEL                              │
│  Profile, preferences, memory, conversation          │
│  history, learned context                            │
├──────────────────────────────────────────────────────┤
│  LAYER 1: DATA INGESTION                             │
│  Strava activities, WHOOP recovery, manual input,    │
│  chat-based logging                                  │
└──────────────────────────────────────────────────────┘
```

## Layer 1: Data Ingestion

### Strava (Activity Data)
- **OAuth**: User connects via Settings → OAuth → callback stores tokens
- **Webhook**: Strava pushes `activity.create` events → `/api/webhooks/strava`
- **Processing**: Fetch full activity → match to scheduled workout → mark completed → run analysis
- **Unscheduled**: Activities not matching a scheduled workout create a new completed entry

### WHOOP (Recovery Data)
- Same OAuth pattern → periodic poll for recovery/strain/sleep
- Stored in `recovery_data` table
- Feeds into adaptation decisions

### Manual (Chat-Based)
- User says "I did a 5 mile run today" → coach extracts workout data
- User says "my knee is sore" → coach extracts limitation/injury data

## Layer 2: Athlete Model

### Profile Data (Supabase `profiles`)
- Basic info, experience, sport, goals, race date
- `preferences` — JSON: coaching style, response length, focus areas, workout likes/dislikes
- `learned_preferences` — JSON: auto-extracted from chat (schedule constraints, recovery notes, limitations, life context)
- `conversation_summary` — compressed long-term memory of all past conversations
- `onboarding_data` — raw onboarding responses

### Memory System
1. **Short-term**: Last 20 chat messages (kept in DB, passed to each AI call)
2. **Long-term**: After 30+ messages, oldest batch compressed via GPT into `conversation_summary`
3. **Preference extraction**: After every chat exchange, GPT extracts durable preferences → merged with dedup + contradiction detection
4. **Context builder**: Assembles full athlete context for every AI call (profile + plan + workouts + recovery + memory)

## Layer 3: Training Plan Engine

### Philosophy
- Plans are **rolling** — generated 2 weeks ahead, extended weekly
- NOT a rigid 16-week block. The plan adapts continuously.
- Periodization provides the SKELETON; AI personalizes the FLESH.

### Periodization Model
```
Race Date → count weeks back → divide into phases:
  Base (40% of weeks): Aerobic foundation, technique, volume building
  Build (30%): Intensity increases, race-specific work, peak volume
  Peak (20%): Sharpening, race simulation, highest intensity
  Taper (10%, min 2 weeks): Volume reduction, maintaining intensity
```

### Weekly Structure
Based on athlete's available days and hours:
```
Example: 5 days/week, 10 hours, triathlon
  Mon: Swim (technique) - 45min
  Tue: Run (intervals) - 60min
  Wed: Bike (endurance) - 90min
  Thu: Run (easy) - 45min
  Sat: Long ride + brick run - 3hr
  Sun: Long run - 90min
  Fri: Rest
```

### Workout Prescription
Each workout gets:
- `workout_type`: swim/bike/run/strength/brick
- `title`: Human-readable name ("Tempo Run with Progression")
- `description`: Full structure (warmup → main set → cooldown with paces/zones)
- `duration_minutes`: Target duration
- `distance_meters`: Target distance (if applicable)
- `target_zones`: HR/pace/power zone prescriptions
- `intensity`: easy/moderate/hard/max
- `coach_notes`: Why this workout matters in the plan

### Generation Triggers
1. **Onboarding complete** → generate initial 2-week plan
2. **Weekly cron** (Monday) → extend plan by 1 week
3. **Manual** → user asks coach to regenerate/adjust
4. **Adaptation** → significant change triggers partial regeneration

## Layer 4: Adaptation Engine

### Triggers
1. **Post-workout** (Strava webhook): Compare prescribed vs actual
2. **Recovery data** (WHOOP): Check recovery score against thresholds
3. **Missed workout**: Detected when scheduled date passes without completion
4. **User request**: "I need to take 3 days off" → restructure

### Adaptation Rules (Programmatic)
```
IF recovery_score < 33% (RED):
  → Swap next hard session for easy/rest
  → Flag to user in chat
  → Reduce next 2 days' volume by 30%

IF recovery_score 33-66% (YELLOW):
  → Depends on coaching style:
    - "push": Proceed as planned
    - "balanced": Minor volume reduction (-10%)
    - "supportive": Suggest easier alternative

IF workout_completion_rate < 60% over 7 days:
  → Reduce weekly volume by 20%
  → Message user to check in

IF workout overperformed (actual >> prescribed):
  → Acknowledge, but don't auto-escalate (prevent overtraining)
  → Note in context for future prescription

IF workout missed:
  → Don't add to next day (no "makeup" sessions)
  → If key session (long run, brick), try to reschedule within 2 days
  → Otherwise, skip and adjust weekly volume expectation
```

### Adaptation Output
- Modify upcoming `workouts` rows in DB
- Send chat message explaining the change
- Update plan metadata (weekly volume targets)

## Layer 5: Dynamic Coaching Philosophy

### Per-User Personality
The coaching style adapts to user preferences stored in `profile.preferences.feedback_style`:

```
"supportive":
  - Warm, encouraging tone
  - Celebrate every workout
  - Gentle suggestions for improvement
  - Back off when recovery is yellow
  - "You're doing great, and here's how we can tweak things..."

"balanced":
  - Firm but fair
  - Acknowledge good work, direct about problems
  - Push through yellow recovery
  - Back off on red
  - "Good session. Here's what I'd adjust for next time..."

"push":
  - Direct, no-nonsense
  - High expectations
  - Only back off on red recovery
  - Challenge athlete to do more
  - "Solid, but I know you have more. Tomorrow we push harder."
```

### Style Evolution
- Initial style set during onboarding
- Can be changed in Settings or Chat settings modal
- Coach also picks up on cues: "don't go easy on me" → preference extraction updates `feedback_style`
- The system prompt is built DYNAMICALLY per user, not static

### Prompt Construction
```
SYSTEM_PROMPT = BASE_COACH_PROMPT
  + COACHING_STYLE_SECTION (from user preferences)
  + ATHLETE_CONTEXT (from context builder)
  + LONG_TERM_MEMORY (from conversation_summary)
  + LEARNED_PREFERENCES (from learned_preferences)
```

## API Endpoints

### Existing
- `POST /api/chat` — Main coach chat
- `GET/POST /api/webhooks/strava` — Strava webhook
- `GET /api/integrations/strava/connect` — OAuth flow
- `GET /api/integrations/strava/callback` — OAuth callback
- `GET /api/cron/daily-checkin` — Morning check-in
- `GET /api/cron/recovery-check` — Recovery alert check
- `GET /api/cron/weekly-outlook` — Monday outlook

### New (To Build)
- `POST /api/plans/generate` — Generate/regenerate training plan
- `POST /api/plans/adapt` — Trigger adaptation (called by webhook + cron)
- `POST /api/plans/extend` — Extend plan by 1 week (called by weekly cron)

## Database Tables

### Existing
- `profiles` — athlete data + preferences + memory
- `training_plans` — plan metadata (phase, week, dates)
- `workouts` — individual sessions (scheduled + completed)
- `recovery_data` — daily recovery snapshots
- `chat_messages` — conversation history
- `integrations` — OAuth tokens
- `webhook_events` — raw webhook payloads

### Schema Notes
- `workouts.target_zones` (JSONB) — stores zone prescriptions
- `workouts.analysis` (JSONB) — stores post-workout AI analysis
- `workouts.actual_data` (JSONB) — stores Strava/actual metrics
- `profiles.conversation_summary` (TEXT) — compressed long-term memory
- `profiles.learned_preferences` (JSONB) — extracted durable preferences

## How It All Flows

### New User Journey
1. Signup → Onboarding (sport, race, experience, goals, availability, personality)
2. Onboarding complete → `POST /api/plans/generate`
3. Plan engine creates `training_plans` row + 14 days of `workouts`
4. User opens Dashboard → sees today's workout + race countdown
5. User chats with coach → personalized by their profile + empty history
6. Preferences extracted from early conversations → model improves

### Daily Loop
1. Morning cron → check-in message with today's preview
2. User does workout → Strava webhook fires
3. Activity processed → workout marked complete → analysis generated
4. Analysis posted as chat message → user sees feedback
5. Adaptation engine checks: should future workouts change?
6. If recovery data available → additional adaptation check

### Weekly Loop
1. Monday cron → weekly outlook message
2. Plan engine → extend plan by 1 week (generate next week's workouts)
3. Coach reviews last week's completion rate → adjusts volume if needed
