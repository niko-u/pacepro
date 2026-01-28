"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface SettingsClientProps {
  user: User;
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'subscription' | 'notifications'>('profile');
  
  const [profile, setProfile] = useState({
    name: user.user_metadata?.full_name || "",
    email: user.email || "",
  });

  const [integrations, setIntegrations] = useState({
    strava: { connected: true, username: "athlete_niko", lastSync: "2 hours ago" },
    whoop: { connected: true, username: "niko@example.com", lastSync: "1 hour ago" },
    garmin: { connected: false, username: "", lastSync: "" },
    apple: { connected: false, username: "", lastSync: "" },
  });

  const subscription = {
    plan: "Pro",
    price: "$50/month",
    nextBilling: "Feb 28, 2026",
    status: "active",
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      {/* Background - subtle in light, gradient in dark */}
      <div className="fixed inset-0 bg-zinc-50 dark:bg-gradient-to-br dark:from-orange-600/5 dark:via-black dark:to-red-900/5" />

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
            <NavItem href="/calendar" icon="📅" label="Calendar" />
            <NavItem href="/chat" icon="💬" label="Chat" />
            <NavItem href="/analytics" icon="📊" label="Analytics" />
            <NavItem href="/settings" icon="⚙️" label="Settings" active />
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
              <h1 className="text-lg font-semibold">Settings</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b border-zinc-200 dark:border-white/10 pb-4">
              {[
                { id: 'profile', label: 'Profile', icon: '👤' },
                { id: 'integrations', label: 'Integrations', icon: '🔗' },
                { id: 'subscription', label: 'Subscription', icon: '💳' },
                { id: 'notifications', label: 'Notifications', icon: '🔔' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold mb-6">Profile Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-2">Full Name</label>
                      <Input
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="h-12 bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-2">Email</label>
                      <Input
                        value={profile.email}
                        disabled
                        className="h-12 bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-500"
                      />
                      <p className="text-xs text-zinc-500 mt-1">Email cannot be changed</p>
                    </div>
                  </div>
                  <Button className="mt-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 text-white">
                    Save Changes
                  </Button>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold mb-4">Training Preferences</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">Update your training preferences and goals.</p>
                  <Button variant="outline" className="border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5">
                    Edit Training Profile
                  </Button>
                </div>

                <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-6">
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">Permanently delete your account and all data.</p>
                  <Button variant="outline" className="border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10">
                    Delete Account
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  Connect your fitness apps to sync workouts and recovery data automatically.
                </p>

                <IntegrationCard
                  name="Strava"
                  icon="🔶"
                  description="Sync completed workouts automatically"
                  connected={integrations.strava.connected}
                  username={integrations.strava.username}
                  lastSync={integrations.strava.lastSync}
                  onConnect={() => setIntegrations({ ...integrations, strava: { ...integrations.strava, connected: true } })}
                  onDisconnect={() => setIntegrations({ ...integrations, strava: { ...integrations.strava, connected: false } })}
                />

                <IntegrationCard
                  name="WHOOP"
                  icon="⚫"
                  description="Recovery scores, HRV, and sleep data"
                  connected={integrations.whoop.connected}
                  username={integrations.whoop.username}
                  lastSync={integrations.whoop.lastSync}
                  onConnect={() => setIntegrations({ ...integrations, whoop: { ...integrations.whoop, connected: true } })}
                  onDisconnect={() => setIntegrations({ ...integrations, whoop: { ...integrations.whoop, connected: false } })}
                />

                <IntegrationCard
                  name="Garmin Connect"
                  icon="🔵"
                  description="Training status, body battery, and sleep"
                  connected={integrations.garmin.connected}
                  username={integrations.garmin.username}
                  lastSync={integrations.garmin.lastSync}
                  onConnect={() => setIntegrations({ ...integrations, garmin: { ...integrations.garmin, connected: true } })}
                  onDisconnect={() => setIntegrations({ ...integrations, garmin: { ...integrations.garmin, connected: false } })}
                />

                <IntegrationCard
                  name="Apple Health"
                  icon="❤️"
                  description="Heart rate, workouts, and health data"
                  connected={integrations.apple.connected}
                  username={integrations.apple.username}
                  lastSync={integrations.apple.lastSync}
                  onConnect={() => setIntegrations({ ...integrations, apple: { ...integrations.apple, connected: true } })}
                  onDisconnect={() => setIntegrations({ ...integrations, apple: { ...integrations.apple, connected: false } })}
                  note="Available on iOS app only"
                />
              </motion.div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-orange-300 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{subscription.plan} Plan</h3>
                      <p className="text-zinc-600 dark:text-zinc-400">{subscription.price}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-sm">
                      {subscription.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Next billing date: {subscription.nextBilling}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold mb-4">Plan Features</h3>
                  <ul className="space-y-3">
                    {[
                      "Unlimited coach chat",
                      "Post-workout analysis on every session",
                      "Recovery-based plan adjustments",
                      "Personalized periodized training plan",
                      "Strava, WHOOP, Garmin integration",
                      "Race-day protocols and taper",
                      "Weekly progress summaries",
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold mb-4">Billing</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Update payment method
                    </Button>
                    <Button variant="outline" className="w-full justify-start border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View billing history
                    </Button>
                    <Button variant="outline" className="w-full justify-start border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500">
                      Cancel subscription
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6"
              >
                <h3 className="font-semibold mb-6">Notification Preferences</h3>
                <div className="space-y-4">
                  <NotificationToggle
                    label="Daily workout reminders"
                    description="Get reminded about today's scheduled workout"
                    defaultChecked
                  />
                  <NotificationToggle
                    label="Post-workout analysis"
                    description="Receive analysis after completing a workout"
                    defaultChecked
                  />
                  <NotificationToggle
                    label="Weekly summaries"
                    description="Get a weekly training summary every Monday"
                    defaultChecked
                  />
                  <NotificationToggle
                    label="Recovery alerts"
                    description="Get notified when your recovery is low"
                    defaultChecked
                  />
                  <NotificationToggle
                    label="Marketing emails"
                    description="Tips, product updates, and promotions"
                  />
                </div>
              </motion.div>
            )}
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
          ? 'bg-orange-100 dark:bg-gradient-to-r dark:from-orange-500/10 dark:to-red-500/10 text-orange-700 dark:text-white border border-orange-200 dark:border-orange-500/20' 
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

function IntegrationCard({ 
  name, icon, description, connected, username, lastSync, onConnect, onDisconnect, note 
}: { 
  name: string; 
  icon: string; 
  description: string; 
  connected: boolean;
  username: string;
  lastSync: string;
  onConnect: () => void;
  onDisconnect: () => void;
  note?: string;
}) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      connected 
        ? 'border-green-300 dark:border-green-500/30 bg-green-50 dark:bg-green-500/5' 
        : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-sm text-zinc-500">{description}</div>
            {connected && (
              <div className="text-xs text-zinc-500 mt-1">
                {username} • Last sync: {lastSync}
              </div>
            )}
            {note && !connected && (
              <div className="text-xs text-zinc-500 mt-1">{note}</div>
            )}
          </div>
        </div>
        {connected ? (
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-sm">
              Connected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="border-zinc-300 dark:border-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={onConnect}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0 text-white"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

function NotificationToggle({ label, description, defaultChecked = false }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-white/5 last:border-0">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-zinc-500">{description}</div>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'left-7' : 'left-1'
        }`} />
      </button>
    </div>
  );
}
