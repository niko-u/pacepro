"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import Link from "next/link";

interface ChatClientProps {
  user: User;
}

// Suggested prompts for users
const suggestedPrompts = [
  "How did my workout go yesterday?",
  "I'm feeling tired today",
  "Can I swap tomorrow's workout?",
  "What should I focus on this week?",
  "Explain today's intervals",
];

// Mock conversation
const initialMessages = [
  {
    role: "assistant",
    content: "Good morning! 👋 I've been looking at your training this week. You've had three solid sessions so far — your tempo run on Tuesday was particularly strong.\n\nYou've got easy recovery miles on the schedule today. Your WHOOP shows 72% recovery, which is decent but not fully topped up. Let's keep it genuinely easy — Zone 2, conversational pace.\n\nHow are you feeling?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
];

export default function ChatClient({ user }: ChatClientProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput("");
    setIsTyping(true);

    try {
      // Call the real API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback to mock responses if API fails
      const responses: Record<string, string> = {
        "tired": "I hear you. Looking at your data, your HRV has actually been trending down over the past 3 days, and your sleep was only 6 hours last night.\n\nLet's swap today's workout. Instead of the tempo run, do an easy 30-minute jog — or even just a walk if you prefer. Your body is asking for recovery.\n\nI've updated your plan. The tempo will move to Saturday when you should be fresher. Sound good?",
        "swap": "Of course! What day were you thinking of swapping to?\n\nLooking at your week:\n• Thursday: Strength (could move)\n• Friday: Rest day\n• Saturday: Long run (important to keep)\n• Sunday: Recovery\n\nI'd suggest moving tomorrow's session to Thursday and making Wednesday a rest day instead. That gives you back-to-back recovery before your long run.",
        "yesterday": "Your tempo run yesterday was solid! 📊\n\n**The numbers:**\n• Total: 45 minutes, 8.2km\n• Tempo section: 20 min @ 4:52/km (target was 5:00/km)\n• Avg HR: 162 bpm (right in your tempo zone)\n\n**What went well:**\nYou negative split the tempo — your last 5 min were your fastest. That's great pacing discipline.\n\n**One thing to watch:**\nYour HR was slightly elevated in the warmup. Could be residual fatigue from Monday's intervals. We'll keep today easy.",
        "focus": "This week's focus: **Building aerobic base while maintaining speed.**\n\nHere's the breakdown:\n• Monday ✓ - Intervals (speed stimulus)\n• Tuesday ✓ - Tempo (lactate threshold)\n• Today - Easy recovery (let adaptations happen)\n• Thursday - Strength\n• Friday - Rest\n• Saturday - Long run (your key session this week)\n\nThe long run Saturday is the most important workout. Everything else supports it. Don't sacrifice Saturday's quality by going too hard earlier in the week.",
        "explain": "Today's intervals are designed to improve your VO2max — your body's ability to use oxygen at high intensities.\n\n**The workout:**\n5 x 3 minutes @ 5K effort, 2 min recovery jog\n\n**How to execute:**\n• Warmup: 15 min easy + 4 strides\n• Each interval should feel HARD but controlled\n• You should be able to complete all 5 at similar pace\n• If you're dying by rep 3, you started too fast\n• Recovery jog should be genuinely easy\n\n**Why it matters:**\nThese intervals stress your cardiovascular system just enough to trigger adaptation, without destroying you for the rest of the week.",
      };

      let response = "I'm here to help! Could you tell me more about what's on your mind? I can help with workout modifications, analyze your recent training, or answer questions about your plan.";
      
      const lowerInput = messageText.toLowerCase();
      if (lowerInput.includes("tired") || lowerInput.includes("fatigue")) {
        response = responses.tired;
      } else if (lowerInput.includes("swap") || lowerInput.includes("move") || lowerInput.includes("reschedule")) {
        response = responses.swap;
      } else if (lowerInput.includes("yesterday") || lowerInput.includes("how did")) {
        response = responses.yesterday;
      } else if (lowerInput.includes("focus") || lowerInput.includes("this week")) {
        response = responses.focus;
      } else if (lowerInput.includes("explain") || lowerInput.includes("interval")) {
        response = responses.explain;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-orange-600/5 via-black to-red-900/5" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.01)_1px,transparent_1px),linear_gradient(90deg,rgba(255,255,255,.01)_1px,transparent_1px)] bg-[size:72px_72px]" />

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
            <NavItem href="/calendar" icon="📅" label="Calendar" />
            <NavItem href="/chat" icon="💬" label="Chat" active />
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

      {/* Main chat area */}
      <main className={`relative flex-1 flex flex-col transition-all ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-bold text-sm">
                  P
                </div>
                <div>
                  <h1 className="font-semibold">Coach</h1>
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Always available
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${
                  msg.role === 'assistant' 
                    ? 'bg-gradient-to-br from-orange-500 to-red-600' 
                    : 'bg-zinc-700'
                }`}>
                  {msg.role === 'assistant' ? 'P' : user.email?.[0].toUpperCase()}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block p-4 rounded-2xl ${
                    msg.role === 'assistant' 
                      ? 'bg-white/5 rounded-tl-none text-left' 
                      : 'bg-gradient-to-r from-orange-500 to-red-600 rounded-tr-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-bold text-sm">
                  P
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-none p-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggested prompts */}
        {messages.length <= 2 && (
          <div className="px-6 pb-4">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-zinc-500 mb-3">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="sticky bottom-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Message your coach..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-600"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="h-12 px-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-50 border-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
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
