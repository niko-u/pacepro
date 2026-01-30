"use client";

import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-orange-600/8 via-black to-black" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent" />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-40" />
              <div className="relative w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-sm">
                P
              </div>
            </div>
            <span className="font-semibold text-lg tracking-tight">PacePro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <a
            href="#download"
            className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Get the App
          </a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 md:pt-40 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex-1 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-400 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                AI coaching for runners &amp; triathletes
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[0.95] mb-6">
                Your coach.
                <br />
                <span className="bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 bg-clip-text text-transparent">
                  Always on.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-zinc-400 max-w-xl leading-relaxed mb-10">
                An AI endurance coach that reads your recovery, analyzes every workout,
                and adapts your training in real time. Like texting your coach — except it actually knows your data.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <a href="#download">
                  <AppleStoreButton />
                </a>
                <p className="text-sm text-zinc-500">Free 7-day trial · $50/mo</p>
              </div>
            </motion.div>

            {/* Right: iPhone Mockup with Chat */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex-shrink-0"
            >
              <IPhoneMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ─── */}
      <section className="relative py-12 px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-zinc-500 text-sm mb-6">Syncs with your wearables</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14">
            <WearableLogo name="Strava" />
            <WearableLogo name="WHOOP" />
            <WearableLogo name="Garmin" />
            <WearableLogo name="Apple Health" />
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Everything a great coach does
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Available 24/7. For a fraction of the cost.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<ChatIcon />}
              title="Chat with Your Coach"
              description="Ask questions, request changes, report injuries. Your coach responds instantly with personalized guidance."
              accent="orange"
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Post-Workout Analysis"
              description="Every session gets analyzed. Pace, heart rate, effort — you get insights, not just numbers."
              accent="green"
            />
            <FeatureCard
              icon={<HeartIcon />}
              title="Recovery Intelligence"
              description="Connects to WHOOP, Garmin, Apple Health. Your plan adapts to your HRV, sleep, and recovery score."
              accent="red"
            />
            <FeatureCard
              icon={<CalendarIcon />}
              title="Adaptive Training Plans"
              description="Plans built for your schedule, goals, and body. Base → Build → Peak → Taper, periodized automatically."
              accent="blue"
            />
            <FeatureCard
              icon={<SwapIcon />}
              title="Real-time Adaptation"
              description="Miss a workout, get injured, or travel — your plan adjusts automatically. Just tell your coach."
              accent="purple"
            />
            <FeatureCard
              icon={<FlagIcon />}
              title="Race-Day Ready"
              description="From 5K to Ironman. Taper protocols, pacing strategy, and mental prep to peak when it matters."
              accent="orange"
            />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="relative py-28 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Three steps. That&apos;s it.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Tell us about yourself"
              description="Sport, race goals, schedule, experience. A 2-minute setup builds your athlete profile."
            />
            <StepCard
              number="02"
              title="Get your plan"
              description="Your AI coach generates a periodized plan tailored to your fitness, availability, and race date."
            />
            <StepCard
              number="03"
              title="Train and talk"
              description="Chat anytime. Your coach watches every workout, reads your recovery, and adapts the plan as you go."
            />
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="relative py-28 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Real coaching. Fair price.
            </h2>
            <p className="text-lg text-zinc-400">
              A human coach costs $200–400/month. PacePro delivers the same personalization for a fraction.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl opacity-60 blur-sm group-hover:opacity-80 transition-opacity" />
              <div className="relative p-8 rounded-3xl border border-orange-500/40 bg-black">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-3">PacePro Coach</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-6xl font-bold">$50</span>
                    <span className="text-zinc-500">/month</span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-2">7-day free trial · Cancel anytime</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <PricingLine text="Unlimited coach chat" />
                  <PricingLine text="Post-workout analysis on every session" />
                  <PricingLine text="Recovery-based plan adjustments" />
                  <PricingLine text="Personalized periodized training plan" />
                  <PricingLine text="Strava, WHOOP, Garmin integration" />
                  <PricingLine text="Race-day protocols and taper" />
                  <PricingLine text="Weekly progress reports" />
                </ul>

                <a
                  href="#download"
                  className="block w-full py-4 rounded-xl text-center text-lg font-semibold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-colors shadow-lg shadow-orange-500/20"
                >
                  Start your free trial
                </a>
              </div>
            </div>
            <p className="text-center text-zinc-500 text-sm mt-5">
              Annual plan: $500/year (save 2 months)
            </p>
          </div>
        </div>
      </section>

      {/* ─── DOWNLOAD CTA ─── */}
      <section id="download" className="relative py-28 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Ready to train smarter?
          </h2>
          <p className="text-xl text-zinc-400 mb-10">
            Download PacePro and meet your AI coach today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <AppleStoreButton large />
          </div>
          <p className="text-sm text-zinc-600 mt-6">
            Available on iOS · Android coming soon
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="font-semibold">PacePro</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="mailto:support@pacepro.coach" className="hover:text-white transition-colors">Contact</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
          <p className="text-sm text-zinc-600">
            © {new Date().getFullYear()} PacePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   iPhone Mockup with Chat UI
   ═══════════════════════════════════════════ */

function IPhoneMockup() {
  return (
    <div className="relative w-[300px] md:w-[340px]">
      {/* Glow behind phone */}
      <div className="absolute inset-8 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-[40px] blur-3xl" />

      {/* Phone frame */}
      <div className="relative bg-zinc-900 rounded-[48px] border-[3px] border-zinc-700 p-3 shadow-2xl shadow-black/50">
        {/* Screen */}
        <div className="bg-zinc-950 rounded-[40px] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-8 pt-4 pb-2">
            <span className="text-xs text-white font-medium">9:41</span>
            <div className="w-28 h-7 bg-black rounded-full" /> {/* Dynamic Island */}
            <div className="flex items-center gap-1">
              <div className="w-4 h-2.5 border border-white/60 rounded-sm relative">
                <div className="absolute inset-0.5 bg-white/60 rounded-[1px]" style={{ width: "70%" }} />
              </div>
            </div>
          </div>

          {/* Chat header */}
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-white font-medium text-[15px]">Coach</span>
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          </div>

          {/* Chat messages */}
          <div className="px-4 py-4 space-y-3 min-h-[380px]">
            {/* Coach message */}
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                P
              </div>
              <div className="bg-zinc-800 rounded-2xl rounded-tl-md px-3.5 py-2.5 max-w-[230px]">
                <p className="text-[13px] text-zinc-200 leading-relaxed">
                  Good morning! 👋 Your tempo run yesterday was solid — 7:15 pace, 12 sec faster than last week.
                </p>
                <p className="text-[13px] text-zinc-200 leading-relaxed mt-1.5">
                  WHOOP shows 78% recovery. You&apos;re cleared for intervals today.
                </p>
              </div>
            </div>

            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl rounded-tr-md px-3.5 py-2.5 max-w-[210px]">
                <p className="text-[13px] text-white leading-relaxed">
                  I&apos;m a bit tired today. Can we do something easier?
                </p>
              </div>
            </div>

            {/* Coach response */}
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                P
              </div>
              <div className="bg-zinc-800 rounded-2xl rounded-tl-md px-3.5 py-2.5 max-w-[230px]">
                <p className="text-[13px] text-zinc-200 leading-relaxed">
                  Smart call — your HRV has been trending down. Let&apos;s swap for an easy 40-min Zone 2 run. I&apos;ll move intervals to Thursday.
                </p>
                <p className="text-[13px] text-zinc-200 leading-relaxed mt-1.5">
                  📋 Plan updated. Take it easy today!
                </p>
              </div>
            </div>

            {/* Plan update card */}
            <div className="ml-9 bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[11px] text-zinc-400 font-medium">TODAY — UPDATED</span>
              </div>
              <p className="text-[13px] text-white font-medium">Easy Run · 40 min</p>
              <p className="text-[11px] text-zinc-500">Zone 2 · Conversational pace</p>
            </div>
          </div>

          {/* Chat input */}
          <div className="px-4 pb-6 pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-4 py-2.5">
              <span className="text-[13px] text-zinc-500 flex-1">Ask your coach anything...</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function AppleStoreButton({ large = false }: { large?: boolean }) {
  const h = large ? "h-16" : "h-14";
  return (
    <div
      className={`${h} px-6 rounded-xl bg-white text-black flex items-center gap-3 cursor-pointer hover:bg-zinc-200 transition-colors`}
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] opacity-60">Download on the</div>
        <div className={`${large ? "text-xl" : "text-lg"} font-semibold -mt-0.5`}>App Store</div>
      </div>
    </div>
  );
}

function WearableLogo({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
      <span className="text-sm font-medium text-zinc-300">{name}</span>
    </div>
  );
}

const accentMap: Record<string, string> = {
  orange: "from-orange-500/10 border-orange-500/20",
  green: "from-green-500/10 border-green-500/20",
  red: "from-red-500/10 border-red-500/20",
  blue: "from-blue-500/10 border-blue-500/20",
  purple: "from-purple-500/10 border-purple-500/20",
};

function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  const colors = accentMap[accent] || accentMap.orange;
  return (
    <div
      className={`p-6 rounded-2xl border bg-gradient-to-br ${colors} to-transparent hover:scale-[1.02] transition-transform`}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="text-5xl font-bold bg-gradient-to-b from-orange-500 to-red-600 bg-clip-text text-transparent mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingLine({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-zinc-300 text-sm">
      <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </li>
  );
}

/* ─── Icon Components ─── */

function ChatIcon() {
  return (
    <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  );
}
