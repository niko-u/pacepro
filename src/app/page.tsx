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
      
      {/* Grid pattern */}
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
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-black hover:bg-zinc-200 font-medium">
                Get Started
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
              Now in public beta
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
              Train smarter.
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 bg-clip-text text-transparent">
                Race faster.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl leading-relaxed mb-12">
              AI-powered triathlon coaching that adapts to your life. Personalized plans, 
              real-time adjustments, and a coach that actually understands you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 shadow-lg shadow-orange-500/25">
                  Start free trial
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
                Watch demo
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-3 gap-8 mt-24 max-w-2xl"
          >
            <div>
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">2.5k+</div>
              <div className="text-sm text-zinc-500 mt-1">Active athletes</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">50k+</div>
              <div className="text-sm text-zinc-500 mt-1">Workouts completed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">93%</div>
              <div className="text-sm text-zinc-500 mt-1">Hit their goal</div>
            </div>
          </motion.div>
        </div>

        {/* Hero image/mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="absolute right-0 top-32 w-1/2 hidden lg:block"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent z-10" />
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl border border-white/10 p-6 shadow-2xl">
              {/* Mock dashboard */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="space-y-4">
                <div className="h-8 w-48 bg-white/5 rounded-lg" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-24 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl border border-orange-500/20 p-4">
                    <div className="text-2xl mb-1">🏊</div>
                    <div className="text-xs text-zinc-400">Swim</div>
                    <div className="text-lg font-semibold">2,400m</div>
                  </div>
                  <div className="h-24 bg-white/5 rounded-xl p-4">
                    <div className="text-2xl mb-1">🚴</div>
                    <div className="text-xs text-zinc-400">Bike</div>
                    <div className="text-lg font-semibold">45km</div>
                  </div>
                  <div className="h-24 bg-white/5 rounded-xl p-4">
                    <div className="text-2xl mb-1">🏃</div>
                    <div className="text-xs text-zinc-400">Run</div>
                    <div className="text-lg font-semibold">10km</div>
                  </div>
                </div>
                <div className="h-32 bg-white/5 rounded-xl" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Everything you need to
              <br />
              <span className="text-zinc-500">crush your next race</span>
            </h2>
            <p className="text-lg text-zinc-400">
              From your first sprint tri to a full Ironman — adaptive training that evolves with you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="✨"
              title="AI-Generated Plans"
              description="Tell us your goal race, current fitness, and availability. Get a periodized plan in seconds."
              gradient="from-purple-500/20 to-blue-500/20"
            />
            <FeatureCard
              icon="💬"
              title="Chat With Your Coach"
              description="Ask questions, request changes, get motivation. Your AI coach knows your entire history."
              gradient="from-orange-500/20 to-red-500/20"
            />
            <FeatureCard
              icon="🔄"
              title="Adaptive Training"
              description="Life happens. Your plan automatically adjusts based on missed workouts and recovery data."
              gradient="from-green-500/20 to-emerald-500/20"
            />
            <FeatureCard
              icon="📊"
              title="Smart Analytics"
              description="Track progress across swim, bike, and run. Predict your race-day performance."
              gradient="from-blue-500/20 to-cyan-500/20"
            />
            <FeatureCard
              icon="⌚"
              title="Device Sync"
              description="Connect Strava, WHOOP, and Garmin. We auto-import workouts and recovery metrics."
              gradient="from-pink-500/20 to-rose-500/20"
            />
            <FeatureCard
              icon="🎯"
              title="Race-Day Ready"
              description="Taper protocols, nutrition plans, and mental prep. Peak when it matters most."
              gradient="from-amber-500/20 to-yellow-500/20"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-zinc-400">
              Start free. Upgrade when you're ready to go pro.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl" />
              <div className="relative p-8 rounded-3xl border border-white/10 bg-black/50 backdrop-blur">
                <h3 className="text-xl font-semibold mb-2">Free</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold">$0</span>
                  <span className="text-zinc-500">/month</span>
                </div>
                <ul className="space-y-4 mb-8 text-zinc-300">
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Basic training plan
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    5 coach chats / month
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Strava sync
                  </li>
                </ul>
                <Link href="/signup">
                  <Button variant="outline" className="w-full h-12 border-white/10 hover:bg-white/5">
                    Get started
                  </Button>
                </Link>
              </div>
            </div>

            {/* Pro */}
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl opacity-75 blur-sm group-hover:opacity-100 transition-opacity" />
              <div className="relative p-8 rounded-3xl border border-orange-500/50 bg-black">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-sm font-medium">
                    Most popular
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold">$19</span>
                  <span className="text-zinc-500">/month</span>
                </div>
                <ul className="space-y-4 mb-8 text-zinc-300">
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Fully adaptive plans
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Unlimited coach chat
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    WHOOP + Garmin sync
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Advanced analytics
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Race-day protocols
                  </li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0">
                    Start free trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Ready to transform
            <br />
            your training?
          </h2>
          <p className="text-xl text-zinc-400 mb-10">
            Join thousands of athletes who train smarter with PacePro.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 font-medium">
              Start your free trial
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </Link>
          <p className="mt-4 text-sm text-zinc-500">No credit card required</p>
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

function FeatureCard({ icon, title, description, gradient }: { 
  icon: string; 
  title: string; 
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors h-full">
        <div className="text-3xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
