"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const races = [
  { id: "sprint", name: "Sprint Triathlon", distance: "750m / 20km / 5km", icon: "🏃" },
  { id: "olympic", name: "Olympic Triathlon", distance: "1.5km / 40km / 10km", icon: "🥇" },
  { id: "half", name: "Ironman 70.3", distance: "1.9km / 90km / 21km", icon: "🔥" },
  { id: "full", name: "Ironman", distance: "3.8km / 180km / 42km", icon: "🦾" },
  { id: "marathon", name: "Marathon", distance: "42.2km", icon: "🏃‍♂️" },
  { id: "halfmarathon", name: "Half Marathon", distance: "21.1km", icon: "🎯" },
];

const experienceLevels = [
  { id: "beginner", name: "Beginner", desc: "New to endurance sports or first race" },
  { id: "intermediate", name: "Intermediate", desc: "Completed a few races, building consistency" },
  { id: "advanced", name: "Advanced", desc: "Racing regularly, focused on improvement" },
  { id: "elite", name: "Elite", desc: "Competitive age-grouper or professional" },
];

const weeklyHours = [
  { id: "5-7", name: "5-7 hours", desc: "Busy schedule, efficient training" },
  { id: "8-10", name: "8-10 hours", desc: "Balanced commitment" },
  { id: "11-14", name: "11-14 hours", desc: "Serious training block" },
  { id: "15+", name: "15+ hours", desc: "Full commitment" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    raceType: "",
    raceDate: "",
    experience: "",
    weeklyHours: "",
  });
  const router = useRouter();
  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // TODO: Save to database and generate plan
      router.push("/dashboard");
    }
  };

  const canProgress = () => {
    switch (step) {
      case 1: return formData.raceType !== "";
      case 2: return formData.raceDate !== "";
      case 3: return formData.experience !== "";
      case 4: return formData.weeklyHours !== "";
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-orange-600/10 via-black to-red-900/10" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-50" />
                <div className="relative w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-sm">
                  P
                </div>
              </div>
              <span className="font-semibold text-lg">PacePro</span>
            </div>
            <span className="text-sm text-zinc-500">Step {step} of {totalSteps}</span>
          </div>
        </header>

        {/* Progress bar */}
        <div className="px-6">
          <div className="max-w-2xl mx-auto">
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-red-600"
                initial={{ width: 0 }}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepWrapper key="step1">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    What's your goal race?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    We'll build your training plan around this target.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {races.map((race) => (
                      <button
                        key={race.id}
                        onClick={() => setFormData({ ...formData, raceType: race.id })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.raceType === race.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{race.icon}</span>
                          <div>
                            <div className="font-medium">{race.name}</div>
                            <div className="text-sm text-zinc-500">{race.distance}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </StepWrapper>
              )}

              {step === 2 && (
                <StepWrapper key="step2">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    When's your race?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    This helps us create proper periodization and taper.
                  </p>
                  <div className="space-y-4">
                    <input
                      type="date"
                      value={formData.raceDate}
                      onChange={(e) => setFormData({ ...formData, raceDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full h-14 px-4 rounded-xl bg-white/5 border border-white/10 text-white focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 [color-scheme:dark]"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[8, 12, 16, 20, 24].map((weeks) => {
                        const date = new Date();
                        date.setDate(date.getDate() + weeks * 7);
                        const dateStr = date.toISOString().split('T')[0];
                        return (
                          <button
                            key={weeks}
                            onClick={() => setFormData({ ...formData, raceDate: dateStr })}
                            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            {weeks} weeks
                          </button>
                        );
                      })}
                    </div>
                    {formData.raceDate && (
                      <p className="text-sm text-zinc-500">
                        That's {Math.ceil((new Date(formData.raceDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks of training
                      </p>
                    )}
                  </div>
                </StepWrapper>
              )}

              {step === 3 && (
                <StepWrapper key="step3">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    What's your experience level?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    This helps us calibrate workout intensity and complexity.
                  </p>
                  <div className="space-y-3">
                    {experienceLevels.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setFormData({ ...formData, experience: level.id })}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.experience === level.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                        }`}
                      >
                        <div className="font-medium mb-1">{level.name}</div>
                        <div className="text-sm text-zinc-500">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </StepWrapper>
              )}

              {step === 4 && (
                <StepWrapper key="step4">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    How much time can you train?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    Be realistic — we'll optimize every hour you give us.
                  </p>
                  <div className="space-y-3">
                    {weeklyHours.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setFormData({ ...formData, weeklyHours: option.id })}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.weeklyHours === option.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                        }`}
                      >
                        <div className="font-medium mb-1">{option.name}</div>
                        <div className="text-sm text-zinc-500">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </StepWrapper>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6">
          <div className="max-w-2xl mx-auto flex gap-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="h-12 px-6 border-white/10 bg-white/5 hover:bg-white/10"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProgress()}
              className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg shadow-orange-500/20"
            >
              {step === totalSteps ? (
                <span className="flex items-center gap-2">
                  Generate my plan
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
