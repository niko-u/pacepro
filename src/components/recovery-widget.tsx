"use client";

import { motion } from "framer-motion";

interface RecoveryData {
  score: number;
  hrv: number;
  restingHr: number;
  sleepHours: number;
  sleepQuality: number;
  strain: number;
  source: string;
}

interface RecoveryWidgetProps {
  data: RecoveryData;
}

export function RecoveryWidget({ data }: RecoveryWidgetProps) {
  const getScoreColor = (score: number) => {
    if (score >= 67) return { bg: "bg-green-500", text: "text-green-500", label: "Good" };
    if (score >= 34) return { bg: "bg-yellow-500", text: "text-yellow-500", label: "Moderate" };
    return { bg: "bg-red-500", text: "text-red-500", label: "Low" };
  };

  const scoreInfo = getScoreColor(data.score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (data.score / 100) * circumference;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Today's Recovery</h3>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          via {data.source}
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular progress */}
        <div className="relative">
          <svg className="w-28 h-28 -rotate-90">
            {/* Background circle */}
            <circle
              cx="56"
              cy="56"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-zinc-200 dark:text-zinc-800"
            />
            {/* Progress circle */}
            <motion.circle
              cx="56"
              cy="56"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={scoreInfo.text}
              initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{data.score}%</span>
            <span className={`text-xs font-medium ${scoreInfo.text}`}>{scoreInfo.label}</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <MetricCard
            icon="💓"
            label="HRV"
            value={`${data.hrv}ms`}
            trend={data.hrv > 50 ? "up" : "down"}
          />
          <MetricCard
            icon="❤️"
            label="Resting HR"
            value={`${data.restingHr}bpm`}
            trend={data.restingHr < 55 ? "up" : "neutral"}
          />
          <MetricCard
            icon="😴"
            label="Sleep"
            value={`${data.sleepHours}h`}
            sublabel={`${data.sleepQuality}% quality`}
          />
          <MetricCard
            icon="⚡"
            label="Strain"
            value={data.strain.toFixed(1)}
            sublabel="yesterday"
          />
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.score >= 67 
            ? "💪 Great recovery! You're cleared for a harder effort today."
            : data.score >= 34
            ? "⚠️ Moderate recovery — keep today's effort controlled."
            : "🛑 Low recovery detected. Consider an easy day or rest."}
        </p>
      </div>
    </div>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  sublabel,
  trend 
}: { 
  icon: string; 
  label: string; 
  value: string; 
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-zinc-500">{label}</span>
        {trend && (
          <span className={`text-xs ${
            trend === "up" ? "text-green-500" : 
            trend === "down" ? "text-red-500" : 
            "text-zinc-400"
          }`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
      <div className="font-semibold">{value}</div>
      {sublabel && <div className="text-xs text-zinc-500">{sublabel}</div>}
    </div>
  );
}

export function RecoveryWidgetCompact({ data }: RecoveryWidgetProps) {
  const getScoreColor = (score: number) => {
    if (score >= 67) return "text-green-500 bg-green-500/10 border-green-500/20";
    if (score >= 34) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl border ${getScoreColor(data.score)}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">💚</span>
        <div>
          <div className="text-sm font-semibold">{data.score}% Recovery</div>
          <div className="text-xs opacity-70">HRV {data.hrv}ms • Sleep {data.sleepHours}h</div>
        </div>
      </div>
    </div>
  );
}
