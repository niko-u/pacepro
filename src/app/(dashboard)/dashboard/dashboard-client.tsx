"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import WorkoutDetailModal from "@/components/workout-detail-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { RecoveryWidget } from "@/components/recovery-widget";

interface DashboardClientProps {
  user: User;
}

// Mock data
const todayWorkout = {
  type: "run",
  title: "Easy Recovery Run",
  description: "Keep this easy! Focus on staying in Zone 2, maintaining a conversational pace.",
  duration: 45,
  distance: "7-8km",
  zone: "Zone 2",
  warmup: "10 minutes easy jogging, gradually building to your easy run pace.",
  cooldown: "5 minutes easy walking, then light stretching.",
  tips: [
    "If you can't hold a conversation, slow down",
    "Keep cadence around 170-180 spm",
    "Stay relaxed — loose shoulders, soft hands"
  ],
  whyThisMatters: "Easy runs build your aerobic engine without adding stress."
};

const recoveryData = {
  score: 78,
  hrv: 52,
  restingHr: 48,
  sleepHours: 7.2,
  sleepQuality: 85,
  strain: 12.4,
  source: "WHOOP"
};

const weekSchedule = [
  { day: "Mon", type: "run", emoji: "🏃", done: false, today: true },
  { day: "Tue", type: "swim", emoji: "🏊", done: false, today: false },
  { day: "Wed", type: "bike", emoji: "🚴", done: false, today: false },
  { day: "Thu", type: "strength", emoji: "💪", done: false, today: false },
  { day: "Fri", type: "run", emoji: "🏃", done: false, today: false },
  { day: "Sat", type: "bike", emoji: "🚴", done: false, today: false },
  { day: "Sun", type: "rest", emoji: "😴", done: false, today: false },
];

const recentChats = [
  { role: "assistant", content: "Good morning! Ready for your easy run today? Your recovery looks good." },
];

export default function DashboardClient({ user }: DashboardClientProps) {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(recentChats);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages([...messages, { role: "user", content: chatInput }]);
    setChatInput("");
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Great question! Based on your training load this week..." 
      }]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-zinc-50 dark:bg-gradient-to-br dark:from-orange-600/5 dark:via-black dark:to-red-900/5" />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 backdrop-blur-xl z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
            <NavItem href="/dashboard" icon="🏠" label="Dashboard" active />
            <NavItem href="/calendar" icon="📅" label="Calendar" />
            <NavItem href="/chat" icon="💬" label="Chat" />
            <NavItem href="/analytics" icon="📊" label="Analytics" />
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
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10">
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
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            {/* Welcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Good morning! 👋</h2>
              <p className="text-zinc-600 dark:text-zinc-400">Here's your training for today.</p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Recovery Widget */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <RecoveryWidget data={recoveryData} />
                </motion.div>

                {/* Today's Workout */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/20 flex items-center justify-center text-2xl">
                          🏃
                        </div>
                        <div>
                          <div className="text-sm text-zinc-500">Today's Workout</div>
                          <div className="text-xl font-semibold">{todayWorkout.title}</div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-sm">
                        {todayWorkout.type}
                      </span>
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                      {todayWorkout.description}
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.duration}</div>
                        <div className="text-xs text-zinc-500">minutes</div>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.zone}</div>
                        <div className="text-xs text-zinc-500">target</div>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.distance}</div>
                        <div className="text-xs text-zinc-500">distance</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 mb-6">
                      <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">💡 Coach tips</div>
                      <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {todayWorkout.tips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        onClick={() => setShowWorkoutDetail(true)}
                        className="flex-1 h-12 border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        View Details
                      </Button>
                      <Button className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 text-white shadow-lg shadow-orange-500/20">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Workout
                      </Button>
                    </div>
                  </div>
                </motion.div>

                {/* Week Schedule */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 p-6"
                >
                  <h3 className="font-semibold mb-4">This Week</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {weekSchedule.map((day) => (
                      <div key={day.day} className="text-center">
                        <div className="text-xs text-zinc-500 mb-2">{day.day}</div>
                        <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                          day.today 
                            ? "bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-500/20 dark:to-red-500/20 border-2 border-orange-300 dark:border-orange-500/50" 
                            : "bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5"
                        }`}>
                          {day.emoji}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Chat Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 flex flex-col h-[600px]"
              >
                <div className="p-4 border-b border-zinc-200 dark:border-white/10">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Chat with Coach
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                          : 'bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask your coach anything..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 h-10 px-4 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-500"
                    />
                    <Button
                      onClick={handleSendMessage}
                      size="sm"
                      className="h-10 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Workout Detail Modal */}
      {showWorkoutDetail && (
        <WorkoutDetailModal
          workout={todayWorkout}
          onClose={() => setShowWorkoutDetail(false)}
          onStart={() => setShowWorkoutDetail(false)}
        />
      )}
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
