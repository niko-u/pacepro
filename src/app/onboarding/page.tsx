"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Race types - Running + Triathlon
const raceTypes = [
  // Running
  { id: "5k", name: "5K", distance: "5km", icon: "💨", category: "running" },
  { id: "10k", name: "10K", distance: "10km", icon: "🏃‍♂️", category: "running" },
  { id: "half-marathon", name: "Half Marathon", distance: "21.1km", icon: "🎯", category: "running" },
  { id: "marathon", name: "Marathon", distance: "42.2km", icon: "🏃", category: "running" },
  { id: "ultra", name: "Ultramarathon", distance: "50K+", icon: "🏔️", category: "running" },
  // Triathlon  
  { id: "sprint-tri", name: "Sprint Triathlon", distance: "750m / 20km / 5km", icon: "⚡", category: "triathlon" },
  { id: "olympic-tri", name: "Olympic Triathlon", distance: "1.5km / 40km / 10km", icon: "🥇", category: "triathlon" },
  { id: "half-ironman", name: "Ironman 70.3", distance: "1.9km / 90km / 21.1km", icon: "🔥", category: "triathlon" },
  { id: "ironman", name: "Ironman", distance: "3.8km / 180km / 42.2km", icon: "🦾", category: "triathlon" },
];

// Mock race database (would be real API in production)
const popularRaces = [
  { id: "im-texas", name: "Ironman Texas", date: "2025-04-26", location: "The Woodlands, TX", type: "ironman" },
  { id: "im-703-waco", name: "Ironman 70.3 Waco", date: "2025-10-19", location: "Waco, TX", type: "half-ironman" },
  { id: "boston-marathon", name: "Boston Marathon", date: "2025-04-21", location: "Boston, MA", type: "marathon" },
  { id: "chicago-marathon", name: "Chicago Marathon", date: "2025-10-12", location: "Chicago, IL", type: "marathon" },
  { id: "nyc-marathon", name: "NYC Marathon", date: "2025-11-02", location: "New York, NY", type: "marathon" },
  { id: "berlin-marathon", name: "Berlin Marathon", date: "2025-09-28", location: "Berlin, Germany", type: "marathon" },
  { id: "im-703-austin", name: "Ironman 70.3 Austin", date: "2025-05-18", location: "Austin, TX", type: "half-ironman" },
  { id: "im-florida", name: "Ironman Florida", date: "2025-11-01", location: "Panama City Beach, FL", type: "ironman" },
  { id: "im-arizona", name: "Ironman Arizona", date: "2025-11-16", location: "Tempe, AZ", type: "ironman" },
];

const goals = [
  { id: "finish", name: "Finish Strong", desc: "Complete the race feeling good" },
  { id: "pr", name: "Personal Record", desc: "Beat my previous best time" },
  { id: "time-goal", name: "Specific Time", desc: "Hit a target finish time" },
  { id: "podium", name: "Podium / AG Win", desc: "Compete for age group placement" },
  { id: "qualify", name: "Qualify", desc: "Qualify for Worlds or another event" },
];

const experienceLevels = [
  { id: "beginner", name: "Beginner", desc: "New to endurance sports or your first race of this type" },
  { id: "intermediate", name: "Intermediate", desc: "Completed a few races, building consistency" },
  { id: "advanced", name: "Advanced", desc: "Racing regularly, focused on performance" },
  { id: "elite", name: "Elite", desc: "Competitive age-grouper or professional" },
];

const weeklyHours = [
  { id: "5-7", name: "5-7 hours", desc: "Busy schedule, efficient training" },
  { id: "8-10", name: "8-10 hours", desc: "Balanced commitment" },
  { id: "11-14", name: "11-14 hours", desc: "Serious training block" },
  { id: "15-18", name: "15-18 hours", desc: "High volume training" },
  { id: "19+", name: "19+ hours", desc: "Full commitment" },
];

const workoutPreferences = [
  { id: "intervals", name: "Intervals", icon: "⚡" },
  { id: "long-steady", name: "Long Steady", icon: "🛤️" },
  { id: "tempo", name: "Tempo Work", icon: "🔥" },
  { id: "hills", name: "Hill Training", icon: "⛰️" },
  { id: "bricks", name: "Brick Workouts", icon: "🧱" },
  { id: "strength", name: "Strength", icon: "💪" },
  { id: "recovery", name: "Easy/Recovery", icon: "🧘" },
  { id: "group", name: "Group Workouts", icon: "👥" },
];

const trainingDays = [
  { id: "mon", name: "Mon" },
  { id: "tue", name: "Tue" },
  { id: "wed", name: "Wed" },
  { id: "thu", name: "Thu" },
  { id: "fri", name: "Fri" },
  { id: "sat", name: "Sat" },
  { id: "sun", name: "Sun" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [raceSearch, setRaceSearch] = useState("");
  const [formData, setFormData] = useState({
    raceType: "",
    selectedRace: null as typeof popularRaces[0] | null,
    customRaceName: "",
    customRaceDate: "",
    customRaceLocation: "",
    goal: "",
    targetTime: "",
    experience: "",
    weeklyHours: "",
    preferredDays: ["mon", "tue", "wed", "thu", "fri", "sat"] as string[],
    workoutLikes: [] as string[],
    workoutDislikes: [] as string[],
    // Training personality (1-5 scale)
    pushTolerance: 3, // Conservative ↔ Aggressive
    recoveryNeeds: 3, // Low ↔ High
    scheduleStyle: 3, // Strict ↔ Flexible
    feedbackStyle: 3, // Simple ↔ Data-heavy
    // Current fitness
    currentVolume: "",
    recentRaces: "",
    injuries: "",
    // Integrations
    stravaConnected: false,
    whoopConnected: false,
    garminConnected: false,
  });
  const router = useRouter();
  
  const totalSteps = 9; // Intro, Race Type, Find Race, Goals, Experience, Schedule, Preferences, Personality, Integrations

  const filteredRaces = popularRaces.filter(race => 
    race.type === formData.raceType &&
    (race.name.toLowerCase().includes(raceSearch.toLowerCase()) ||
     race.location.toLowerCase().includes(raceSearch.toLowerCase()))
  );

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Final step - generate plan
      setGeneratingPlan(true);
      
      // TODO: Save profile to Supabase and generate plan
      // Simulate plan generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      router.push("/calendar");
    }
  };

  const canProgress = () => {
    switch (step) {
      case 0: return true; // Intro
      case 1: return formData.raceType !== ""; // Race type
      case 2: return formData.selectedRace !== null || (formData.customRaceName && formData.customRaceDate); // Find race
      case 3: return formData.goal !== ""; // Goals
      case 4: return formData.experience !== ""; // Experience
      case 5: return formData.weeklyHours !== "" && formData.preferredDays.length > 0; // Schedule
      case 6: return true; // Preferences (optional)
      case 7: return true; // Personality (has defaults)
      case 8: return true; // Integrations (optional)
      default: return false;
    }
  };

  const toggleDay = (dayId: string) => {
    setFormData(prev => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(dayId)
        ? prev.preferredDays.filter(d => d !== dayId)
        : [...prev.preferredDays, dayId]
    }));
  };

  const toggleWorkoutPref = (id: string, type: 'likes' | 'dislikes') => {
    const otherType = type === 'likes' ? 'workoutDislikes' : 'workoutLikes';
    const currentType = type === 'likes' ? 'workoutLikes' : 'workoutDislikes';
    
    setFormData(prev => ({
      ...prev,
      [otherType]: prev[otherType].filter((w: string) => w !== id),
      [currentType]: prev[currentType].includes(id)
        ? prev[currentType].filter((w: string) => w !== id)
        : [...prev[currentType], id]
    }));
  };

  // Show generating screen
  if (generatingPlan) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-orange-600/10 via-black to-red-900/10" />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-md px-6"
        >
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
              <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-4">Building your training plan...</h1>
          <p className="text-zinc-400 mb-8">
            Our AI is analyzing your goals, schedule, and preferences to create a personalized plan.
          </p>
          
          <div className="space-y-3 text-left">
            <LoadingStep text="Analyzing race requirements" done />
            <LoadingStep text="Calculating training zones" done />
            <LoadingStep text="Building periodization" active />
            <LoadingStep text="Generating workouts" />
            <LoadingStep text="Optimizing for your schedule" />
          </div>
        </motion.div>
      </div>
    );
  }

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
            {step > 0 && <span className="text-sm text-zinc-500">Step {step} of {totalSteps - 1}</span>}
          </div>
        </header>

        {/* Progress bar */}
        {step > 0 && (
          <div className="px-6">
            <div className="max-w-2xl mx-auto">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {/* Step 0: Intro */}
              {step === 0 && (
                <StepWrapper key="intro">
                  <div className="text-center">
                    <div className="text-6xl mb-6">🏊‍♂️🚴‍♂️🏃‍♂️</div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                      Let's build your perfect plan
                    </h1>
                    <p className="text-lg text-zinc-400 mb-8 max-w-md mx-auto">
                      Answer a few questions to help your AI coach understand you. 
                      <span className="text-zinc-300"> Don't worry about getting everything perfect</span> — 
                      your coach will learn and adapt as you train together.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Takes about 3 minutes
                    </div>
                  </div>
                </StepWrapper>
              )}

              {/* Step 1: Race Type */}
              {step === 1 && (
                <StepWrapper key="race-type">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    What type of race are you training for?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    Select your event type — we'll find your specific race next.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {raceTypes.map((race) => (
                      <button
                        key={race.id}
                        onClick={() => setFormData({ ...formData, raceType: race.id, selectedRace: null })}
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

              {/* Step 2: Find Race */}
              {step === 2 && (
                <StepWrapper key="find-race">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Find your race
                  </h1>
                  <p className="text-zinc-400 mb-6">
                    Search for your event or enter it manually.
                  </p>

                  <div className="relative mb-6">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <Input
                      type="text"
                      placeholder="Search races..."
                      value={raceSearch}
                      onChange={(e) => setRaceSearch(e.target.value)}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-orange-500/50"
                    />
                  </div>

                  {/* Race results */}
                  <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                    {filteredRaces.map((race) => (
                      <button
                        key={race.id}
                        onClick={() => setFormData({ ...formData, selectedRace: race, customRaceName: "", customRaceDate: "" })}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.selectedRace?.id === race.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-medium">{race.name}</div>
                        <div className="text-sm text-zinc-500">
                          {new Date(race.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {race.location}
                        </div>
                      </button>
                    ))}
                    {filteredRaces.length === 0 && raceSearch && (
                      <p className="text-center text-zinc-500 py-4">No races found matching "{raceSearch}"</p>
                    )}
                  </div>

                  {/* Manual entry */}
                  <div className="border-t border-white/10 pt-6">
                    <p className="text-sm text-zinc-400 mb-4">Can't find your race? Enter it manually:</p>
                    <div className="space-y-3">
                      <Input
                        type="text"
                        placeholder="Race name"
                        value={formData.customRaceName}
                        onChange={(e) => setFormData({ ...formData, customRaceName: e.target.value, selectedRace: null })}
                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-orange-500/50"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={formData.customRaceDate}
                          onChange={(e) => setFormData({ ...formData, customRaceDate: e.target.value, selectedRace: null })}
                          className="h-12 bg-white/5 border-white/10 text-white [color-scheme:dark] focus:border-orange-500/50"
                        />
                        <Input
                          type="text"
                          placeholder="Location (optional)"
                          value={formData.customRaceLocation}
                          onChange={(e) => setFormData({ ...formData, customRaceLocation: e.target.value })}
                          className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </StepWrapper>
              )}

              {/* Step 3: Goals */}
              {step === 3 && (
                <StepWrapper key="goals">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    What's your goal?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    This helps us calibrate your training intensity.
                  </p>
                  <div className="space-y-3">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => setFormData({ ...formData, goal: goal.id })}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.goal === goal.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-medium">{goal.name}</div>
                        <div className="text-sm text-zinc-500">{goal.desc}</div>
                      </button>
                    ))}
                  </div>
                  {formData.goal === 'time-goal' && (
                    <div className="mt-4">
                      <Input
                        type="text"
                        placeholder="Target time (e.g., 4:30:00)"
                        value={formData.targetTime}
                        onChange={(e) => setFormData({ ...formData, targetTime: e.target.value })}
                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-orange-500/50"
                      />
                    </div>
                  )}
                </StepWrapper>
              )}

              {/* Step 4: Experience */}
              {step === 4 && (
                <StepWrapper key="experience">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    What's your experience level?
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    For {raceTypes.find(r => r.id === formData.raceType)?.name || 'this race type'} specifically.
                  </p>
                  <div className="space-y-3">
                    {experienceLevels.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setFormData({ ...formData, experience: level.id })}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.experience === level.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-medium">{level.name}</div>
                        <div className="text-sm text-zinc-500">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </StepWrapper>
              )}

              {/* Step 5: Schedule */}
              {step === 5 && (
                <StepWrapper key="schedule">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Your training schedule
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    How much time can you commit?
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-3">Weekly training hours</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {weeklyHours.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setFormData({ ...formData, weeklyHours: option.id })}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              formData.weeklyHours === option.id
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="font-medium text-sm">{option.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-3">Preferred training days</label>
                      <div className="flex gap-2">
                        {trainingDays.map((day) => (
                          <button
                            key={day.id}
                            onClick={() => toggleDay(day.id)}
                            className={`flex-1 py-3 rounded-xl border text-center transition-all ${
                              formData.preferredDays.includes(day.id)
                                ? "border-orange-500 bg-orange-500/10 text-white"
                                : "border-white/10 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.05]"
                            }`}
                          >
                            {day.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </StepWrapper>
              )}

              {/* Step 6: Workout Preferences */}
              {step === 6 && (
                <StepWrapper key="preferences">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Workout preferences
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    What do you enjoy? What do you dread? (Optional but helps personalization)
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {workoutPreferences.map((workout) => {
                      const isLiked = formData.workoutLikes.includes(workout.id);
                      const isDisliked = formData.workoutDislikes.includes(workout.id);
                      return (
                        <div key={workout.id} className="relative">
                          <div className={`p-4 rounded-xl border text-center transition-all ${
                            isLiked ? "border-green-500 bg-green-500/10" :
                            isDisliked ? "border-red-500 bg-red-500/10" :
                            "border-white/10 bg-white/[0.02]"
                          }`}>
                            <div className="text-2xl mb-2">{workout.icon}</div>
                            <div className="text-sm font-medium mb-3">{workout.name}</div>
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => toggleWorkoutPref(workout.id, 'likes')}
                                className={`p-1.5 rounded-lg transition-all ${isLiked ? "bg-green-500 text-white" : "bg-white/5 text-zinc-500 hover:bg-white/10"}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleWorkoutPref(workout.id, 'dislikes')}
                                className={`p-1.5 rounded-lg transition-all ${isDisliked ? "bg-red-500 text-white" : "bg-white/5 text-zinc-500 hover:bg-white/10"}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </StepWrapper>
              )}

              {/* Step 7: Training Personality */}
              {step === 7 && (
                <StepWrapper key="personality">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Training personality
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    Help us understand how you like to train.
                  </p>
                  
                  <div className="space-y-8">
                    <SliderQuestion
                      label="Training intensity preference"
                      leftLabel="Conservative"
                      rightLabel="Aggressive"
                      value={formData.pushTolerance}
                      onChange={(v) => setFormData({ ...formData, pushTolerance: v })}
                    />
                    <SliderQuestion
                      label="Recovery needs"
                      leftLabel="I recover fast"
                      rightLabel="I need more rest"
                      value={formData.recoveryNeeds}
                      onChange={(v) => setFormData({ ...formData, recoveryNeeds: v })}
                    />
                    <SliderQuestion
                      label="Schedule flexibility"
                      leftLabel="Strict plan"
                      rightLabel="Flexible / adaptive"
                      value={formData.scheduleStyle}
                      onChange={(v) => setFormData({ ...formData, scheduleStyle: v })}
                    />
                    <SliderQuestion
                      label="Feedback style"
                      leftLabel="Keep it simple"
                      rightLabel="Give me all the data"
                      value={formData.feedbackStyle}
                      onChange={(v) => setFormData({ ...formData, feedbackStyle: v })}
                    />
                  </div>
                </StepWrapper>
              )}

              {/* Step 8: Integrations */}
              {step === 8 && (
                <StepWrapper key="integrations">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Connect your apps
                  </h1>
                  <p className="text-zinc-400 mb-8">
                    Sync your training data for smarter coaching. You can skip this and connect later.
                  </p>
                  
                  <div className="space-y-3">
                    <IntegrationCard
                      name="Strava"
                      icon="🔶"
                      description="Sync workouts automatically"
                      connected={formData.stravaConnected}
                      onConnect={() => setFormData({ ...formData, stravaConnected: true })}
                    />
                    <IntegrationCard
                      name="WHOOP"
                      icon="⚫"
                      description="Recovery and strain data"
                      connected={formData.whoopConnected}
                      onConnect={() => setFormData({ ...formData, whoopConnected: true })}
                    />
                    <IntegrationCard
                      name="Garmin"
                      icon="🔵"
                      description="Training status and metrics"
                      connected={formData.garminConnected}
                      onConnect={() => setFormData({ ...formData, garminConnected: true })}
                    />
                  </div>
                </StepWrapper>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6">
          <div className="max-w-2xl mx-auto flex gap-4">
            {step > 0 && (
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
              {step === 0 ? "Let's go" : step === totalSteps - 1 ? (
                <span className="flex items-center gap-2">
                  Generate my plan
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
              ) : "Continue"}
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

function SliderQuestion({ 
  label, leftLabel, rightLabel, value, onChange 
}: { 
  label: string; 
  leftLabel: string; 
  rightLabel: string; 
  value: number; 
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-3">{label}</label>
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-500 w-24 text-right">{leftLabel}</span>
        <div className="flex-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`flex-1 h-3 rounded-full transition-all ${
                v <= value 
                  ? "bg-gradient-to-r from-orange-500 to-red-600" 
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-zinc-500 w-24">{rightLabel}</span>
      </div>
    </div>
  );
}

function IntegrationCard({ 
  name, icon, description, connected, onConnect 
}: { 
  name: string; 
  icon: string; 
  description: string; 
  connected: boolean; 
  onConnect: () => void;
}) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      connected ? "border-green-500/50 bg-green-500/5" : "border-white/10 bg-white/[0.02]"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-sm text-zinc-500">{description}</div>
          </div>
        </div>
        {connected ? (
          <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Connected
          </span>
        ) : (
          <Button
            onClick={onConnect}
            variant="outline"
            size="sm"
            className="border-white/10 hover:bg-white/5"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

function LoadingStep({ text, done = false, active = false }: { text: string; done?: boolean; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${done || active ? "text-white" : "text-zinc-600"}`}>
      {done ? (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : active ? (
        <svg className="w-5 h-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />
      )}
      <span>{text}</span>
    </div>
  );
}
