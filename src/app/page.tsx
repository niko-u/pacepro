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
                    <p className="text-zinc-300 mt-2">Updated your plan. Take it easy today! 🏃‍♂️</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Wearable Integrations */}
      <section className="relative py-20 px-6 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-zinc-500 mb-12 text-lg">Syncs with your favorite fitness wearables</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20">
            {/* WHOOP */}
            <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="h-14 flex items-center justify-center">
                <span className="text-3xl font-black tracking-tighter text-white">WHOOP</span>
              </div>
            </div>
            {/* Garmin */}
            <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="h-14 flex items-center justify-center">
                <svg viewBox="0 0 200 50" className="h-10 text-white" fill="currentColor">
                  <path d="M25 10 L25 40 L30 40 L30 27 L45 27 L45 40 L50 40 L50 10 L45 10 L45 22 L30 22 L30 10 Z"/>
                  <text x="55" y="35" className="text-3xl font-bold" style={{fontSize: '28px'}}>GARMIN</text>
                </svg>
              </div>
            </div>
            {/* Apple Health */}
            <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="h-14 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-white" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
            </div>
            {/* Strava */}
            <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="h-14 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#FC4C02]" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
              </div>
            </div>
            {/* Oura */}
            <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="h-14 flex items-center justify-center">
                <span className="text-2xl font-semibold tracking-wide text-white">ŌURA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - with second angled screenshot */}
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

          {/* Clean orange cards without emojis */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-6 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-600/10 h-full">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg font-bold mb-4">1</div>
                <h3 className="text-xl font-semibold mb-3">Talk to your coach</h3>
                <p className="text-zinc-400">
                  Ask questions, request changes, report how you're feeling. Your coach responds instantly with personalized guidance.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-6 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-600/10 h-full">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg font-bold mb-4">2</div>
                <h3 className="text-xl font-semibold mb-3">Get post-workout analysis</h3>
                <p className="text-zinc-400">
                  After every run, your coach analyzes the data: pace, heart rate, effort. You get insights, not just numbers.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-6 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-600/10 h-full">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg font-bold mb-4">3</div>
                <h3 className="text-xl font-semibold mb-3">Watch it adapt</h3>
                <p className="text-zinc-400">
                  Low recovery score? Missed a workout? Your plan adjusts automatically — and your coach tells you why.
                </p>
              </div>
            </div>
          </div>

          {/* Second angled screenshot - Analytics/Dashboard preview - upward angle */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
            style={{ perspective: '1000px' }}
          >
            <div 
              className="rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-orange-500/10"
              style={{ 
                transform: 'rotateX(-6deg) rotateY(6deg) rotateZ(-1deg)',
                transformOrigin: 'center center'
              }}
            >
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-zinc-400">Training Dashboard</span>
              </div>
              <div className="p-6">
                {/* Recovery Score */}
                <div className="flex gap-6 mb-6">
                  <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <div className="text-sm text-zinc-400 mb-2">Recovery Score</div>
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke="url(#green-gradient)" strokeWidth="4" strokeDasharray="140 176" strokeLinecap="round" />
                          <defs>
                            <linearGradient id="green-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#22c55e" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-green-400">78%</span>
                      </div>
                      <div className="text-sm text-zinc-400">
                        <div>HRV: 52ms</div>
                        <div>Sleep: 7.2h</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-sm text-zinc-400 mb-2">Today's Workout</div>
                    <div className="text-lg font-semibold">Easy Recovery Run</div>
                    <div className="text-sm text-zinc-500 mt-1">45 min • Zone 2</div>
                    <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-0 bg-gradient-to-r from-orange-500 to-red-600 rounded-full" />
                    </div>
                  </div>
                </div>
                {/* Week Calendar */}
                <div className="flex gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className={`flex-1 p-3 rounded-lg text-center ${i === 0 ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30' : 'bg-white/5'}`}>
                      <div className="text-xs text-zinc-500">{day}</div>
                      <div className="text-lg mt-1">{['🏃', '🏊', '🚴', '💪', '🏃', '🚴', '😴'][i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features - Linear style with description + screenshot */}
      <section id="features" className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Everything a great coach does
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Except available 24/7, for a fraction of the cost.
            </p>
          </div>

          {/* Feature 1: Conversational Coaching */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <h3 className="text-3xl font-bold mb-4">Conversational Coaching</h3>
              <p className="text-lg text-zinc-400 mb-6 leading-relaxed">
                Chat with your coach anytime, anywhere. Ask questions, request workout modifications, discuss race strategy, or just vent about a tough day. Your AI coach knows your entire training history and responds with personalized guidance that actually makes sense for you.
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Instant responses, 24/7 availability
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Remembers your preferences and history
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Natural conversation, not menu navigation
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 overflow-hidden">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">P</div>
                  <div className="bg-white/5 rounded-xl rounded-tl-none p-3 text-sm text-zinc-300">
                    Looking at your upcoming race schedule, I'd recommend starting your taper in 2 weeks. That gives you 10 days to reduce volume while maintaining sharpness.
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <div className="bg-gradient-to-r from-orange-500/80 to-red-600/80 rounded-xl rounded-tr-none p-3 text-sm">
                    What about the long run this Saturday? Should I still do 18 miles?
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">P</div>
                  <div className="bg-white/5 rounded-xl rounded-tl-none p-3 text-sm text-zinc-300">
                    Great question! Yes, let's keep this Saturday at 18 miles — it's your last long run before taper. After that, we'll drop to 12, then 8. I'll update your calendar.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Post-Workout Analysis */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1 rounded-2xl border border-white/10 bg-zinc-900/50 p-4 overflow-hidden">
              <div className="p-4 border-b border-white/5 mb-4">
                <div className="text-sm text-zinc-500">Yesterday's Run</div>
                <div className="text-lg font-semibold">Tempo Run • 45 min</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <div className="text-2xl font-bold text-green-400">7:15</div>
                  <div className="text-xs text-zinc-500">Avg Pace</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <div className="text-2xl font-bold text-orange-400">162</div>
                  <div className="text-xs text-zinc-500">Avg HR</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <div className="text-2xl font-bold text-blue-400">6.2</div>
                  <div className="text-xs text-zinc-500">Miles</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-zinc-300">
                <span className="text-green-400 font-medium">Analysis:</span> Strong session! You negative split the final 2 miles and stayed in zone 3 throughout the tempo portion. This is a 12-second improvement from your last tempo.
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-3xl font-bold mb-4">Post-Workout Analysis</h3>
              <p className="text-lg text-zinc-400 mb-6 leading-relaxed">
                After every workout, your coach analyzes the data and gives you meaningful insights — not just graphs and numbers. Understand what went well, what to watch for, and how each session fits into your bigger picture.
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Automatic sync from Strava, Garmin, or watch
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Compare planned vs actual performance
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Track progress trends over weeks and months
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3: Recovery Intelligence */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-4">Recovery Intelligence</h3>
              <p className="text-lg text-zinc-400 mb-6 leading-relaxed">
                Connect your WHOOP, Garmin, or Apple Watch and let your coach see the full picture. Your HRV, sleep quality, and recovery metrics inform every training decision — so you train hard when you can, and rest when you need to.
              </p>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Auto-adjust workouts based on recovery
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Spot overtraining before burnout
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Optimize sleep and recovery habits
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 overflow-hidden">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="url(#yellow-gradient)" strokeWidth="4" strokeDasharray="90 150" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="yellow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-yellow-400">58%</span>
                </div>
                <div>
                  <div className="font-semibold text-yellow-400">Recovery Below Average</div>
                  <div className="text-sm text-zinc-400">HRV down 15% • Sleep: 5.8h</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-sm text-zinc-300">
                <span className="text-yellow-400 font-medium">Coach says:</span> Your body is asking for rest. I've swapped today's intervals for an easy 30-minute jog. Let's push the hard work to Thursday when you're more recovered.
              </div>
            </div>
          </div>

          {/* Additional features grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-24">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h4 className="text-lg font-semibold mb-2">Personalized Plans</h4>
              <p className="text-zinc-400 text-sm">Not templates. Plans built for YOUR schedule, YOUR goals, YOUR body. From 5K to Ironman.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h4 className="text-lg font-semibold mb-2">Real-time Adaptation</h4>
              <p className="text-zinc-400 text-sm">Life happens. Miss a workout, get sick, travel — your plan adjusts automatically with full transparency.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h4 className="text-lg font-semibold mb-2">Race-Day Ready</h4>
              <p className="text-zinc-400 text-sm">Taper protocols, pacing strategy, and mental prep. Your coach ensures you peak when it matters.</p>
            </div>
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
