import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="font-semibold text-lg">PacePro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-white">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/10">
            AI-Powered Training
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent">
            Your personal triathlon coach, powered by AI
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Hyper-personalized training plans that adapt to your life. 
            Train smarter, recover better, race faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-lg px-8 h-14 border-0">
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-lg px-8 h-14">
              See How It Works
            </Button>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            No credit card required · 14-day free trial
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to reach the finish line
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              From your first sprint to Ironman — adaptive plans that grow with you.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🧠"
              title="AI-Generated Plans"
              description="Tell us your goal race and current fitness. We'll create a periodized plan tailored to your schedule and abilities."
            />
            <FeatureCard
              icon="💬"
              title="Chat With Your Coach"
              description="Ask questions, request modifications, get motivation. Your AI coach is available 24/7 and knows your entire training history."
            />
            <FeatureCard
              icon="🔄"
              title="Adaptive Training"
              description="Missed a workout? Feeling fatigued? Your plan automatically adjusts based on life's curveballs and your recovery data."
            />
            <FeatureCard
              icon="📊"
              title="Smart Analytics"
              description="Track your progress across all three disciplines. See your fitness trends and predict your race-day performance."
            />
            <FeatureCard
              icon="🔗"
              title="Strava & WHOOP Sync"
              description="Connect your devices and we'll auto-import your workouts and recovery metrics. No manual logging needed."
            />
            <FeatureCard
              icon="🎯"
              title="Race-Day Ready"
              description="Taper protocols, nutrition guidance, and mental prep. We'll make sure you're peaking on race day."
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 bg-zinc-900/50 border-y border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-zinc-500 uppercase tracking-wider text-sm mb-8">
            Trusted by athletes training for
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-zinc-400 text-lg">
            <span>Ironman 70.3</span>
            <span className="text-zinc-700">·</span>
            <span>Ironman</span>
            <span className="text-zinc-700">·</span>
            <span>Olympic Tri</span>
            <span className="text-zinc-700">·</span>
            <span>Sprint Tri</span>
            <span className="text-zinc-700">·</span>
            <span>Marathon</span>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple pricing, serious results
          </h2>
          <p className="text-zinc-400 text-lg mb-12">
            Start free. Upgrade when you're ready to go pro.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-left">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <p className="text-3xl font-bold mb-4">$0<span className="text-zinc-500 text-lg font-normal">/month</span></p>
              <ul className="space-y-3 text-zinc-400 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Basic training plan
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 5 coach chats/month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Strava sync
                </li>
              </ul>
              <Button variant="outline" className="w-full border-zinc-700">
                Get Started
              </Button>
            </div>
            
            <div className="p-8 rounded-2xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-transparent text-left relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white border-0">
                Most Popular
              </Badge>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <p className="text-3xl font-bold mb-4">$19<span className="text-zinc-500 text-lg font-normal">/month</span></p>
              <ul className="space-y-3 text-zinc-400 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Fully adaptive plans
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Unlimited coach chat
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> WHOOP integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Advanced analytics
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Race-day protocols
                </li>
              </ul>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to train smarter?
          </h2>
          <p className="text-zinc-400 text-lg mb-8">
            Join thousands of athletes who've upgraded their training with AI.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-lg px-8 h-14 border-0">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center font-bold text-xs">
              P
            </div>
            <span className="font-semibold">PacePro</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © 2025 PacePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
