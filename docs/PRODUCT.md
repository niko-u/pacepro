# IronCoach AI - Product Requirements Document

## Vision
A premium AI triathlon coach that delivers personalized, adaptive training plans through natural conversation. Users pay $50/month for a coach that actually understands their context, adjusts to their life, and evolves with their fitness.

**Core differentiator:** Not just a training plan generator—a conversational coach that reads your data, understands your constraints, and adapts in real-time.

---

## Target User
- Triathletes training for Ironman, 70.3, Olympic, or Sprint distances
- Age group athletes (25-55) with $50/month discretionary income
- Time-constrained professionals who need efficient, smart training
- Athletes who want coaching intelligence without the $300+/month human coach cost

---

## Pricing
- **$50/month** subscription
- 7-day free trial
- Annual option: $480/year (2 months free)

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
- Race name, date, distance (full/70.3/olympic/sprint)
- Course profile (flat, hilly, mountainous) if known
- Priority level (A-race, B-race, tune-up)
- Multiple races supported

**Athlete Goals**
- Primary goal: Finish, PR, specific time, podium, qualify for Worlds
- Secondary goals: Build base, improve weakness, stay healthy

**Schedule & Constraints**
- Work hours and patterns
- Family commitments
- Preferred training days/times
- Travel or blackout dates
- Available equipment (pool access, bike trainer, gym)

**Training Preferences**
- Preferred workout types (intervals, long steady, bricks, strength)
- Favorite sessions vs. dreaded sessions
- Indoor vs. outdoor preferences
- Group workout availability

**Training Personality**
- Push tolerance: Conservative ↔ Aggressive
- Recovery needs: High ↔ Low
- Schedule style: Strict plan ↔ Flexible/adaptive
- Feedback preference: Data-heavy ↔ Simple guidance

**Current Fitness**
- Recent race results
- Current weekly volume
- Injury history
- Known benchmarks (FTP, threshold pace, CSS)

### 2. Plan Generation
After onboarding, generate a complete training plan:

**Macro Structure**
- Periodization phases: Base → Build → Peak → Taper
- Weekly volume progression
- Key workout placement
- Recovery week scheduling

**Micro Structure (Weekly)**
- Day-by-day workout schedule
- Specific sessions with targets (pace, power, HR zones)
- Flexibility options (swap days, alternate workouts)

**Plan Presentation**
- Show rough plan first for feedback
- Refine based on user input
- Lock in detailed schedule
- Always explain the "why" behind the structure

### 3. Daily Coaching Experience

**Today's Workout**
- Clear workout prescription
- Warm-up and cool-down guidance
- Target metrics (pace, power, HR, RPE)
- Execution tips and focus points
- "Why this matters" context

**Conversational Interface**
- Ask questions: "Can I do this harder?" "What if I only have 45 min?"
- Get modifications on the fly
- Report how it went
- Discuss upcoming schedule

**Post-Workout Analysis**
- Automatic sync from Strava
- Compare prescribed vs. actual
- Insight generation: "You negative split perfectly" or "HR drifted—might be fatigue"
- Adjustments to future workouts if needed

### 4. Adaptive Planning
The plan is alive—it evolves based on:

**Data Inputs**
- Strava activities (actual vs. planned)
- Wearable recovery metrics (WHOOP, Garmin, Apple Health)
- User-reported fatigue, stress, sleep
- Missed workouts or life disruptions

**Adaptation Logic**
- Missed workout → Reschedule or absorb?
- Low recovery score → Reduce intensity or rest day?
- Crushed a workout → Ready for more stimulus?
- Travel week → Condensed plan with key sessions only

**Plan Versioning**
- Track every change
- Show "what changed and why"
- Build trust through transparency

### 5. Integrations

**Strava** (Critical)
- OAuth connection
- Sync all activities
- Read workout details (laps, power, HR, pace)
- Track weekly volume

**WHOOP** (High Value)
- Recovery score
- HRV, RHR, sleep metrics
- Strain tracking
- Inform intensity decisions

**Garmin Connect** (High Value)
- Training status, load, recovery
- Body battery
- Sleep tracking
- Activity sync (alternative to Strava)

**Apple Health** (iOS)
- Heart rate, HRV
- Sleep
- Workout data
- Steps, activity

**TrainingPeaks** (Future)
- Export workouts
- Sync planned vs. completed

### 6. Weekly Coach Check-in
Automated summary every Sunday/Monday:

- This week's training load vs. target
- Key wins and concerns
- Recovery trend
- Next week's focus
- Any plan adjustments made

### 7. Special Flows

**"Explain This Workout"**
- Deep dive on any session
- Why it's programmed here
- How to execute optimally
- Common mistakes to avoid

**"What If I Missed Yesterday?"**
- Assess impact
- Options: Skip, reschedule, combine, modify
- Updated plan with rationale

**"I'm Feeling [X]"**
- Report fatigue, soreness, motivation
- Get immediate guidance
- Plan adjustment if needed

**"Race Week Mode"**
- Taper guidance
- Day-by-day instructions
- Nutrition and logistics reminders
- Mental prep

### 8. Injury Prevention Layer
Lightweight safety system:

- Flag high-risk patterns (volume spikes, no rest days)
- Suggest modifications before problems occur
- Track recurring issues
- Prompt for discomfort reports

---

## Technical Architecture

### Frontend
- **Web:** Next.js 14 (App Router) + TypeScript
- **iOS:** React Native (shared logic) or SwiftUI (native performance)
- **UI:** Tailwind CSS + shadcn/ui components
- **State:** React Query + Zustand
- **Design:** v0.dev for component generation

### Backend
- **API:** Next.js API routes (serverless) or separate Node.js service
- **Database:** Supabase (Postgres + Auth + Realtime)
- **AI:** OpenAI GPT-4 or Claude API
- **Queue:** Inngest or Trigger.dev for background jobs

### Infrastructure
- **Hosting:** Vercel (web + API)
- **Database:** Supabase
- **Auth:** Supabase Auth (email, Google, Apple)
- **Payments:** Stripe (subscriptions)
- **Monitoring:** Vercel Analytics + Sentry

### Integrations
- Strava API (OAuth)
- WHOOP API (OAuth)
- Garmin Connect API (OAuth)
- Apple HealthKit (iOS native)

---

## Database Schema (High-Level)

```
users
  - id, email, name, created_at
  - subscription_status, stripe_customer_id
  - onboarding_complete

athlete_profiles
  - user_id, goals, constraints, preferences
  - training_personality, injury_history
  - current_benchmarks (FTP, threshold_pace, CSS)

races
  - user_id, name, date, distance, priority
  - course_profile, goal_time

training_plans
  - user_id, race_id, version
  - macro_structure (JSON)
  - created_at, active

weekly_plans
  - plan_id, week_number, focus
  - target_volume, key_sessions

workouts
  - weekly_plan_id, day, type
  - prescription (JSON)
  - status (planned/completed/skipped)
  - actual_data (from Strava)

conversations
  - user_id, messages (JSON)
  - context_snapshot

integrations
  - user_id, provider, access_token, refresh_token
  - last_sync, status

activities (synced from Strava/Garmin)
  - user_id, external_id, provider
  - date, type, duration, distance
  - metrics (power, HR, pace, etc.)
  - analysis (JSON)

recovery_metrics (from WHOOP/Garmin)
  - user_id, date
  - recovery_score, hrv, rhr, sleep_hours
  - source
```

---

## UI/UX Principles

### Design Philosophy
- **Clean, not cluttered** — Focus on what matters today
- **Conversational, not transactional** — Feel like talking to a coach
- **Data-informed, not data-overwhelming** — Insights > numbers
- **Mobile-first** — Most athletes check on their phone
- **Dark mode default** — Easier on eyes, modern feel

### Key Screens

**1. Dashboard (Home)**
- Today's workout (hero)
- Quick stats: This week's progress, next race countdown
- Coach message/insight of the day
- Quick actions: Chat, Log workout, View plan

**2. Chat Interface**
- Clean conversation UI
- Suggested prompts
- Workout cards inline
- Voice input option

**3. Training Plan View**
- Calendar view (week/month)
- Workout cards with drag-to-reschedule
- Phase indicators
- Volume chart overlay

**4. Workout Detail**
- Clear prescription
- Execution guidance
- Post-workout: Actual vs. planned comparison

**5. Progress/Analytics**
- Weekly summaries
- Trend charts (volume, intensity, recovery)
- Race countdown with readiness indicator

**6. Settings/Integrations**
- Connected services
- Subscription management
- Profile/preferences

---

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup: Next.js + Supabase + Vercel
- [ ] Database schema
- [ ] Auth flow (email + Google)
- [ ] Basic UI shell with navigation
- [ ] Stripe subscription integration

### Phase 2: Onboarding (Weeks 3-4)
- [ ] Multi-step onboarding flow
- [ ] Profile storage
- [ ] Race setup
- [ ] Preference capture

### Phase 3: Plan Generation (Weeks 5-6)
- [ ] AI prompt engineering for plan generation
- [ ] Macro structure generation
- [ ] Weekly plan breakdown
- [ ] Plan display UI

### Phase 4: Daily Coaching (Weeks 7-8)
- [ ] Chat interface
- [ ] Today's workout display
- [ ] Conversational AI integration
- [ ] Context management

### Phase 5: Integrations (Weeks 9-10)
- [ ] Strava OAuth + sync
- [ ] Activity import and analysis
- [ ] WHOOP integration
- [ ] Recovery data ingestion

### Phase 6: Adaptive Planning (Weeks 11-12)
- [ ] Plan adjustment logic
- [ ] Version tracking
- [ ] Weekly check-in generation
- [ ] Missed workout handling

### Phase 7: Polish & Launch (Weeks 13-14)
- [ ] UI polish pass
- [ ] Performance optimization
- [ ] Error handling
- [ ] Beta testing
- [ ] Launch prep

---

## Success Metrics

### North Star
- Monthly Active Subscribers

### Leading Indicators
- Onboarding completion rate
- Integration connection rate
- Weekly chat engagement
- Workout completion rate
- Plan adjustment acceptance rate

### Health Metrics
- Churn rate (target: <5%/month)
- NPS score (target: >50)
- Support ticket volume

---

## Open Questions

1. **Pricing validation:** Is $50/month the right price point? Should we test $39 or $69?
2. **AI model:** OpenAI GPT-4 vs. Claude? Cost vs. quality tradeoff
3. **iOS timeline:** Build native Swift or React Native? When to prioritize?
4. **Coach personality:** Should users be able to customize coach tone/style?
5. **Community features:** Should athletes be able to share/compare? Or keep it 1:1?

---

## Competitive Landscape

| Product | Price | Strength | Weakness |
|---------|-------|----------|----------|
| TrainingPeaks | $20-120/mo | Industry standard, coach marketplace | Complex, not AI-native |
| TrainerRoad | $25/mo | Adaptive training, great for cycling | Weak on swim/run, not conversational |
| Humango | $15-30/mo | AI-generated plans | Generic, not truly adaptive |
| EnduranceAI | $20/mo | Budget AI option | Limited integrations |
| Human Coach | $150-400/mo | True personalization | Expensive, slow response |

**Our positioning:** Premium AI coaching that combines human-coach-level personalization with instant availability and data-driven adaptation.

---

## Next Steps

1. Validate this PRD — any gaps or changes?
2. Finalize tech stack decisions
3. Set up GitHub repo and CI/CD
4. Begin Phase 1 implementation
