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
- Strava API (OAuth)
- WHOOP API (OAuth)
- Garmin Connect API (OAuth)
- Apple HealthKit (iOS)

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
