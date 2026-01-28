import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="font-semibold text-lg">PacePro</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-sm">{user.email}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Welcome back! 👋</h1>
        <p className="text-zinc-400 mb-12">Here's your training for today.</p>

        {/* Today's Workout Card */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-800/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-500">Today's Workout</span>
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Run</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Easy Recovery Run</h2>
              <p className="text-zinc-400 mb-6">45 minutes at conversational pace. Keep heart rate in Zone 2.</p>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-zinc-900 rounded-xl">
                  <p className="text-2xl font-bold">45</p>
                  <p className="text-xs text-zinc-500">minutes</p>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-xl">
                  <p className="text-2xl font-bold">Z2</p>
                  <p className="text-xs text-zinc-500">target zone</p>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-xl">
                  <p className="text-2xl font-bold">~8k</p>
                  <p className="text-xs text-zinc-500">distance</p>
                </div>
              </div>

              <button className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium rounded-xl">
                Start Workout
              </button>
            </div>

            {/* Week Overview */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-800/50">
              <h3 className="font-semibold mb-4">This Week</h3>
              <div className="grid grid-cols-7 gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                  <div key={day} className="text-center">
                    <p className="text-xs text-zinc-500 mb-2">{day}</p>
                    <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center ${
                      i === 0 ? "bg-orange-500/20 border border-orange-500/50" : "bg-zinc-900"
                    }`}>
                      {i === 0 && "🏃"}
                      {i === 1 && "🏊"}
                      {i === 2 && "🚴"}
                      {i === 3 && "💪"}
                      {i === 4 && "🏃"}
                      {i === 5 && "🚴"}
                      {i === 6 && "😴"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-800/50 h-fit">
            <h3 className="font-semibold mb-4">Chat with Coach</h3>
            <div className="space-y-4 mb-4 h-64 overflow-y-auto">
              <div className="p-3 bg-zinc-900 rounded-xl text-sm">
                <p className="text-zinc-400">Hey! Ready for your easy run today? Remember to keep it conversational — if you can't chat, you're going too fast.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask your coach..."
                className="flex-1 h-10 px-4 bg-zinc-900 border border-zinc-700 rounded-xl text-sm focus:outline-none focus:border-orange-500"
              />
              <button className="h-10 px-4 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-medium">
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
