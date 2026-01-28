# PacePro - Product Requirements Document

## Vision
An AI endurance coach that feels like having a real coach in your pocket. Not just training plans — a coach that **talks to you**, analyzes your workouts, reads your recovery data, and adapts your training in real-time.

**Core differentiator:** The conversational experience. Your coach checks in after workouts, notices when your HRV is down, adjusts tomorrow's session before you wake up, and actually *knows* you.

---

## Sports Supported
- **Running:** 5K, 10K, Half Marathon, Marathon, Ultramarathon
- **Triathlon:** Sprint, Olympic, Ironman 70.3, Ironman

---

## Target User
- Runners and triathletes training for a specific goal race
- Age group athletes (25-55) willing to invest in quality coaching
- Time-constrained professionals who need smart, efficient training
- Athletes who want coaching intelligence without the $300+/month human coach cost

---

## Pricing
- **$50/month** subscription
- 7-day free trial
- Annual option: $500/year (2 months free)

---

## The Coach Experience (Core Value Prop)

This is what makes PacePro different. The AI coach is **proactive**, not reactive:

### Daily Check-ins
- "Good morning! You've got intervals today. Your WHOOP shows 85% recovery — you're ready to push it."
- "I noticed your HR was elevated on yesterday's easy run. How are you feeling? We can adjust today if needed."

### Post-Workout Analysis
- Automatic sync from Strava
- "Nice tempo run! You held 7:15 pace for the main set — that's 10 seconds faster than last month."
- "Your HR drifted in the last 2 miles. Could be heat, could be fatigue. Let's keep tomorrow easy."
- Compares prescribed vs. actual performance
- Flags anomalies and patterns

### Recovery Intelligence
- Reads WHOOP/Garmin/Apple Health data
- "Your HRV has been trending down this week. I'm swapping tomorrow's long run for an easy spin."
- Adjusts training load based on sleep, stress, recovery scores
- Warns before overtraining happens

### Conversational Modifications
- "Can I do today's workout harder?" → Coach explains tradeoffs and adjusts
- "I only have 30 minutes" → Coach gives a condensed version
- "I'm feeling tired" → Coach reassesses and modifies
- "What should I eat before my long run?" → Personalized nutrition guidance

### Weekly Summaries
- Every Sunday/Monday: "Here's your week in review"
- Training load analysis
- Wins and areas to watch
- Preview of next week's focus
- Proactive plan adjustments explained

---

## Platform
- **Web App** (primary) — Next.js on Vercel
- **iOS App** (v2) — React Native or Swift
- Shared account and data across both

---

## Core Features

### 1. Onboarding Flow
Capture everything needed to build a personalized plan:

**Race Information**
- Race type (running or triathlon)
- Specific event search or manual entry
- Race date and location
- Course profile (flat, hilly, mountainous) if known
- Priority level (A-race, B-race, tune-up)

**Athlete Goals**
- Primary goal: Finish, PR, specific time, podium, qualify
- Secondary goals: Build base, improve weakness, stay healthy

**Schedule & Constraints**
- Weekly hours available
- Preferred training days
- Work patterns and family commitments
- Travel or blackout dates
- Equipment access (pool, trainer, gym)

**Training Preferences**
- Workout types: intervals, tempo, long steady, hills, strength
- Favorite sessions vs. dreaded sessions
- Indoor vs. outdoor preferences
- Group workout availability

**Training Personality**
- Push tolerance: Conservative ↔ Aggressive
- Recovery needs: High ↔ Low
- Schedule style: Strict ↔ Flexible
- Feedback style: Simple ↔ Data-heavy

**Current Fitness**
- Recent race results
- Current weekly volume
- Injury history
- Known benchmarks (threshold pace, FTP, etc.)

### 2. Plan Generation
AI generates a complete periodized plan:

**Macro Structure**
- Phases: Base → Build → Peak → Taper
- Weekly volume progression
- Key workout placement
- Recovery week scheduling

**Micro Structure**
- Day-by-day workout schedule
- Specific sessions with targets
- Flexibility options

### 3. The Calendar
- Week and month views
- Workout cards with full details
- Drag to reschedule
- Phase indicators
- Volume visualization

### 4. Adaptive Planning
The plan evolves based on:
- Completed workouts (Strava sync)
- Recovery metrics (WHOOP, Garmin, Apple Health)
- User-reported fatigue and feedback
- Missed workouts and life disruptions

Every change is explained: "I moved your long run to Sunday because your recovery score was low Friday."

### 5. Integrations

**Strava** (Critical)
- OAuth connection
- Auto-sync all activities
- Workout analysis and comparison

**WHOOP** (High Value)
- Recovery score, HRV, sleep
- Strain tracking
- Informs daily adjustments

**Garmin Connect** (High Value)
- Training status and load
- Body battery, sleep
- Activity sync

**Apple Health** (iOS)
- Heart rate, HRV, sleep
- Workout data

---

## UI/UX Principles

### Design Philosophy
- **Coach-first** — Chat is prominent, not buried
- **Proactive** — Coach reaches out, doesn't wait to be asked
- **Clean** — Focus on what matters today
- **Data-informed** — Insights over raw numbers
- **Dark mode** — Modern, easy on eyes

### Key Screens

**1. Dashboard**
- Today's workout (hero)
- Recent coach message
- Quick stats and race countdown
- One-tap access to chat

**2. Chat Interface**
- Full conversation history
- Suggested prompts
- Inline workout cards
- Voice input option

**3. Calendar**
- Week/month views
- Workout cards with details
- Phase and volume indicators

**4. Workout Detail**
- Clear prescription
- Execution guidance
- Post-workout: actual vs. planned

**5. Analytics**
- Weekly summaries
- Trend charts
- Race readiness indicator

---

## Technical Architecture

### Frontend
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Framer Motion for animations

### Backend
- Next.js API routes
- Supabase (Postgres + Auth)
- OpenAI GPT-4 for coaching

### Infrastructure
- Vercel (hosting)
- Supabase (database, auth)
- Stripe (payments)

### Integrations
- Strava API (OAuth + Webhooks)
- WHOOP API (OAuth)
- Garmin Connect API (OAuth)
- Apple HealthKit (iOS)

---

## System Design: Core Intelligence

### 1. Coach Memory System

The AI coach needs context to feel personal. Memory is structured in layers:

**Athlete Profile (Static)**
```
profiles table:
- user_id, name, email
- race_type, goal_race, goal_date
- experience_level, weekly_hours
- preferences (JSON): workout_likes, workout_dislikes, feedback_style
- personality (JSON): push_tolerance, recovery_needs, flexibility
- current_fitness (JSON): weekly_volume, recent_races, injuries
- created_at, updated_at
```

**Training Context (Semi-static)**
```
training_plans table:
- plan_id, user_id
- phase (base/build/peak/taper)
- week_number, total_weeks
- weekly_volume_target
- focus_areas (JSON)
- created_at, updated_at
```

**Conversation History (Dynamic)**
```
chat_messages table:
- message_id, user_id
- role (user/assistant)
- content (text)
- context (JSON): workout_id, recovery_data, etc.
- created_at
```
- Keep last 20 messages in context window
- Summarize older conversations into `conversation_summary` field on profile

**Workout History (Event-sourced)**
```
workouts table:
- workout_id, user_id
- scheduled_date, completed_at
- type (run/bike/swim/strength/rest)
- prescribed (JSON): duration, distance, zones, intervals
- actual (JSON): duration, distance, avg_hr, avg_pace, strava_id
- analysis (JSON): coach notes, comparisons, flags
- status (scheduled/completed/skipped/modified)
```

**Recovery Snapshots (Time-series)**
```
recovery_data table:
- user_id, date
- source (whoop/garmin/apple)
- recovery_score, hrv, resting_hr
- sleep_hours, sleep_quality
- strain, stress_level
```

**Memory Retrieval for Coach Context:**
```typescript
async function buildCoachContext(userId: string) {
  const profile = await getProfile(userId);
  const currentPlan = await getCurrentPlan(userId);
  const recentWorkouts = await getWorkouts(userId, { days: 14 });
  const recentRecovery = await getRecoveryData(userId, { days: 7 });
  const recentMessages = await getMessages(userId, { limit: 20 });
  const todayWorkout = await getTodayWorkout(userId);
  
  return {
    athlete: profile,
    plan: currentPlan,
    workouts: recentWorkouts,
    recovery: recentRecovery,
    conversation: recentMessages,
    today: todayWorkout,
  };
}
```

### 2. Strava Webhook → Instant Analysis

When a workout is uploaded to Strava, we analyze it immediately:

**Webhook Flow:**
```
1. User completes workout → uploads to Strava
2. Strava sends webhook to /api/webhooks/strava
3. We fetch full activity details from Strava API
4. Match to scheduled workout (by date + type)
5. Run analysis pipeline
6. Store results + send coach message
```

**Webhook Endpoint:**
```typescript
// POST /api/webhooks/strava
export async function POST(req: Request) {
  const event = await req.json();
  
  if (event.aspect_type === 'create' && event.object_type === 'activity') {
    // Queue for processing (don't block webhook response)
    await queueWorkoutAnalysis({
      stravaActivityId: event.object_id,
      userId: event.owner_id, // Strava athlete ID
    });
  }
  
  return Response.json({ ok: true });
}
```

**Analysis Pipeline:**
```typescript
async function analyzeWorkout(stravaActivityId: string, userId: string) {
  // 1. Fetch full activity from Strava
  const activity = await strava.getActivity(stravaActivityId);
  
  // 2. Find matching scheduled workout
  const scheduled = await findScheduledWorkout(userId, activity.start_date, activity.type);
  
  // 3. Build comparison
  const comparison = {
    prescribed: scheduled?.prescribed || null,
    actual: {
      duration: activity.moving_time,
      distance: activity.distance,
      avg_hr: activity.average_heartrate,
      avg_pace: activity.average_speed,
      elevation: activity.total_elevation_gain,
      // ... more fields
    },
  };
  
  // 4. Get AI analysis
  const context = await buildCoachContext(userId);
  const analysis = await openai.chat({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: COACH_ANALYSIS_PROMPT },
      { role: 'user', content: JSON.stringify({ comparison, context }) },
    ],
  });
  
  // 5. Store analysis
  await updateWorkout(scheduled.id, {
    actual: comparison.actual,
    analysis: analysis.content,
    status: 'completed',
    strava_id: stravaActivityId,
  });
  
  // 6. Send proactive message
  await sendCoachMessage(userId, analysis.content);
}
```

**Analysis Prompt (excerpt):**
```
You are an expert endurance coach analyzing a just-completed workout.

Compare the prescribed workout to what was actually done. Consider:
- Did they hit the targets? (duration, pace, HR zones)
- How does this compare to similar workouts in the past?
- Are there any concerning patterns? (HR drift, pace fade, unusual metrics)
- What's the training effect and how does it fit the current phase?

Be encouraging but honest. Highlight wins first, then areas to watch.
Keep it conversational — this goes directly to the athlete.
```

### 3. Proactive Messaging (Weekly Outlook)

Monday morning weekly outlook, plus other scheduled check-ins:

**Scheduled Jobs (Vercel Cron):**
```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/weekly-outlook",
      "schedule": "0 7 * * 1" // 7am every Monday
    },
    {
      "path": "/api/cron/daily-checkin", 
      "schedule": "0 6 * * *" // 6am daily
    },
    {
      "path": "/api/cron/recovery-check",
      "schedule": "0 */4 * * *" // Every 4 hours
    }
  ]
}
```

**Weekly Outlook Job:**
```typescript
// POST /api/cron/weekly-outlook
export async function POST(req: Request) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get all active users
  const users = await getActiveUsers();
  
  for (const user of users) {
    await generateWeeklyOutlook(user.id);
  }
  
  return Response.json({ processed: users.length });
}

async function generateWeeklyOutlook(userId: string) {
  const context = await buildCoachContext(userId);
  const lastWeekWorkouts = await getWorkouts(userId, { days: 7 });
  const thisWeekPlan = await getWeekPlan(userId, { week: 'current' });
  
  const outlook = await openai.chat({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: WEEKLY_OUTLOOK_PROMPT },
      { role: 'user', content: JSON.stringify({ 
        context, 
        lastWeek: lastWeekWorkouts,
        thisWeek: thisWeekPlan,
      })},
    ],
  });
  
  // Store as coach message
  await createMessage(userId, {
    role: 'assistant',
    content: outlook.content,
    type: 'weekly_outlook',
  });
  
  // Send push notification if enabled
  if (context.athlete.notifications?.weekly_outlook) {
    await sendPushNotification(userId, {
      title: "Your Week Ahead 📅",
      body: "Your coach has your weekly training outlook ready.",
    });
  }
}
```

**Weekly Outlook Prompt (excerpt):**
```
You are the athlete's personal endurance coach. It's Monday morning.

Write a brief, motivating weekly outlook that covers:
1. Quick reflection on last week (wins, completion rate, notable performances)
2. This week's focus and key workouts
3. Any adjustments you're making based on recovery/performance
4. One specific thing to focus on this week

Keep it under 200 words. Be encouraging but real.
Start with a greeting that matches the time of day and their name.
```

### 4. Preference Persistence from Chat

Users reveal preferences through natural conversation. We capture and store them:

**Preference Extraction:**
```typescript
// After each user message, run preference extraction
async function extractAndStorePreferences(userId: string, message: string, response: string) {
  const extraction = await openai.chat({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: PREFERENCE_EXTRACTION_PROMPT },
      { role: 'user', content: JSON.stringify({ userMessage: message, coachResponse: response }) },
    ],
    response_format: { type: 'json_object' },
  });
  
  const prefs = JSON.parse(extraction.content);
  
  if (Object.keys(prefs).length > 0) {
    await updateProfilePreferences(userId, prefs);
  }
}
```

**Preference Extraction Prompt:**
```
Analyze this conversation exchange for any user preferences that should be remembered.

Look for:
- Schedule preferences ("I can't train on Wednesdays")
- Workout preferences ("I love hill repeats", "I hate the trainer")
- Recovery patterns ("I always feel tired on Mondays")
- Goals and motivations ("I want to BQ", "just want to finish")
- Physical limitations ("my knee acts up in cold weather")
- Life context ("I travel for work every other week")

Return a JSON object with any extracted preferences. Use these keys:
- schedule_constraints: array of scheduling rules
- workout_likes: array of preferred workout types
- workout_dislikes: array of avoided workout types  
- recovery_notes: array of recovery patterns
- goals: array of goal statements
- limitations: array of physical limitations
- life_context: array of lifestyle factors

Only include keys where you found clear preferences. Return {} if nothing extractable.
```

**Example Flow:**
```
User: "Can we skip the pool workout this week? I'm traveling and won't have access"

→ Preference extracted: { 
  "life_context": ["travels for work, may not have pool access"],
  "schedule_constraints": ["week of Jan 28: no pool access"]
}

→ Profile updated, coach remembers for future planning
```

**Preference Types & Storage:**
```typescript
interface AthletePreferences {
  // Explicit (from onboarding)
  workout_likes: string[];
  workout_dislikes: string[];
  push_tolerance: number; // 1-5
  recovery_needs: number; // 1-5
  feedback_style: 'simple' | 'detailed' | 'data-heavy';
  
  // Extracted (from chat)
  schedule_constraints: ScheduleConstraint[];
  recovery_notes: string[];
  limitations: string[];
  life_context: string[];
  
  // Computed (from behavior)
  preferred_workout_times: string[]; // learned from Strava
  avg_response_time: number; // how quickly they respond to coach
  engagement_level: 'high' | 'medium' | 'low';
}
```

---

## Competitive Positioning

| Product | Price | Our Advantage |
|---------|-------|---------------|
| TrainingPeaks | $20-120/mo | We're conversational, they're transactional |
| TrainerRoad | $25/mo | We do running + tri, they're cycling-focused |
| Humango | $15-30/mo | We read your recovery data and adapt |
| Human Coach | $150-400/mo | We're instant, affordable, always available |

**Our position:** The AI coach that actually feels like a coach — proactive, conversational, and deeply personalized.

---

## Success Metrics

### North Star
- Monthly Active Subscribers

### Leading Indicators
- Chat messages per user per week
- Post-workout analysis engagement
- Integration connection rate
- Workout completion rate

### Health Metrics
- Churn rate (target: <5%/month)
- NPS score (target: >50)
