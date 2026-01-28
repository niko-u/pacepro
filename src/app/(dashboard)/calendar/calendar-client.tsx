"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import Link from "next/link";

interface CalendarClientProps {
  user: User;
}

// Mock training plan data
const mockPlan = {
  race: { name: "Ironman Texas", date: "2025-04-26", weeksOut: 12 },
  currentWeek: 1,
  phase: "Base Building",
  weeklyVolume: { target: 8, unit: "hours" },
};

// Generate mock workouts for the month
const generateMockWorkouts = () => {
  const workouts: Record<string, { type: string; title: string; duration: number; emoji: string }[]> = {};
  const types = [
    { type: "swim", emoji: "🏊", titles: ["Technique Drills", "Endurance Swim", "Speed Work", "Open Water Sim"] },
    { type: "bike", emoji: "🚴", titles: ["Base Ride", "Hill Repeats", "Tempo Ride", "Long Ride"] },
    { type: "run", emoji: "🏃", titles: ["Easy Run", "Intervals", "Tempo Run", "Long Run"] },
    { type: "strength", emoji: "💪", titles: ["Core Work", "Full Body", "Mobility"] },
    { type: "rest", emoji: "😴", titles: ["Rest Day"] },
  ];
  
  const today = new Date();
  for (let i = -7; i < 28; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) { // Sunday - rest
      workouts[dateStr] = [{ type: "rest", title: "Rest Day", duration: 0, emoji: "😴" }];
    } else if (dayOfWeek === 6) { // Saturday - long workout
      const w = types[Math.floor(Math.random() * 3)];
      workouts[dateStr] = [{ type: w.type, title: w.titles[3] || w.titles[0], duration: 90 + Math.floor(Math.random() * 60), emoji: w.emoji }];
    } else {
      const numWorkouts = dayOfWeek === 3 ? 2 : 1; // Wednesday = brick day
      workouts[dateStr] = [];
      for (let j = 0; j < numWorkouts; j++) {
        const w = types[Math.floor(Math.random() * 4)];
        workouts[dateStr].push({
          type: w.type,
          title: w.titles[Math.floor(Math.random() * w.titles.length)],
          duration: 30 + Math.floor(Math.random() * 45),
          emoji: w.emoji,
        });
      }
    }
  }
  return workouts;
};

const mockWorkouts = generateMockWorkouts();

export default function CalendarClient({ user }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get week dates
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentDate);

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-orange-600/5 via-black to-red-900/5" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.01)_1px,transparent_1px)] bg-[size:72px_72px]" />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-black/80 backdrop-blur-xl z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
            <NavItem href="/calendar" icon="📅" label="Calendar" active />
            <NavItem href="/chat" icon="💬" label="Chat" />
            <NavItem href="/analytics" icon="📊" label="Analytics" />
            <NavItem href="/settings" icon="⚙️" label="Settings" />
          </nav>
        </div>

        {/* Race countdown */}
        <div className="absolute bottom-20 left-0 right-0 px-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="text-sm text-zinc-400 mb-1">{mockPlan.race.name}</div>
            <div className="text-2xl font-bold">{mockPlan.race.weeksOut} weeks</div>
            <div className="text-xs text-zinc-500">until race day</div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-medium">
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
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold">Training Calendar</h1>
                <p className="text-sm text-zinc-500">{mockPlan.phase} • Week {mockPlan.currentWeek}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg bg-white/5 p-1">
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1 rounded text-sm transition-all ${view === 'week' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  Week
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-1 rounded text-sm transition-all ${view === 'month' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  Month
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week view */}
          <div className="grid grid-cols-7 gap-4">
            {weekDates.map((date) => {
              const dateStr = date.toISOString().split('T')[0];
              const workouts = mockWorkouts[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isPast = date < today && !isToday;

              return (
                <motion.div
                  key={dateStr}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-4 min-h-[300px] transition-all ${
                    isToday
                      ? "border-orange-500/50 bg-orange-500/5"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  } ${isPast ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-zinc-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className={`text-2xl font-bold ${isToday ? "text-orange-400" : ""}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {workouts.map((workout, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                          workout.type === 'rest'
                            ? "bg-zinc-900/50 border-zinc-800"
                            : workout.type === 'swim'
                            ? "bg-blue-500/10 border-blue-500/20"
                            : workout.type === 'bike'
                            ? "bg-yellow-500/10 border-yellow-500/20"
                            : workout.type === 'run'
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-purple-500/10 border-purple-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{workout.emoji}</span>
                          <span className="text-sm font-medium">{workout.title}</span>
                        </div>
                        {workout.duration > 0 && (
                          <div className="text-xs text-zinc-500">{workout.duration} min</div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Weekly summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 p-6 rounded-2xl border border-white/10 bg-white/[0.02]"
          >
            <h3 className="font-semibold mb-4">Week Summary</h3>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-bold text-orange-400">{mockPlan.weeklyVolume.target}h</div>
                <div className="text-sm text-zinc-500">Total Volume</div>
              </div>
              <div>
                <div className="text-3xl font-bold">🏊 3</div>
                <div className="text-sm text-zinc-500">Swim sessions</div>
              </div>
              <div>
                <div className="text-3xl font-bold">🚴 3</div>
                <div className="text-sm text-zinc-500">Bike sessions</div>
              </div>
              <div>
                <div className="text-3xl font-bold">🏃 3</div>
                <div className="text-sm text-zinc-500">Run sessions</div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active 
          ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-white border border-orange-500/20' 
          : 'text-zinc-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}
