"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface CalendarClientProps {
  user: User;
}

const mockPlan = {
  race: { name: "Ironman Texas", date: "2025-04-26", weeksOut: 12 },
  currentWeek: 1,
  phase: "Base Building",
};

// Generate mock workouts
const generateMockWorkouts = () => {
  const workouts: Record<string, { type: string; title: string; duration: number; emoji: string }[]> = {};
  const types = [
    { type: "swim", emoji: "🏊", titles: ["Technique Drills", "Endurance Swim", "Speed Work"] },
    { type: "bike", emoji: "🚴", titles: ["Base Ride", "Hill Repeats", "Tempo Ride", "Long Ride"] },
    { type: "run", emoji: "🏃", titles: ["Easy Run", "Intervals", "Tempo Run", "Long Run"] },
    { type: "strength", emoji: "💪", titles: ["Core Work", "Full Body"] },
  ];
  
  const today = new Date();
  for (let i = -30; i < 60; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      workouts[dateStr] = [{ type: "rest", title: "Rest Day", duration: 0, emoji: "😴" }];
    } else if (dayOfWeek === 6) {
      const w = types[Math.floor(Math.random() * 3)];
      workouts[dateStr] = [{ type: w.type, title: w.titles[w.titles.length - 1], duration: 90, emoji: w.emoji }];
    } else {
      const w = types[Math.floor(Math.random() * 4)];
      workouts[dateStr] = [{ type: w.type, title: w.titles[Math.floor(Math.random() * w.titles.length)], duration: 45, emoji: w.emoji }];
    }
  }
  return workouts;
};

const mockWorkouts = generateMockWorkouts();

export default function CalendarClient({ user }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get week dates (Mon-Sun)
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
    start.setDate(start.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  // Get month dates (6 weeks grid)
  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay() === 0 ? -6 : 1 - firstDay.getDay();
    const start = new Date(year, month, startDay);
    
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates(currentDate);
  const monthDates = getMonthDates(currentDate);

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-zinc-50 dark:bg-black" />
      <div className="fixed inset-0 dark:bg-gradient-to-br dark:from-orange-500/10 dark:via-transparent dark:to-red-500/10" />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-black/95 backdrop-blur-xl z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-50" />
              <div className="relative w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-sm text-white">
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

        <div className="absolute bottom-20 left-0 right-0 px-6">
          <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{mockPlan.race.name}</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{mockPlan.race.weeksOut} weeks</div>
            <div className="text-xs text-zinc-500">until race day</div>
          </div>
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
              <div>
                <h1 className="text-lg font-semibold">Training Calendar</h1>
                <p className="text-sm text-zinc-500">{mockPlan.phase} • Week {mockPlan.currentWeek}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    view === 'week' 
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    view === 'month' 
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Month
                </button>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {view === 'week' 
                  ? `${weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                }
              </div>
            </div>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week View */}
          {view === 'week' && (
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
                        ? "border-orange-400 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-500/5"
                        : "border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900"
                    } ${isPast ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-zinc-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={`text-2xl font-bold ${isToday ? "text-orange-600 dark:text-orange-400" : ""}`}>
                          {date.getDate()}
                        </div>
                      </div>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-200 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 text-xs">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {workouts.map((workout, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer ${
                            workout.type === 'rest'
                              ? 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                              : workout.type === 'run'
                              ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
                              : workout.type === 'bike'
                              ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20'
                              : workout.type === 'swim'
                              ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
                              : 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{workout.emoji}</span>
                            <span className="text-sm font-medium truncate">{workout.title}</span>
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
          )}

          {/* Month View */}
          {view === 'month' && (
            <div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-sm text-zinc-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {monthDates.map((date, i) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const workouts = mockWorkouts[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isPast = date < today && !isToday;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      className={`rounded-xl border p-2 min-h-[100px] transition-all ${
                        isToday
                          ? "border-orange-400 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-500/10"
                          : isCurrentMonth
                          ? "border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900"
                          : "border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/30"
                      } ${isPast ? "opacity-50" : ""} ${!isCurrentMonth ? "opacity-40" : ""}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday ? "text-orange-600 dark:text-orange-400" : 
                        isCurrentMonth ? "" : "text-zinc-400"
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {workouts.slice(0, 2).map((workout, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-1 text-xs"
                          >
                            <span>{workout.emoji}</span>
                            <span className="truncate text-zinc-600 dark:text-zinc-400">{workout.title}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
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
          ? 'bg-orange-100 dark:bg-gradient-to-r dark:from-orange-500/10 dark:to-red-500/10 text-orange-700 dark:text-white border border-orange-200 dark:border-orange-500/20' 
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}
