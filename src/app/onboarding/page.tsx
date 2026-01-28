"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-xl mx-auto mb-6">
            P
          </div>
          <h1 className="text-2xl font-bold mb-2">Let's set up your training</h1>
          <p className="text-zinc-400">Step {step} of 4</p>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">What's your goal race?</h2>
              <div className="grid grid-cols-2 gap-3">
                {["Sprint Triathlon", "Olympic Triathlon", "Ironman 70.3", "Ironman", "Marathon", "Half Marathon"].map((race) => (
                  <button
                    key={race}
                    className="p-4 text-left border border-zinc-700 rounded-xl hover:border-orange-500 hover:bg-orange-500/10 transition-colors"
                  >
                    {race}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">When is your race?</h2>
              <input 
                type="date"
                className="w-full h-12 px-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">What's your experience level?</h2>
              <div className="space-y-3">
                {[
                  { level: "Beginner", desc: "New to triathlon/endurance sports" },
                  { level: "Intermediate", desc: "Completed a few races" },
                  { level: "Advanced", desc: "Racing regularly, looking to improve" },
                  { level: "Elite", desc: "Competitive age-grouper or pro" },
                ].map(({ level, desc }) => (
                  <button
                    key={level}
                    className="w-full p-4 text-left border border-zinc-700 rounded-xl hover:border-orange-500 hover:bg-orange-500/10 transition-colors"
                  >
                    <p className="font-medium">{level}</p>
                    <p className="text-sm text-zinc-400">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">How many hours can you train per week?</h2>
              <div className="grid grid-cols-3 gap-3">
                {["5-7 hrs", "8-10 hrs", "11-14 hrs", "15-18 hrs", "19-22 hrs", "23+ hrs"].map((hours) => (
                  <button
                    key={hours}
                    className="p-4 border border-zinc-700 rounded-xl hover:border-orange-500 hover:bg-orange-500/10 transition-colors"
                  >
                    {hours}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-12 border-zinc-700"
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => {
                if (step < 4) {
                  setStep(step + 1);
                } else {
                  router.push("/dashboard");
                }
              }}
              className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0"
            >
              {step < 4 ? "Continue" : "Generate My Plan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
