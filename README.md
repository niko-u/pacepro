# PacePro.ai

AI-powered triathlon coaching platform. Hyper-personalized training plans that adapt to your life.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (Postgres + Auth)
- **AI**: OpenAI GPT-4
- **Payments**: Stripe
- **Hosting**: Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

## Environment Variables

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
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, signup)
│   ├── (dashboard)/      # Protected app pages
│   └── api/              # API routes
├── components/
│   └── ui/               # shadcn components
├── lib/
│   ├── supabase/         # Supabase client
│   ├── stripe/           # Stripe utilities
│   └── openai/           # AI prompts and helpers
└── types/                # TypeScript types
```

## Documentation

- [Product Requirements](docs/PRODUCT.md)
- [Technical Architecture](docs/ARCHITECTURE.md)

## Deployment

Automatic deployment via Vercel on push to `main`.
