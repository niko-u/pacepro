"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Workout {
  type: string;
  title: string;
  description: string;
  duration: number;
  distance?: string;
  zone?: string;
  intervals?: { name: string; duration: string; intensity: string }[];
  tips?: string[];
  warmup?: string;
  cooldown?: string;
  whyThisMatters?: string;
}

interface WorkoutDetailModalProps {
  workout: Workout | null;
  onClose: () => void;
  onStart?: () => void;
}

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  swim: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  bike: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400" },
  run: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400" },
  strength: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" },
  rest: { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-400" },
};

const typeEmojis: Record<string, string> = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
  strength: "💪",
  rest: "😴",
};

export default function WorkoutDetailModal({ workout, onClose, onStart }: WorkoutDetailModalProps) {
  if (!workout) return null;

  const colors = typeColors[workout.type] || typeColors.run;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b border-white/5 ${colors.bg}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center text-2xl`}>
                  {typeEmojis[workout.type]}
                </div>
                <div>
                  <span className={`text-xs ${colors.text} uppercase tracking-wider`}>{workout.type}</span>
                  <h2 className="text-xl font-bold">{workout.title}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-black/20">
                <div className="text-xl font-bold">{workout.duration}</div>
                <div className="text-xs text-zinc-500">minutes</div>
              </div>
              {workout.distance && (
                <div className="text-center p-3 rounded-xl bg-black/20">
                  <div className="text-xl font-bold">{workout.distance}</div>
                  <div className="text-xs text-zinc-500">distance</div>
                </div>
              )}
              {workout.zone && (
                <div className="text-center p-3 rounded-xl bg-black/20">
                  <div className="text-xl font-bold">{workout.zone}</div>
                  <div className="text-xs text-zinc-500">target zone</div>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Overview</h3>
              <p className="text-zinc-300 leading-relaxed">{workout.description}</p>
            </div>

            {/* Warmup */}
            {workout.warmup && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Warm-up</h3>
                <p className="text-zinc-300">{workout.warmup}</p>
              </div>
            )}

            {/* Intervals */}
            {workout.intervals && workout.intervals.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Main Set</h3>
                <div className="space-y-2">
                  {workout.intervals.map((interval, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{interval.name}</div>
                        <div className="text-sm text-zinc-500">{interval.duration}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        interval.intensity === 'hard' ? 'bg-red-500/20 text-red-400' :
                        interval.intensity === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {interval.intensity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cooldown */}
            {workout.cooldown && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Cool-down</h3>
                <p className="text-zinc-300">{workout.cooldown}</p>
              </div>
            )}

            {/* Tips */}
            {workout.tips && workout.tips.length > 0 && (
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <h3 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                  <span>💡</span> Coach Tips
                </h3>
                <ul className="space-y-2">
                  {workout.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                      <span className="text-orange-500 mt-1">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Why this matters */}
            {workout.whyThisMatters && (
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                  <span>🎯</span> Why This Matters
                </h3>
                <p className="text-sm text-zinc-400">{workout.whyThisMatters}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 border-white/10 hover:bg-white/5"
              onClick={onClose}
            >
              Close
            </Button>
            {onStart && workout.type !== 'rest' && (
              <Button
                className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 border-0"
                onClick={onStart}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Workout
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
