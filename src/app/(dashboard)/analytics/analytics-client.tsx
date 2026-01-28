"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface AnalyticsClientProps {
  user: User;
}

// Mock data for charts
const weeklyVolume = [
  { week: "W1", swim: 2.5, bike: 4, run: 3, total: 9.5 },
  { week: "W2", swim: 3, bike: 4.5, run: 3.5, total: 11 },
  { week: "W3", swim: 2, bike: 3, run: 2.5, total: 7.5 }, // Recovery week
  { week: "W4", swim: 3.5, bike: 5, run: 4, total: 12.5 },
  { week: "W5", swim: 3, bike: 5.5, run: 4, total: 12.5 },
  { week: "W6", swim: 4, bike: 6, run: 4.5, total: 14.5 },
];

const recentWorkouts = [
  { date: "Jan 27", type: "run", title: "Tempo Run", duration: 45, planned: 45, effort: 7, status: "completed" },
  { date: "Jan 26", type: "bike", title: "Base Ride", duration: 90, planned: 90, effort: 5, status: "completed" },
  { date: "Jan 25", type: "swim", title: "Drill Work", duration: 45, planned: 60, effort: 6, status: "modified" },
  { date: "Jan 24", type: "run", title: "Easy Run", duration: 40, planned: 40, effort: 4, status: "completed" },
  { date: "Jan 23", type: "strength", title: "Core Work", duration: 30, planned: 30, effort: 5, status: "completed" },
];

const weeklyStats = {
  totalHours: 8.5,
  plannedHours: 9,
  completionRate: 94,
  avgEffort: 5.4,
  swimDistance: 4500,
  bikeDistance: 120,
  runDistance: 35,
};

const raceInfo = {
  name: "Ironman Texas",
  date: "2025-04-26",
  daysOut: 88,
  readiness: 72,
  trend: "improving",
};

export default function AnalyticsClient({ user }: AnalyticsClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeRange, setTimeRange] = useState<'4w' | '8w' | '12w'>('8w');

  const maxVolume = Math.max(...weeklyVolume.map(w => w.total));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-zinc-50 dark:bg-gradient-to-br dark:from-orange-600/5 dark:via-black dark:to-red-900/5" />
      <div className="fixed inset-0 dark:bg-[linear-gradient(rgba(255,255,255,.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.01)_1px,transparent_1px)] dark:bg-[size:72px_72px]" />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-black/95 backdrop-blur-xl z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-50" />
              <div className="relative w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-sm">
                P
              </div>
            </div>
            <span className="font-semibold text-lg">PacePro</span>
          </div>

          <nav className="space-y-1">
            <NavItem href="/dashboard" icon="🏠" label="Dashboard" />
            <NavItem href="/calendar" icon="📅" label="Calendar" />
            <NavItem href="/chat" icon="💬" label="Chat" />
            <NavItem href="/analytics" icon="📊" label="Analytics" active />
            <NavItem href="/settings" icon="⚙️" label="Settings" />
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-medium text-white">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.email}</div>
              <div className="text-xs text-zinc-500">Pro Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`relative transition-all ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/90 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold">Analytics</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
                {(['4w', '8w', '12w'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      timeRange === range 
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Race Readiness Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-orange-200 dark:border-white/10 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/10 p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Training for</p>
                  <h2 className="text-2xl font-bold mb-2">{raceInfo.name}</h2>
                  <p className="text-zinc-400">
                    {raceInfo.daysOut} days to go • {new Date(raceInfo.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-center">
                  <div className="relative w-32 h-32 mx-auto">
                    <svg className="w-32 h-32 -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
                      <circle 
                        cx="64" cy="64" r="56" fill="none" stroke="url(#gradient)" strokeWidth="8" 
                        strokeDasharray={`${2 * Math.PI * 56 * raceInfo.readiness / 100} ${2 * Math.PI * 56}`}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{raceInfo.readiness}%</span>
                      <span className="text-xs text-zinc-500">Race Ready</span>
                    </div>
                  </div>
                  <p className="text-sm text-green-400 mt-2 flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Trending up
                  </p>
                </div>
              </div>
            </motion.div>

            {/* This Week Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <StatCard label="Training Hours" value={`${weeklyStats.totalHours}h`} subtext={`/ ${weeklyStats.plannedHours}h planned`} />
              <StatCard label="Completion Rate" value={`${weeklyStats.completionRate}%`} subtext="This week" positive />
              <StatCard label="Avg Effort" value={weeklyStats.avgEffort.toFixed(1)} subtext="/ 10 RPE" />
              <StatCard label="Run Volume" value={`${weeklyStats.runDistance}km`} subtext="This week" />
            </motion.div>

            {/* Volume Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/80 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold">Weekly Training Volume</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500" /> Swim</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-yellow-500" /> Bike</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500" /> Run</span>
                </div>
              </div>
              
              <div className="flex items-end gap-4 h-48">
                {weeklyVolume.map((week, i) => (
                  <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col gap-0.5" style={{ height: `${(week.total / maxVolume) * 100}%` }}>
                      <div className="bg-green-500 rounded-t" style={{ height: `${(week.run / week.total) * 100}%` }} />
                      <div className="bg-yellow-500" style={{ height: `${(week.bike / week.total) * 100}%` }} />
                      <div className="bg-blue-500 rounded-b" style={{ height: `${(week.swim / week.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 mt-2">{week.week}</span>
                    <span className="text-xs text-zinc-600">{week.total}h</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Workouts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/80 p-6"
            >
              <h3 className="font-semibold mb-4">Recent Workouts</h3>
              <div className="space-y-3">
                {recentWorkouts.map((workout, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      workout.type === 'swim' ? 'bg-blue-500/20' :
                      workout.type === 'bike' ? 'bg-yellow-500/20' :
                      workout.type === 'run' ? 'bg-green-500/20' :
                      'bg-purple-500/20'
                    }`}>
                      {workout.type === 'swim' ? '🏊' : workout.type === 'bike' ? '🚴' : workout.type === 'run' ? '🏃' : '💪'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{workout.title}</div>
                      <div className="text-sm text-zinc-500">{workout.date} • {workout.duration} min</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">RPE {workout.effort}/10</div>
                      <div className={`text-xs ${
                        workout.status === 'completed' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {workout.status === 'completed' ? '✓ Completed' : '~ Modified'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/80 p-6"
            >
              <h3 className="font-semibold mb-4">Coach Insights</h3>
              <div className="space-y-4">
                <InsightCard 
                  type="positive"
                  title="Great consistency this week"
                  description="You completed 94% of planned workouts. This consistency is key to building fitness."
                />
                <InsightCard 
                  type="neutral"
                  title="Run pace improving"
                  description="Your easy run pace has dropped 15 sec/km over the past month while maintaining the same heart rate."
                />
                <InsightCard 
                  type="warning"
                  title="Watch your recovery"
                  description="Your HRV has been trending down. Consider extra sleep and keeping tomorrow's workout easy."
                />
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active 
          ? 'bg-orange-100 dark:bg-gradient-to-r dark:from-orange-500/20 dark:to-red-600/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/40 shadow-sm dark:shadow-orange-500/10' 
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

function StatCard({ label, value, subtext, positive = false }: { label: string; value: string; subtext: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/80 p-4">
      <p className="text-sm text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${positive ? 'text-green-600 dark:text-green-400' : ''}`}>{value}</p>
      <p className="text-xs text-zinc-500">{subtext}</p>
    </div>
  );
}

function InsightCard({ type, title, description }: { type: 'positive' | 'neutral' | 'warning'; title: string; description: string }) {
  const colors = {
    positive: 'border-green-500/20 bg-green-500/5',
    neutral: 'border-blue-500/20 bg-blue-500/5',
    warning: 'border-yellow-500/20 bg-yellow-500/5',
  };
  const icons = {
    positive: '✓',
    neutral: '→',
    warning: '!',
  };
  const iconColors = {
    positive: 'text-green-500',
    neutral: 'text-blue-500',
    warning: 'text-yellow-500',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[type]}`}>
      <div className="flex gap-3">
        <span className={`text-lg ${iconColors[type]}`}>{icons[type]}</span>
        <div>
          <p className="font-medium mb-1">{title}</p>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
