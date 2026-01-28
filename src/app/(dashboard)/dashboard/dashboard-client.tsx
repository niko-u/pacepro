"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import WorkoutDetailModal from "@/components/workout-detail-modal";

interface DashboardClientProps {
  user: User;
}

// Mock data - will be replaced with real data from Supabase
const todayWorkout = {
  type: "run",
  title: "Easy Recovery Run",
  description: "Keep this easy! Focus on staying in Zone 2, maintaining a conversational pace. This helps build aerobic base while allowing recovery from yesterday's efforts.",
  duration: 45,
  distance: "7-8km",
  zone: "Zone 2",
  warmup: "10 minutes easy jogging, gradually building to your easy run pace. Include 4-6 leg swings each side.",
  cooldown: "5 minutes easy walking, then light stretching focusing on calves and hip flexors.",
  tips: [
    "If you can't hold a conversation, slow down",
    "Keep cadence around 170-180 spm",
    "Stay relaxed — loose shoulders, soft hands"
  ],
  whyThisMatters: "Easy runs build your aerobic engine without adding stress. They also help clear metabolic waste from harder sessions. The adaptations happen during recovery — not during the run itself."
};

const coachInsight = {
  title: "Your recovery looks good",
  content: "Your WHOOP shows 78% recovery this morning, and your HRV is above your baseline. You're cleared for today's easy run. Just remember — easy means easy!",
  type: "positive" as const,
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
  { role: "assistant", content: "Good morning! Ready for your easy run today? Remember — keep it truly easy. Your body adapts during recovery, not during the hard sessions." },
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
    // TODO: Send to AI and get response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Great question! I'll help you with that. Based on your training load this week..." 
      }]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background effects */}
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
            <NavItem href="/dashboard" icon="🏠" label="Dashboard" active />
            <NavItem href="/calendar" icon="📅" label="Calendar" />
            <NavItem href="/chat" icon="💬" label="Chat" />
            <NavItem href="/analytics" icon="📊" label="Analytics" />
            <NavItem href="/settings" icon="⚙️" label="Settings" />
          </nav>
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
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
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
              <p className="text-zinc-400">Here's your training for today.</p>
            </motion.div>

            {/* Coach Insight */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`mb-6 p-4 rounded-2xl border ${
                coachInsight.type === 'positive' 
                  ? 'border-green-500/20 bg-green-500/5' 
                  : coachInsight.type === 'warning'
                  ? 'border-yellow-500/20 bg-yellow-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  coachInsight.type === 'positive' ? 'bg-green-500/20 text-green-400' :
                  coachInsight.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {coachInsight.type === 'positive' ? '✓' : coachInsight.type === 'warning' ? '!' : '→'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{coachInsight.title}</h3>
                  <p className="text-sm text-zinc-400">{coachInsight.content}</p>
                </div>
              </div>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Today's Workout */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 flex items-center justify-center text-2xl">
                          🏃
                        </div>
                        <div>
                          <div className="text-sm text-zinc-500">Today's Workout</div>
                          <div className="text-xl font-semibold">{todayWorkout.title}</div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                        {todayWorkout.type}
                      </span>
                    </div>

                    <p className="text-zinc-400 mb-6 leading-relaxed">
                      {todayWorkout.description}
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.duration}</div>
                        <div className="text-xs text-zinc-500">minutes</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.zone}</div>
                        <div className="text-xs text-zinc-500">target</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 text-center">
                        <div className="text-2xl font-bold">{todayWorkout.distance}</div>
                        <div className="text-xs text-zinc-500">distance</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 mb-6">
                      <div className="text-sm font-medium text-orange-400 mb-2">💡 Coach tips</div>
                      <ul className="space-y-1 text-sm text-zinc-400">
                        {todayWorkout.tips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        onClick={() => setShowWorkoutDetail(true)}
                        className="flex-1 h-12 border-white/10 hover:bg-white/5"
                      >
                        View Details
                      </Button>
                      <Button className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 shadow-lg shadow-orange-500/20">
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
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <h3 className="font-semibold mb-4">This Week</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {weekSchedule.map((day) => (
                      <div key={day.day} className="text-center">
                        <div className="text-xs text-zinc-500 mb-2">{day.day}</div>
                        <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                          day.today 
                            ? "bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-500/50" 
                            : "bg-white/5 border border-white/5"
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
                className="rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col h-[600px]"
              >
                <div className="p-4 border-b border-white/5">
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
                          : 'bg-white/5 text-zinc-300'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-white/5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask your coach anything..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-600"
                    />
                    <Button
                      onClick={handleSendMessage}
                      size="sm"
                      className="h-10 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0"
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
          onStart={() => {
            setShowWorkoutDetail(false);
            // TODO: Start workout tracking
          }}
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
          ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-white border border-orange-500/20' 
          : 'text-zinc-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}
