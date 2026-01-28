"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-orange-600/20 via-black to-red-900/20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px]" />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-50" />
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
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-black hover:bg-zinc-200 font-medium">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-400 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              AI coaching for runners & triathletes
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
              A coach that
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 bg-clip-text text-transparent">
                actually knows you.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl leading-relaxed mb-12">
              Not just training plans — an AI coach that reads your recovery, analyzes your workouts, 
              and adjusts your training before you even ask.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 shadow-lg shadow-orange-500/25">
                  Start 7-day free trial
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur">
                <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                See it in action
              </Button>
            </div>
          </motion.div>

          {/* Coach chat preview - Angled like Linear */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-20 max-w-5xl mx-auto"
            style={{ perspective: '1000px' }}
          >
            <div 
              className="rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-orange-500/10"
              style={{ 
                transform: 'rotateX(8deg) rotateY(-8deg) rotateZ(2deg)',
                transformOrigin: 'center center'
              }}
            >
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-zinc-400">Chat with Coach</span>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    P
                  </div>
                  <div className="bg-white/5 rounded-2xl rounded-tl-none p-4 max-w-lg">
                    <p className="text-zinc-300">Good morning! 👋 I saw your tempo run from yesterday — nice work holding 7:15 pace for the main set. That's 12 seconds faster than your last tempo.</p>
                    <p className="text-zinc-300 mt-2">Your WHOOP shows 78% recovery today. You're cleared for intervals, but I'd suggest keeping the rest periods a bit longer. Sound good?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl rounded-tr-none p-4 max-w-lg">
                    <p>Actually I'm feeling a bit tired today. Can we do something easier?</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    P
                  </div>
                  <div className="bg-white/5 rounded-2xl rounded-tl-none p-4 max-w-lg">
                    <p className="text-zinc-300">Absolutely. Smart call — your HRV has actually been trending down this week. Let's swap today for an easy 40-minute run in Zone 2. I'll move intervals to Thursday when you should be more recovered.</p>
                    <p className="text-zinc-300 mt-2">Updated your plan. Take it easy today! 🏃♂️</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Wearable Integrations */}
      <section className="relative py-16 px-6 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-zinc-500 mb-8">Syncs with your favorite fitness wearables</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16">
            {/* WHOOP */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
              </div>
              <span className="text-sm font-medium">WHOOP</span>
            </div>
            {/* Garmin */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Garmin</span>
            </div>
            {/* Apple Health */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Apple Health</span>
            </div>
            {/* Strava */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#FC4C02]" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Strava</span>
            </div>
            {/* Oura */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Oura</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              More than plans.
              <br />
              <span className="text-zinc-500">Real coaching.</span>
            </h2>
            <p className="text-lg text-zinc-400">
              Your AI coach doesn't just generate a plan and disappear. It watches, learns, and adapts — just like a real coach would.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="text-6xl font-bold text-white/5 absolute -top-4 -left-2">1</div>
              <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl mb-4">
                  💬
                </div>
                <h3 className="text-xl font-semibold mb-3">Talk to your coach</h3>
                <p className="text-zinc-400">
                  Ask questions, request changes, report how you're feeling. Your coach responds instantly with personalized guidance.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="text-6xl font-bold text-white/5 absolute -top-4 -left-2">2</div>
              <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl mb-4">
                  📊
                </div>
                <h3 className="text-xl font-semibold mb-3">Get post-workout analysis</h3>
                <p className="text-zinc-400">
                  After every run, your coach analyzes the data: pace, heart rate, effort. You get insights, not just numbers.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="text-6xl font-bold text-white/5 absolute -top-4 -left-2">3</div>
              <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl mb-4">
                  🔄
                </div>
                <h3 className="text-xl font-semibold mb-3">Watch it adapt</h3>
                <p className="text-zinc-400">
                  Low recovery score? Missed a workout? Your plan adjusts automatically — and your coach tells you why.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Everything a great coach does
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Except available 24/7, for a fraction of the cost.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🗣️"
              title="Conversational Coaching"
              description="Chat anytime. Ask questions, get modifications, discuss strategy. Your coach knows your entire history."
              highlight
            />
            <FeatureCard
              icon="📈"
              title="Post-Workout Analysis"
              description="Every workout gets analyzed. Your coach tells you what went well, what to watch, and how it fits the bigger picture."
              highlight
            />
            <FeatureCard
              icon="❤️"
              title="Recovery Intelligence"
              description="Connects to WHOOP, Garmin, Apple Health. Your coach sees your HRV, sleep, and recovery — and adjusts accordingly."
              highlight
            />
            <FeatureCard
              icon="🎯"
              title="Personalized Plans"
              description="Not templates. Plans built for YOUR schedule, YOUR goals, YOUR body. From 5K to Ironman."
            />
            <FeatureCard
              icon="🔄"
              title="Real-time Adaptation"
              description="Life happens. Miss a workout, get sick, travel — your plan adjusts automatically with full transparency."
            />
            <FeatureCard
              icon="📅"
              title="Race-Day Ready"
              description="Taper protocols, pacing strategy, and mental prep. Your coach ensures you peak when it matters."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Real coaching, fair price
            </h2>
            <p className="text-lg text-zinc-400">
              A human coach costs $200-400/month. PacePro delivers the same personalization for a fraction of that.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl opacity-75 blur-sm group-hover:opacity-100 transition-opacity" />
              <div className="relative p-8 rounded-3xl border border-orange-500/50 bg-black">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">PacePro Coach</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-6xl font-bold">$50</span>
                    <span className="text-zinc-500">/month</span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-2">7-day free trial • Cancel anytime</p>
                </div>

                <ul className="space-y-4 mb-8">
                  <PricingFeature text="Unlimited coach chat" />
                  <PricingFeature text="Post-workout analysis on every session" />
                  <PricingFeature text="Recovery-based plan adjustments" />
                  <PricingFeature text="Personalized periodized training plan" />
                  <PricingFeature text="Strava, WHOOP, Garmin integration" />
                  <PricingFeature text="Race-day protocols and taper" />
                  <PricingFeature text="Weekly progress summaries" />
                </ul>

                <Link href="/signup">
                  <Button className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 shadow-lg shadow-orange-500/25">
                    Start your free trial
                  </Button>
                </Link>
              </div>
            </div>

            <p className="text-center text-zinc-500 text-sm mt-6">
              Annual plan available: $500/year (save 2 months)
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Ready for a coach that
            <br />
            actually coaches?
          </h2>
          <p className="text-xl text-zinc-400 mb-10">
            Start your 7-day free trial. No credit card required.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 font-medium">
              Get started free
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="font-semibold">PacePro</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-sm text-zinc-600">
            © 2025 PacePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, highlight = false }: { 
  icon: string; 
  title: string; 
  description: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative p-6 rounded-2xl border transition-colors h-full ${
      highlight 
        ? "border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5" 
        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
    }`}>
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-zinc-300">
      <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </li>
  );
}
