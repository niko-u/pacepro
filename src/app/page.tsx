"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Subtle gradient background like Linear */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.15),transparent)]" />
      
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-xs">
              P
            </div>
            <span className="font-semibold tracking-tight">PacePro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5 text-[13px]">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-white text-black hover:bg-zinc-200 text-[13px] font-medium h-8">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-[56px] md:text-[72px] font-semibold tracking-[-0.04em] leading-[1.05] mb-6">
              AI coaching that
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                actually coaches.
              </span>
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed mb-10">
              Not templates. A real AI coach that reads your recovery, analyzes every workout, and adapts your training in real-time.
            </p>

            <div className="flex justify-center gap-4">
              <Link href="/signup">
                <Button className="h-11 px-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 text-[15px] font-medium">
                  Start free trial
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Hero screenshot - Linear style */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden shadow-2xl">
              <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <span className="text-xs text-zinc-500 ml-2">Chat with Coach</span>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">P</div>
                  <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm p-4 max-w-md">
                    <p className="text-[14px] text-zinc-300 leading-relaxed">Good morning! Your tempo run yesterday was solid — 7:15 pace, 12 seconds faster than last month. WHOOP shows 78% recovery. Ready for intervals today?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-orange-500/90 to-red-600/90 rounded-2xl rounded-tr-sm p-4 max-w-md">
                    <p className="text-[14px]">I'm feeling tired. Can we do something easier?</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">P</div>
                  <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm p-4 max-w-md">
                    <p className="text-[14px] text-zinc-300 leading-relaxed">Smart call. Your HRV has been trending down. Swapping to easy 40min Zone 2. Intervals moved to Thursday when you'll be recovered. Plan updated ✓</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Integrations - clean logos */}
      <section className="relative py-16 px-6 border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-[13px] text-zinc-500 mb-10">Syncs with your wearables</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16">
            <span className="text-xl font-black tracking-tight text-zinc-500 hover:text-zinc-300 transition-colors">WHOOP</span>
            <span className="text-xl font-bold tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors">GARMIN</span>
            <svg viewBox="0 0 24 24" className="h-7 text-zinc-500 hover:text-zinc-300 transition-colors" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <svg viewBox="0 0 24 24" className="h-7 text-zinc-500 hover:text-[#FC4C02] transition-colors" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
            </svg>
            <span className="text-xl font-semibold tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors">ŌURA</span>
          </div>
        </div>
      </section>

      {/* Features - Linear style: title + description + visual */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          
          {/* Feature 1 */}
          <div className="mb-32">
            <div className="max-w-xl mb-12">
              <h2 className="text-3xl font-semibold tracking-tight mb-4">Talk to your coach, anytime</h2>
              <p className="text-zinc-400 leading-relaxed">
                Ask questions, request changes, or discuss strategy. Your AI coach knows your entire training history and responds instantly.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="rounded-xl border border-white/[0.08] bg-[#111] p-5">
                <div className="space-y-3 text-[13px]">
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[8px] font-bold">P</div>
                    <div className="bg-white/[0.04] rounded-xl rounded-tl-sm p-3 text-zinc-300">I'd start your taper in 2 weeks. That gives 10 days to reduce volume while staying sharp.</div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl rounded-tr-sm p-3 text-zinc-200">Should I still do 18 miles Saturday?</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[8px] font-bold">P</div>
                    <div className="bg-white/[0.04] rounded-xl rounded-tl-sm p-3 text-zinc-300">Yes — it's your last long run before taper. After that, 12 then 8. Calendar updated.</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111] p-5">
                <div className="text-[13px] text-zinc-500 mb-3">Quick actions</div>
                <div className="flex flex-wrap gap-2">
                  {["How's my training load?", "Swap today's workout", "I'm feeling tired", "Explain today's intervals"].map(q => (
                    <span key={q} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-zinc-400">{q}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="mb-32">
            <div className="max-w-xl mb-12">
              <h2 className="text-3xl font-semibold tracking-tight mb-4">Every workout, analyzed</h2>
              <p className="text-zinc-400 leading-relaxed">
                After each session, your coach breaks down what happened — pace, effort, how it compares to your plan — and tells you what it means.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#111] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[13px] text-zinc-500">Yesterday</div>
                  <div className="text-lg font-medium">Tempo Run</div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[12px]">Completed</span>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-green-400">7:15</div>
                  <div className="text-[12px] text-zinc-500">Pace</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold">45:12</div>
                  <div className="text-[12px] text-zinc-500">Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold">162</div>
                  <div className="text-[12px] text-zinc-500">Avg HR</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold">6.2</div>
                  <div className="text-[12px] text-zinc-500">Miles</div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                <p className="text-[13px] text-zinc-300"><span className="text-green-400 font-medium">Analysis:</span> Strong session. You negative split the final 2 miles and stayed in Z3 throughout. 12 seconds faster than your last tempo — fitness is building.</p>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="mb-24">
            <div className="max-w-xl mb-12">
              <h2 className="text-3xl font-semibold tracking-tight mb-4">Recovery-driven adaptation</h2>
              <p className="text-zinc-400 leading-relaxed">
                Your coach sees your HRV, sleep, and strain from WHOOP, Garmin, or Apple Watch — and adjusts your plan before you even ask.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray="87 150" strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-yellow-400">58%</span>
                  </div>
                  <div>
                    <div className="font-medium text-yellow-400">Recovery Below Average</div>
                    <div className="text-[13px] text-zinc-500">HRV down 15% • 5.8h sleep</div>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-400">Your body needs rest. Swapping intervals for easy 30min jog. Hard work moves to Thursday.</p>
              </div>
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray="130 150" strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-green-400">86%</span>
                  </div>
                  <div>
                    <div className="font-medium text-green-400">Fully Recovered</div>
                    <div className="text-[13px] text-zinc-500">HRV up 8% • 8.2h sleep</div>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-400">Green light for intensity. Today's VO2max intervals will hit different. Let's go.</p>
              </div>
            </div>
          </div>

          {/* Small features grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <h3 className="font-medium mb-2">Personalized plans</h3>
              <p className="text-[13px] text-zinc-500">Built for your schedule, goals, and body. 5K to Ironman.</p>
            </div>
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <h3 className="font-medium mb-2">Auto-adaptation</h3>
              <p className="text-[13px] text-zinc-500">Miss a workout? Get sick? Plan adjusts automatically.</p>
            </div>
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <h3 className="font-medium mb-2">Race-day ready</h3>
              <p className="text-[13px] text-zinc-500">Taper protocols and pacing strategy. Peak when it matters.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight mb-4">Real coaching, fair price</h2>
            <p className="text-zinc-400">Human coaches cost $200-400/month. PacePro is a fraction of that.</p>
          </div>

          <div className="max-w-sm mx-auto">
            <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
              <div className="text-center mb-6">
                <div className="text-sm text-zinc-400 mb-1">PacePro Coach</div>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-semibold">$50</span>
                  <span className="text-zinc-500 ml-1">/mo</span>
                </div>
                <div className="text-[13px] text-zinc-500 mt-2">7-day free trial</div>
              </div>

              <ul className="space-y-3 mb-6 text-[14px]">
                {["Unlimited coach chat", "Post-workout analysis", "Recovery-based adjustments", "Personalized training plan", "WHOOP, Garmin, Strava sync", "Race-day protocols"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-zinc-300">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/signup">
                <Button className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 font-medium">
                  Start free trial
                </Button>
              </Link>
            </div>
            <p className="text-center text-[13px] text-zinc-500 mt-4">$500/year (save 2 months)</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-semibold tracking-tight mb-4">
            Ready for a coach that actually coaches?
          </h2>
          <p className="text-zinc-400 mb-8">Start your 7-day free trial. No credit card required.</p>
          <Link href="/signup">
            <Button className="h-11 px-8 bg-white text-black hover:bg-zinc-200 font-medium">
              Get started free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-md flex items-center justify-center text-[10px] font-bold">P</div>
            <span className="font-medium text-sm">PacePro</span>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
