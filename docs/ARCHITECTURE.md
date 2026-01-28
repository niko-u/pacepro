# IronCoach AI - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Web App   │    │  iOS App    │    │ Future:     │             │
│  │  (Next.js)  │    │(React Native│    │ Android,    │             │
│  │             │    │ or Swift)   │    │ Watch, etc  │             │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘             │
│         │                  │                                        │
│         └────────┬─────────┘                                        │
│                  ▼                                                   │
│         ┌───────────────┐                                           │
│         │   Vercel CDN  │                                           │
│         └───────┬───────┘                                           │
└─────────────────┼───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Next.js API Routes                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │   Auth   │ │ Coaching │ │   Plan   │ │  Sync    │       │   │
│  │  │  Routes  │ │   Chat   │ │  Routes  │ │  Routes  │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐ │
│  │              Background Jobs (Inngest/Trigger.dev)            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │ Strava Sync  │  │ Plan Update  │  │Weekly Summary│        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICES                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Supabase   │  │   OpenAI /   │  │    Stripe    │              │
│  │  (Database   │  │    Claude    │  │  (Payments)  │              │
│  │   + Auth)    │  │     API      │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Strava    │  │    WHOOP     │  │   Garmin     │              │
│  │     API      │  │     API      │  │     API      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14 (App Router) | SSR, API routes, Vercel-native, great DX |
| Language | TypeScript | Type safety, better tooling |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Components | shadcn/ui | High quality, customizable, accessible |
| State | Zustand + React Query | Simple state + server cache |
| Forms | React Hook Form + Zod | Validation, good UX |
| Charts | Recharts or Chart.js | Training data visualization |

### Backend
| Layer | Technology | Rationale |
|-------|------------|-----------|
| API | Next.js API Routes | Colocation, serverless, simple |
| Database | Supabase (Postgres) | Managed, realtime, good free tier |
| Auth | Supabase Auth | Built-in, supports OAuth providers |
| Background Jobs | Inngest | Serverless-friendly, retries, scheduling |
| AI | OpenAI GPT-4-turbo | Best reasoning, good at coaching tone |
| Payments | Stripe | Industry standard, subscriptions |

### Infrastructure
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Hosting | Vercel | Auto-deploy, edge, analytics |
| CDN | Vercel Edge | Global, fast |
| Monitoring | Vercel + Sentry | Errors, performance |
| CI/CD | GitHub Actions + Vercel | Auto-deploy on push |

---

## Database Schema

```sql
-- Users and Auth (managed by Supabase Auth)
-- users table is auto-created by Supabase

-- Extended user profile
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription management
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL, -- 'trialing', 'active', 'canceled', 'past_due'
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Athlete profile (training context)
CREATE TABLE athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- Goals & preferences
  primary_goal TEXT, -- 'finish', 'pr', 'time_goal', 'podium', 'qualify'
  goal_details JSONB,
  
  -- Schedule constraints
  weekly_hours_available INTEGER,
  preferred_training_days TEXT[], -- ['monday', 'tuesday', ...]
  blackout_dates JSONB, -- Array of date ranges
  work_schedule JSONB,
  
  -- Training preferences
  preferred_workout_types TEXT[],
  dreaded_workout_types TEXT[],
  indoor_outdoor_preference TEXT, -- 'indoor', 'outdoor', 'mixed'
  equipment_available TEXT[],
  
  -- Personality
  push_tolerance INTEGER, -- 1-10 scale
  recovery_needs INTEGER, -- 1-10 scale
  schedule_flexibility TEXT, -- 'strict', 'moderate', 'flexible'
  feedback_style TEXT, -- 'data_heavy', 'simple', 'balanced'
  
  -- Fitness baseline
  current_weekly_volume DECIMAL,
  injury_history JSONB,
  
  -- Benchmarks
  ftp_watts INTEGER,
  threshold_pace_per_mile INTEGER, -- seconds
  css_per_100 INTEGER, -- seconds
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Races
CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  distance TEXT NOT NULL, -- 'full', '70.3', 'olympic', 'sprint'
  priority TEXT NOT NULL, -- 'A', 'B', 'C'
  course_profile TEXT, -- 'flat', 'rolling', 'hilly', 'mountainous'
  goal_time_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training Plans
CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  race_id UUID REFERENCES races(id),
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- 'active', 'archived'
  
  -- Macro structure
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  phases JSONB NOT NULL, -- Array of phase objects
  
  -- Plan metadata
  total_weeks INTEGER,
  peak_week_hours DECIMAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly Plans
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  
  phase TEXT NOT NULL, -- 'base', 'build', 'peak', 'taper', 'recovery'
  focus TEXT, -- 'endurance', 'threshold', 'speed', 'race_prep'
  target_hours DECIMAL,
  target_tss INTEGER,
  
  coach_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  scheduled_date DATE NOT NULL,
  sport TEXT NOT NULL, -- 'swim', 'bike', 'run', 'strength', 'brick'
  workout_type TEXT NOT NULL, -- 'easy', 'tempo', 'intervals', 'long', 'race_pace'
  
  -- Prescription
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  distance DECIMAL,
  distance_unit TEXT,
  target_metrics JSONB, -- { power: {...}, pace: {...}, hr: {...} }
  structure JSONB, -- Detailed intervals/segments
  
  -- Execution guidance
  warmup TEXT,
  main_set TEXT,
  cooldown TEXT,
  focus_points TEXT[],
  why_this_matters TEXT,
  
  -- Status
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'skipped', 'modified'
  completed_at TIMESTAMPTZ,
  
  -- Actual data (populated after completion)
  actual_duration_minutes INTEGER,
  actual_distance DECIMAL,
  actual_metrics JSONB,
  strava_activity_id TEXT,
  
  -- Analysis
  analysis JSONB,
  coach_feedback TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations (chat history)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB, -- workout cards, plan updates, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration connections
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'strava', 'whoop', 'garmin'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  external_user_id TEXT,
  scope TEXT,
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Synced activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id), -- Link to planned workout if matched
  
  provider TEXT NOT NULL, -- 'strava', 'garmin', 'manual'
  external_id TEXT NOT NULL,
  
  date TIMESTAMPTZ NOT NULL,
  sport TEXT NOT NULL,
  name TEXT,
  
  duration_seconds INTEGER,
  distance_meters DECIMAL,
  elevation_gain_meters DECIMAL,
  
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_power INTEGER,
  normalized_power INTEGER,
  avg_pace_per_km INTEGER, -- seconds
  
  calories INTEGER,
  tss INTEGER,
  suffer_score INTEGER,
  
  laps JSONB,
  streams JSONB, -- Optional detailed data
  
  analysis JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

-- Recovery metrics
CREATE TABLE recovery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  provider TEXT NOT NULL, -- 'whoop', 'garmin', 'apple_health'
  
  recovery_score INTEGER, -- 0-100
  hrv DECIMAL,
  resting_hr INTEGER,
  
  sleep_hours DECIMAL,
  sleep_quality INTEGER, -- 0-100
  deep_sleep_hours DECIMAL,
  rem_sleep_hours DECIMAL,
  
  strain DECIMAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, provider)
);

-- Plan changes (versioning)
CREATE TABLE plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  change_type TEXT NOT NULL, -- 'auto_adjustment', 'user_request', 'missed_workout'
  description TEXT NOT NULL,
  reason TEXT,
  
  affected_workouts UUID[], -- IDs of changed workouts
  before_state JSONB,
  after_state JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workouts_user_date ON workouts(user_id, scheduled_date);
CREATE INDEX idx_activities_user_date ON activities(user_id, date);
CREATE INDEX idx_recovery_user_date ON recovery_metrics(user_id, date);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

---

## API Routes Structure

```
/api
├── /auth
│   ├── /callback          # OAuth callbacks
│   └── /session           # Session management
│
├── /user
│   ├── /profile           # GET, PUT profile
│   ├── /onboarding        # POST onboarding data
│   └── /subscription      # GET subscription status
│
├── /billing
│   ├── /create-checkout   # POST create Stripe checkout
│   ├── /portal            # GET customer portal URL
│   └── /webhook           # POST Stripe webhooks
│
├── /coach
│   ├── /chat              # POST send message, stream response
│   ├── /today             # GET today's workout + context
│   └── /explain           # POST explain a workout
│
├── /plan
│   ├── /generate          # POST generate new plan
│   ├── /current           # GET current plan
│   ├── /week/[week]       # GET specific week
│   ├── /workout/[id]      # GET, PUT workout
│   └── /adjust            # POST request adjustment
│
├── /races
│   ├── /                  # GET all, POST new
│   └── /[id]              # GET, PUT, DELETE
│
├── /integrations
│   ├── /strava
│   │   ├── /connect       # GET OAuth URL
│   │   ├── /callback      # OAuth callback
│   │   └── /sync          # POST trigger sync
│   ├── /whoop
│   │   └── ...
│   └── /garmin
│       └── ...
│
├── /activities
│   ├── /                  # GET recent activities
│   ├── /[id]              # GET activity detail
│   └── /analyze           # POST analyze activity
│
└── /recovery
    └── /                  # GET recovery data
```

---

## AI System Design

### Context Management
Each coaching interaction includes:

```typescript
interface CoachingContext {
  // User profile
  athlete: AthleteProfile;
  
  // Current plan
  plan: {
    currentPhase: string;
    currentWeek: WeeklyPlan;
    upcomingWorkouts: Workout[];
    recentWorkouts: Workout[];
  };
  
  // Recent data
  recentActivities: Activity[];
  recoveryTrend: RecoveryMetric[];
  
  // Conversation history (last N messages)
  conversationHistory: Message[];
  
  // Race context
  primaryRace: Race;
  daysUntilRace: number;
}
```

### Prompt Engineering

**System Prompt (Coach Persona)**
```
You are an elite triathlon coach with 20+ years of experience coaching 
age-group athletes to Ironman success. You combine deep physiological 
knowledge with practical wisdom about balancing training with life.

Your coaching style:
- Direct but supportive
- Data-informed but not data-obsessed
- Always explain the "why" behind prescriptions
- Acknowledge constraints and adapt pragmatically
- Celebrate progress, address concerns proactively

When prescribing workouts, always include:
1. Clear targets (pace, power, HR, or RPE)
2. Execution guidance (how to pace, what to focus on)
3. Why this session matters in the bigger picture
4. Modifications if the athlete is fatigued or time-constrained
```

**Plan Generation Prompt**
```
Generate a periodized training plan for the following athlete:
[Context injection]

Requirements:
1. Build from current fitness to race-day readiness
2. Progressive overload with recovery weeks every 3-4 weeks
3. Sport-specific balance based on athlete weaknesses
4. Key sessions that build race-specific fitness
5. Flexibility for life constraints

Output format:
[Structured JSON for phases and weekly targets]
```

### Response Streaming
Use OpenAI streaming for chat to provide immediate feedback:

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  stream: true,
});

for await (const chunk of stream) {
  // Send chunk to client via SSE
}
```

---

## Deployment Pipeline

### GitHub Repository Structure
```
ironcoach/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Lint, test, type-check
│       └── deploy.yml      # Auto-deploy to Vercel
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # Auth pages
│   │   ├── (dashboard)/    # Protected app pages
│   │   ├── api/            # API routes
│   │   └── layout.tsx
│   ├── components/         # React components
│   │   ├── ui/             # shadcn components
│   │   └── ...
│   ├── lib/                # Utilities
│   │   ├── supabase/
│   │   ├── stripe/
│   │   ├── openai/
│   │   └── integrations/
│   └── types/              # TypeScript types
├── supabase/
│   ├── migrations/         # Database migrations
│   └── seed.sql            # Seed data
├── public/
├── .env.example
├── package.json
└── README.md
```

### CI/CD Flow
```
Push to main → GitHub Actions → 
  ├── Lint + Type Check
  ├── Run Tests
  └── Deploy to Vercel (if checks pass)
```

### Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Integrations
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
```

---

## Security Considerations

1. **Authentication**: Supabase Auth with RLS (Row Level Security)
2. **API Protection**: All routes check auth, rate limited
3. **Data Encryption**: Tokens encrypted at rest
4. **HTTPS Only**: Enforced by Vercel
5. **Input Validation**: Zod schemas on all inputs
6. **Webhook Verification**: Stripe signature validation

---

## Scaling Considerations

### Current Architecture Limits
- Vercel serverless: Good for ~100K requests/day
- Supabase free tier: 500MB database, 2GB bandwidth
- OpenAI: Rate limits based on tier

### When to Scale
- Move to Supabase Pro at ~1000 users
- Add Redis caching at ~5000 users
- Consider dedicated backend at ~10000 users

---

## Monitoring & Observability

1. **Vercel Analytics**: Page performance, Web Vitals
2. **Sentry**: Error tracking, performance monitoring
3. **Supabase Dashboard**: Database metrics, auth stats
4. **Stripe Dashboard**: Revenue, subscription metrics
5. **Custom Dashboards**: User engagement, coaching quality metrics
