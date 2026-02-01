import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";

// ─── Lazy OpenAI ──────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round minutes to the nearest 5 (e.g., 63 → 65, 113 → 115, 47 → 45) */
function roundTo5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Phase {
  name: "base" | "build" | "peak" | "taper";
  weeks: number;
  volumeMultiplier: number;
  startWeek: number;
}

interface WeekMeta {
  weekNumber: number;
  phaseName: string;
  weekInPhase: number;
  isDeload: boolean;
  volumeMultiplier: number;
}

interface WorkoutTemplate {
  dayOfWeek: string;
  workoutType: "swim" | "bike" | "run" | "strength" | "rest" | "brick";
  title: string;
  intensity: "easy" | "moderate" | "hard" | "max";
  durationMinutes: number;
  isKeySession: boolean;
}

interface PaceZones {
  easy: { min: number; max: number };
  moderate: { min: number; max: number };
  tempo: { min: number; max: number };
  threshold: { min: number; max: number };
  interval: { min: number; max: number };
  longRun: { min: number; max: number };
}

interface PowerZones {
  z1: { min: number; max: number };
  z2: { min: number; max: number };
  z3: { min: number; max: number };
  z4: { min: number; max: number };
  z5: { min: number; max: number };
}

interface AthleteProfile {
  id: string;
  full_name: string | null;
  experience_level: string | null;
  primary_sport: string | null;
  run_pace_per_km: number | null;
  bike_ftp: number | null;
  swim_pace_per_100m: number | null;
  goal_race_date: string | null;
  goal_race_type: string | null;
  goal_finish_time: number | null;
  weekly_hours_available: number | null;
  preferred_training_days: string[] | null;
  preferences: Record<string, unknown> | null;
}

interface PlanConfig {
  phases: Phase[];
  weekSchedule: WeekMeta[];
  weeklyHoursTarget: number;
  sport: string;
  runPaceZones: PaceZones | null;
  bikePowerZones: PowerZones | null;
  swimPacePer100m: number | null;
  experienceLevel: string;
  availableDays: string[];
  preferences: { longerWorkouts?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VOLUME_TARGETS: Record<string, { minHours: number; maxHours: number }> = {
  "5k": { minHours: 4, maxHours: 6 },
  "10k": { minHours: 5, maxHours: 8 },
  half_marathon: { minHours: 5, maxHours: 10 },
  marathon: { minHours: 6, maxHours: 12 },
  ultra: { minHours: 8, maxHours: 16 },
  sprint_tri: { minHours: 5, maxHours: 8 },
  olympic_tri: { minHours: 8, maxHours: 12 },
  "70.3": { minHours: 10, maxHours: 16 },
  ironman: { minHours: 12, maxHours: 20 },
};

/** Default easy pace in seconds per km by experience level */
const DEFAULT_EASY_PACE: Record<string, number> = {
  beginner: 373, // ~6:13/km (10:00/mi)
  intermediate: 317, // ~5:17/km (8:30/mi)
  advanced: 280, // ~4:40/km (7:30/mi)
  elite: 255, // ~4:15/km (6:50/mi)
};

const DEFAULT_FTP: Record<string, number> = {
  beginner: 150,
  intermediate: 220,
  advanced: 280,
  elite: 340,
};

const DEFAULT_SWIM_PACE: Record<string, number> = {
  beginner: 150, // 2:30/100m
  intermediate: 115, // 1:55/100m
  advanced: 95, // 1:35/100m
  elite: 80, // 1:20/100m
};

const CYCLING_SPEED_KMH: Record<string, number> = {
  beginner: 22,
  intermediate: 27,
  advanced: 32,
  elite: 35,
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_MAP: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function weeksBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Get Monday of the given date's week */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Get today's date (YYYY-MM-DD) in the user's timezone.
 * Falls back to UTC if timezone is not provided or invalid.
 */
function getUserToday(timezone?: string | null): string {
  if (!timezone) {
    return new Date().toISOString().split("T")[0];
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA locale formats as YYYY-MM-DD
    return formatter.format(new Date());
  } catch {
    // Invalid timezone — fall back to UTC
    return new Date().toISOString().split("T")[0];
  }
}

// ─── Pace / Zone Helpers ──────────────────────────────────────────────────────

function calculateRunPaceZones(easyPaceSec: number): PaceZones {
  return {
    easy: { min: easyPaceSec, max: Math.round(easyPaceSec * 1.15) },
    moderate: { min: Math.round(easyPaceSec * 0.9), max: easyPaceSec },
    tempo: { min: Math.round(easyPaceSec * 0.82), max: Math.round(easyPaceSec * 0.88) },
    threshold: { min: Math.round(easyPaceSec * 0.78), max: Math.round(easyPaceSec * 0.82) },
    interval: { min: Math.round(easyPaceSec * 0.72), max: Math.round(easyPaceSec * 0.78) },
    longRun: { min: easyPaceSec, max: Math.round(easyPaceSec * 1.1) },
  };
}

function calculateBikePowerZones(ftp: number): PowerZones {
  return {
    z1: { min: 0, max: Math.round(ftp * 0.55) },
    z2: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75) },
    z3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.9) },
    z4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
    z5: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.2) },
  };
}

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function formatPaceRange(zone: { min: number; max: number }): string {
  return `${formatPace(zone.min)}–${formatPace(zone.max)}`;
}

function formatSwimPace(secPer100m: number): string {
  const min = Math.floor(secPer100m / 60);
  const sec = Math.round(secPer100m % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/100m`;
}

// ─── Phase Calculation ────────────────────────────────────────────────────────

function rolling4WeekCycles(startDate: Date, totalWeeks: number): Phase[] {
  const phases: Phase[] = [];
  let weekCounter = 0;

  while (weekCounter < totalWeeks) {
    const cycleWeeks = Math.min(4, totalWeeks - weekCounter);
    const phaseName = phases.length % 2 === 0 ? "base" : "build";
    phases.push({
      name: phaseName as "base" | "build",
      weeks: cycleWeeks,
      volumeMultiplier: phaseName === "base" ? 0.7 : 1.0,
      startWeek: weekCounter,
    });
    weekCounter += cycleWeeks;
  }

  return phases;
}

export function calculatePhases(startDate: Date, raceDate: Date | null): Phase[] {
  if (!raceDate) {
    return rolling4WeekCycles(startDate, 16);
  }

  const totalWeeks = Math.max(4, weeksBetween(startDate, raceDate));
  const taperWeeks = Math.max(2, Math.round(totalWeeks * 0.1));
  const peakWeeks = Math.max(1, Math.round(totalWeeks * 0.2));
  const buildWeeks = Math.max(1, Math.round(totalWeeks * 0.3));
  const baseWeeks = totalWeeks - taperWeeks - peakWeeks - buildWeeks;

  let weekCounter = 0;
  const phases: Phase[] = [];

  if (baseWeeks > 0) {
    phases.push({ name: "base", weeks: baseWeeks, volumeMultiplier: 0.7, startWeek: weekCounter });
    weekCounter += baseWeeks;
  }
  phases.push({ name: "build", weeks: buildWeeks, volumeMultiplier: 1.0, startWeek: weekCounter });
  weekCounter += buildWeeks;
  phases.push({ name: "peak", weeks: peakWeeks, volumeMultiplier: 0.95, startWeek: weekCounter });
  weekCounter += peakWeeks;
  phases.push({ name: "taper", weeks: taperWeeks, volumeMultiplier: 0.5, startWeek: weekCounter });

  return phases;
}

// ─── Week Schedule (Deload Logic) ─────────────────────────────────────────────

function buildWeekSchedule(phases: Phase[]): WeekMeta[] {
  const weeks: WeekMeta[] = [];
  let weekNumber = 0;

  for (const phase of phases) {
    let loadCount = 0;
    for (let w = 0; w < phase.weeks; w++) {
      let isDeload = false;

      if (phase.name === "base" || phase.name === "build") {
        loadCount++;
        if (loadCount === 4) {
          isDeload = true;
          loadCount = 0;
        }
      }

      const volumeMult = isDeload ? phase.volumeMultiplier * 0.65 : phase.volumeMultiplier;

      weeks.push({
        weekNumber,
        phaseName: phase.name,
        weekInPhase: w,
        isDeload,
        volumeMultiplier: volumeMult,
      });
      weekNumber++;
    }
  }

  return weeks;
}

// ─── Progressive Overload ─────────────────────────────────────────────────────

/**
 * Calculate progressive overload multiplier for a week within its phase.
 * Base & build phases get ~5% weekly volume increase within each 4-week load block.
 * Deload, peak, and taper weeks are unaffected (multiplier = 1.0).
 *
 * Example for build phase: week 1 = 1.0x, week 2 = 1.05x, week 3 = 1.10x, week 4 (deload) = unchanged.
 */
function getWeekProgressionMultiplier(weekMeta: WeekMeta): number {
  // Deload weeks keep their existing reduction — no additional scaling
  if (weekMeta.isDeload) return 1.0;

  // Only apply progressive overload in base and build phases
  if (weekMeta.phaseName !== "base" && weekMeta.phaseName !== "build") return 1.0;

  // Within each 4-week block: weeks 0, 1, 2 are load weeks (posInBlock via weekInPhase % 4)
  // ~5% increase per load week within the cycle
  const posInBlock = weekMeta.weekInPhase % 4;
  return 1.0 + posInBlock * 0.05;
}

// ─── Template Builder Helpers ─────────────────────────────────────────────────

function normalizeAvailableDays(days: string[]): string[] {
  return days
    .map((d) => DAY_MAP[d.toLowerCase()] || d)
    .filter((d) => DAY_ORDER.includes(d))
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function areConsecutive(day1: string, day2: string): boolean {
  const i1 = DAY_ORDER.indexOf(day1);
  const i2 = DAY_ORDER.indexOf(day2);
  return Math.abs(i1 - i2) === 1 || (i1 === 0 && i2 === 6) || (i1 === 6 && i2 === 0);
}

function findLongDay(available: string[], prefs: { longerWorkouts?: string }): string {
  if (prefs.longerWorkouts === "weekends" || !prefs.longerWorkouts) {
    if (available.includes("Sat")) return "Sat";
    if (available.includes("Sun")) return "Sun";
  }
  return available[available.length - 1];
}

/** Pick a day for a hard session, avoiding consecutive hard days. */
function pickNonAdjacentDay(
  available: string[],
  hardDays: string[],
  avoid: string[]
): string | null {
  // Prefer days not adjacent to any existing hard day
  const best = available.filter(
    (d) => !avoid.includes(d) && !hardDays.some((hd) => areConsecutive(d, hd))
  );
  if (best.length > 0) return best[Math.floor(best.length / 2)];

  // Fallback: any unused day
  const fallback = available.filter((d) => !avoid.includes(d));
  return fallback.length > 0 ? fallback[0] : null;
}

// ─── Running Templates ────────────────────────────────────────────────────────

function buildRunningTemplates(
  available: string[],
  weeklyMinutes: number,
  phase: string,
  isDeload: boolean,
  preferences: { longerWorkouts?: string }
): WorkoutTemplate[] {
  const templates: WorkoutTemplate[] = [];
  const longDay = findLongDay(available, preferences);
  const assigned: string[] = [];

  if (isDeload) {
    const factor = 0.65;
    const easyDur = roundTo5(weeklyMinutes * 0.2 * factor);
    const qualityDur = roundTo5(weeklyMinutes * 0.25 * factor);
    const longDur = roundTo5(weeklyMinutes * 0.3 * factor);

    templates.push({
      dayOfWeek: longDay,
      workoutType: "run",
      title: "Easy Long Run",
      intensity: "easy",
      durationMinutes: longDur,
      isKeySession: false,
    });
    assigned.push(longDay);

    const qualDay = pickNonAdjacentDay(available, [longDay], assigned);
    if (qualDay) {
      templates.push({
        dayOfWeek: qualDay,
        workoutType: "run",
        title: "Recovery Tempo",
        intensity: "moderate",
        durationMinutes: qualityDur,
        isKeySession: true,
      });
      assigned.push(qualDay);
    }

    const remaining = available.filter((d) => !assigned.includes(d));
    for (let i = 0; i < Math.min(2, remaining.length); i++) {
      templates.push({
        dayOfWeek: remaining[i],
        workoutType: "run",
        title: "Easy Recovery Run",
        intensity: "easy",
        durationMinutes: easyDur,
        isKeySession: false,
      });
    }
    return templates;
  }

  switch (phase) {
    case "base": {
      const longDur = roundTo5(weeklyMinutes * 0.3);
      const tempoDur = roundTo5(weeklyMinutes * 0.2);
      const easyDur = roundTo5(weeklyMinutes * 0.15);

      templates.push({
        dayOfWeek: longDay,
        workoutType: "run",
        title: "Long Run",
        intensity: "easy",
        durationMinutes: longDur,
        isKeySession: true,
      });
      assigned.push(longDay);

      const tempoDay = pickNonAdjacentDay(available, [longDay], assigned);
      if (tempoDay) {
        templates.push({
          dayOfWeek: tempoDay,
          workoutType: "run",
          title: "Tempo Run",
          intensity: "moderate",
          durationMinutes: tempoDur,
          isKeySession: true,
        });
        assigned.push(tempoDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      for (let i = 0; i < Math.min(3, remaining.length); i++) {
        templates.push({
          dayOfWeek: remaining[i],
          workoutType: "run",
          title: "Easy Run",
          intensity: "easy",
          durationMinutes: easyDur,
          isKeySession: false,
        });
      }
      break;
    }

    case "build": {
      const longDur = roundTo5(weeklyMinutes * 0.28);
      const tempoDur = roundTo5(weeklyMinutes * 0.2);
      const intervalDur = roundTo5(weeklyMinutes * 0.18);
      const easyDur = roundTo5(weeklyMinutes * 0.15);
      const hardDays: string[] = [];

      templates.push({
        dayOfWeek: longDay,
        workoutType: "run",
        title: "Progressive Long Run",
        intensity: "moderate",
        durationMinutes: longDur,
        isKeySession: true,
      });
      assigned.push(longDay);
      hardDays.push(longDay);

      const intDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (intDay) {
        templates.push({
          dayOfWeek: intDay,
          workoutType: "run",
          title: "Interval Session",
          intensity: "hard",
          durationMinutes: intervalDur,
          isKeySession: true,
        });
        assigned.push(intDay);
        hardDays.push(intDay);
      }

      const tempoDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (tempoDay) {
        templates.push({
          dayOfWeek: tempoDay,
          workoutType: "run",
          title: "Tempo Run",
          intensity: "moderate",
          durationMinutes: tempoDur,
          isKeySession: true,
        });
        assigned.push(tempoDay);
        hardDays.push(tempoDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      for (let i = 0; i < Math.min(2, remaining.length); i++) {
        templates.push({
          dayOfWeek: remaining[i],
          workoutType: "run",
          title: "Easy Run",
          intensity: "easy",
          durationMinutes: easyDur,
          isKeySession: false,
        });
      }
      break;
    }

    case "peak": {
      const longDur = roundTo5(weeklyMinutes * 0.28);
      const rpDur = roundTo5(weeklyMinutes * 0.2);
      const intDur = roundTo5(weeklyMinutes * 0.18);
      const easyDur = roundTo5(weeklyMinutes * 0.15);
      const hardDays: string[] = [];

      templates.push({
        dayOfWeek: longDay,
        workoutType: "run",
        title: "Race-Specific Long Run",
        intensity: "moderate",
        durationMinutes: longDur,
        isKeySession: true,
      });
      assigned.push(longDay);
      hardDays.push(longDay);

      const rpDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (rpDay) {
        templates.push({
          dayOfWeek: rpDay,
          workoutType: "run",
          title: "Race Pace Run",
          intensity: "hard",
          durationMinutes: rpDur,
          isKeySession: true,
        });
        assigned.push(rpDay);
        hardDays.push(rpDay);
      }

      const intDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (intDay) {
        templates.push({
          dayOfWeek: intDay,
          workoutType: "run",
          title: "Sharpening Intervals",
          intensity: "hard",
          durationMinutes: intDur,
          isKeySession: true,
        });
        assigned.push(intDay);
        hardDays.push(intDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      for (let i = 0; i < Math.min(2, remaining.length); i++) {
        templates.push({
          dayOfWeek: remaining[i],
          workoutType: "run",
          title: "Easy Run",
          intensity: "easy",
          durationMinutes: easyDur,
          isKeySession: false,
        });
      }
      break;
    }

    case "taper": {
      const medLongDur = roundTo5(weeklyMinutes * 0.25);
      const tempoDur = roundTo5(weeklyMinutes * 0.15);
      const easyDur = roundTo5(weeklyMinutes * 0.12);

      templates.push({
        dayOfWeek: longDay,
        workoutType: "run",
        title: "Medium-Long Run",
        intensity: "easy",
        durationMinutes: medLongDur,
        isKeySession: false,
      });
      assigned.push(longDay);

      const tempoDay = pickNonAdjacentDay(available, [longDay], assigned);
      if (tempoDay) {
        templates.push({
          dayOfWeek: tempoDay,
          workoutType: "run",
          title: "Short Tempo",
          intensity: "moderate",
          durationMinutes: tempoDur,
          isKeySession: true,
        });
        assigned.push(tempoDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      for (let i = 0; i < Math.min(2, remaining.length); i++) {
        templates.push({
          dayOfWeek: remaining[i],
          workoutType: "run",
          title: "Easy Shakeout Run",
          intensity: "easy",
          durationMinutes: easyDur,
          isKeySession: false,
        });
      }
      break;
    }
  }

  return templates;
}

// ─── Triathlon Templates ──────────────────────────────────────────────────────

function buildTriathlonTemplates(
  available: string[],
  weeklyMinutes: number,
  phase: string,
  isDeload: boolean,
  preferences: { longerWorkouts?: string }
): WorkoutTemplate[] {
  const templates: WorkoutTemplate[] = [];
  const longDay = findLongDay(available, preferences);
  const brickDay = available.includes("Sat") ? "Sat" : longDay;
  const assigned: string[] = [];

  if (isDeload) {
    const factor = 0.65;
    // Simplified deload: 1 swim, 1 bike, 1 run, all easy
    const swimDur = roundTo5(weeklyMinutes * 0.15 * factor);
    const bikeDur = roundTo5(weeklyMinutes * 0.25 * factor);
    const runDur = roundTo5(weeklyMinutes * 0.2 * factor);

    for (const day of available) {
      if (assigned.length >= 3) break;
      if (assigned.length === 0) {
        templates.push({ dayOfWeek: day, workoutType: "swim", title: "Easy Swim", intensity: "easy", durationMinutes: swimDur, isKeySession: false });
      } else if (assigned.length === 1) {
        templates.push({ dayOfWeek: day, workoutType: "bike", title: "Easy Ride", intensity: "easy", durationMinutes: bikeDur, isKeySession: false });
      } else {
        templates.push({ dayOfWeek: day, workoutType: "run", title: "Easy Run", intensity: "easy", durationMinutes: runDur, isKeySession: false });
      }
      assigned.push(day);
    }
    return templates;
  }

  switch (phase) {
    case "base": {
      // 2 swim, 2 bike, 2 run, 1 strength = 7 sessions
      const swimDur = roundTo5(weeklyMinutes * 0.1);
      const bikeDur = roundTo5(weeklyMinutes * 0.18);
      const longBikeDur = roundTo5(weeklyMinutes * 0.22);
      const runDur = roundTo5(weeklyMinutes * 0.12);
      const longRunDur = roundTo5(weeklyMinutes * 0.18);
      const strengthDur = roundTo5(weeklyMinutes * 0.08);

      // Long ride on the long day
      templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Long Endurance Ride", intensity: "easy", durationMinutes: longBikeDur, isKeySession: true });
      assigned.push(longDay);

      // Long run on Sunday if possible (or next available)
      const longRunDay = available.find((d) => d !== longDay && (d === "Sun" || d === "Sat")) || available.find((d) => !assigned.includes(d));
      if (longRunDay) {
        templates.push({ dayOfWeek: longRunDay, workoutType: "run", title: "Long Run", intensity: "easy", durationMinutes: longRunDur, isKeySession: true });
        assigned.push(longRunDay);
      }

      // Fill remaining: 2 swim, 1 bike, 1 run, 1 strength
      const remaining = available.filter((d) => !assigned.includes(d));
      const assignments: WorkoutTemplate[] = [
        { dayOfWeek: "", workoutType: "swim", title: "Swim Technique", intensity: "easy", durationMinutes: swimDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "swim", title: "Swim Endurance", intensity: "moderate", durationMinutes: swimDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "bike", title: "Endurance Ride", intensity: "easy", durationMinutes: bikeDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "run", title: "Easy Run", intensity: "easy", durationMinutes: runDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "strength", title: "Functional Strength", intensity: "moderate", durationMinutes: strengthDur, isKeySession: false },
      ];
      for (let i = 0; i < Math.min(assignments.length, remaining.length); i++) {
        templates.push({ ...assignments[i], dayOfWeek: remaining[i] });
      }
      break;
    }

    case "build": {
      // 1 swim, 2 bike, 2 run, 1 brick, 1 strength = 7 sessions
      const swimDur = roundTo5(weeklyMinutes * 0.1);
      const bikeDur = roundTo5(weeklyMinutes * 0.15);
      const bikeIntDur = roundTo5(weeklyMinutes * 0.15);
      const runTempoDur = roundTo5(weeklyMinutes * 0.13);
      const longRunDur = roundTo5(weeklyMinutes * 0.18);
      const brickDur = roundTo5(weeklyMinutes * 0.22);
      const strengthDur = roundTo5(weeklyMinutes * 0.07);

      // Brick on Saturday
      templates.push({ dayOfWeek: brickDay, workoutType: "brick", title: "Brick: Ride + Run", intensity: "moderate", durationMinutes: brickDur, isKeySession: true });
      assigned.push(brickDay);

      // Long run on Sunday or longDay
      const longRunDay = available.find((d) => !assigned.includes(d) && (d === "Sun" || d === longDay)) || available.find((d) => !assigned.includes(d));
      if (longRunDay) {
        templates.push({ dayOfWeek: longRunDay, workoutType: "run", title: "Long Run", intensity: "easy", durationMinutes: longRunDur, isKeySession: true });
        assigned.push(longRunDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      const fills: WorkoutTemplate[] = [
        { dayOfWeek: "", workoutType: "swim", title: "Swim Speed", intensity: "hard", durationMinutes: swimDur, isKeySession: true },
        { dayOfWeek: "", workoutType: "bike", title: "Bike Endurance", intensity: "easy", durationMinutes: bikeDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "bike", title: "Bike Intervals", intensity: "hard", durationMinutes: bikeIntDur, isKeySession: true },
        { dayOfWeek: "", workoutType: "run", title: "Tempo Run", intensity: "moderate", durationMinutes: runTempoDur, isKeySession: true },
        { dayOfWeek: "", workoutType: "strength", title: "Core & Strength", intensity: "moderate", durationMinutes: strengthDur, isKeySession: false },
      ];
      // Assign hard sessions to non-adjacent days
      const hardDays = [...assigned];
      for (const fill of fills) {
        const day =
          fill.intensity === "hard" || fill.intensity === "max"
            ? pickNonAdjacentDay(available, hardDays, assigned)
            : remaining.find((d) => !assigned.includes(d));
        if (day) {
          templates.push({ ...fill, dayOfWeek: day });
          assigned.push(day);
          if (fill.intensity === "hard") hardDays.push(day);
        }
      }
      break;
    }

    case "peak": {
      // 1 swim, 1 bike (race-pace), 1 run (race-pace), 1 brick (race sim), 1 easy
      const swimDur = roundTo5(weeklyMinutes * 0.12);
      const bikeRPDur = roundTo5(weeklyMinutes * 0.2);
      const runRPDur = roundTo5(weeklyMinutes * 0.18);
      const brickSimDur = roundTo5(weeklyMinutes * 0.3);
      const easyDur = roundTo5(weeklyMinutes * 0.1);

      templates.push({ dayOfWeek: brickDay, workoutType: "brick", title: "Race Simulation Brick", intensity: "hard", durationMinutes: brickSimDur, isKeySession: true });
      assigned.push(brickDay);

      const remaining = available.filter((d) => !assigned.includes(d));
      const fills: WorkoutTemplate[] = [
        { dayOfWeek: "", workoutType: "bike", title: "Race Pace Ride", intensity: "hard", durationMinutes: bikeRPDur, isKeySession: true },
        { dayOfWeek: "", workoutType: "run", title: "Race Pace Run", intensity: "hard", durationMinutes: runRPDur, isKeySession: true },
        { dayOfWeek: "", workoutType: "swim", title: "Swim Sharpening", intensity: "moderate", durationMinutes: swimDur, isKeySession: false },
        { dayOfWeek: "", workoutType: "run", title: "Easy Run", intensity: "easy", durationMinutes: easyDur, isKeySession: false },
      ];
      for (let i = 0; i < Math.min(fills.length, remaining.length); i++) {
        templates.push({ ...fills[i], dayOfWeek: remaining[i] });
      }
      break;
    }

    case "taper": {
      const swimDur = roundTo5(weeklyMinutes * 0.15);
      const bikeDur = roundTo5(weeklyMinutes * 0.2);
      const runDur = roundTo5(weeklyMinutes * 0.15);

      for (const day of available.slice(0, 3)) {
        if (assigned.length === 0) {
          templates.push({ dayOfWeek: day, workoutType: "swim", title: "Easy Swim", intensity: "easy", durationMinutes: swimDur, isKeySession: false });
        } else if (assigned.length === 1) {
          templates.push({ dayOfWeek: day, workoutType: "bike", title: "Easy Ride", intensity: "easy", durationMinutes: bikeDur, isKeySession: false });
        } else {
          templates.push({ dayOfWeek: day, workoutType: "run", title: "Easy Run", intensity: "easy", durationMinutes: runDur, isKeySession: false });
        }
        assigned.push(day);
      }
      break;
    }
  }

  return templates;
}

// ─── Cycling Templates ────────────────────────────────────────────────────────

function buildCyclingTemplates(
  available: string[],
  weeklyMinutes: number,
  phase: string,
  isDeload: boolean,
  preferences: { longerWorkouts?: string }
): WorkoutTemplate[] {
  const templates: WorkoutTemplate[] = [];
  const longDay = findLongDay(available, preferences);
  const assigned: string[] = [];

  if (isDeload) {
    const factor = 0.65;
    const endDur = roundTo5(weeklyMinutes * 0.3 * factor);
    const easyDur = roundTo5(weeklyMinutes * 0.2 * factor);

    templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Easy Endurance Ride", intensity: "easy", durationMinutes: endDur, isKeySession: false });
    assigned.push(longDay);

    const remaining = available.filter((d) => !assigned.includes(d));
    for (let i = 0; i < Math.min(2, remaining.length); i++) {
      templates.push({ dayOfWeek: remaining[i], workoutType: "bike", title: "Recovery Ride", intensity: "easy", durationMinutes: easyDur, isKeySession: false });
      assigned.push(remaining[i]);
    }
    return templates;
  }

  switch (phase) {
    case "base": {
      const longDur = roundTo5(weeklyMinutes * 0.35);
      const endDur = roundTo5(weeklyMinutes * 0.2);
      const tempoDur = roundTo5(weeklyMinutes * 0.18);
      const easyDur = roundTo5(weeklyMinutes * 0.12);

      templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Long Endurance Ride", intensity: "easy", durationMinutes: longDur, isKeySession: true });
      assigned.push(longDay);

      const tempoDay = pickNonAdjacentDay(available, [longDay], assigned);
      if (tempoDay) {
        templates.push({ dayOfWeek: tempoDay, workoutType: "bike", title: "Tempo Ride", intensity: "moderate", durationMinutes: tempoDur, isKeySession: true });
        assigned.push(tempoDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      const fills = [
        { title: "Endurance Ride", dur: endDur },
        { title: "Easy Spin", dur: easyDur },
        { title: "Recovery Ride", dur: easyDur },
      ];
      for (let i = 0; i < Math.min(fills.length, remaining.length); i++) {
        templates.push({ dayOfWeek: remaining[i], workoutType: "bike", title: fills[i].title, intensity: "easy" as const, durationMinutes: fills[i].dur, isKeySession: false });
      }
      break;
    }

    case "build": {
      const longDur = roundTo5(weeklyMinutes * 0.3);
      const ssDur = roundTo5(weeklyMinutes * 0.2);
      const intDur = roundTo5(weeklyMinutes * 0.18);
      const endDur = roundTo5(weeklyMinutes * 0.18);
      const easyDur = roundTo5(weeklyMinutes * 0.12);
      const hardDays: string[] = [];

      templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Long Ride", intensity: "easy", durationMinutes: longDur, isKeySession: true });
      assigned.push(longDay);

      const intDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (intDay) {
        templates.push({ dayOfWeek: intDay, workoutType: "bike", title: "VO2max Intervals", intensity: "hard", durationMinutes: intDur, isKeySession: true });
        assigned.push(intDay);
        hardDays.push(intDay);
      }

      const ssDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (ssDay) {
        templates.push({ dayOfWeek: ssDay, workoutType: "bike", title: "Sweet Spot", intensity: "moderate", durationMinutes: ssDur, isKeySession: true });
        assigned.push(ssDay);
        hardDays.push(ssDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      if (remaining.length > 0)
        templates.push({ dayOfWeek: remaining[0], workoutType: "bike", title: "Endurance Ride", intensity: "easy", durationMinutes: endDur, isKeySession: false });
      if (remaining.length > 1)
        templates.push({ dayOfWeek: remaining[1], workoutType: "bike", title: "Recovery Ride", intensity: "easy", durationMinutes: easyDur, isKeySession: false });
      break;
    }

    case "peak": {
      const longDur = roundTo5(weeklyMinutes * 0.28);
      const rpDur = roundTo5(weeklyMinutes * 0.22);
      const intDur = roundTo5(weeklyMinutes * 0.18);
      const easyDur = roundTo5(weeklyMinutes * 0.12);
      const hardDays: string[] = [];

      templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Race Pace Long Ride", intensity: "moderate", durationMinutes: longDur, isKeySession: true });
      assigned.push(longDay);
      hardDays.push(longDay);

      const rpDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (rpDay) {
        templates.push({ dayOfWeek: rpDay, workoutType: "bike", title: "Race Simulation", intensity: "hard", durationMinutes: rpDur, isKeySession: true });
        assigned.push(rpDay);
        hardDays.push(rpDay);
      }

      const intDay = pickNonAdjacentDay(available, hardDays, assigned);
      if (intDay) {
        templates.push({ dayOfWeek: intDay, workoutType: "bike", title: "Short Sharp Intervals", intensity: "hard", durationMinutes: intDur, isKeySession: true });
        assigned.push(intDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      if (remaining.length > 0)
        templates.push({ dayOfWeek: remaining[0], workoutType: "bike", title: "Recovery Spin", intensity: "easy", durationMinutes: easyDur, isKeySession: false });
      break;
    }

    case "taper": {
      const endDur = roundTo5(weeklyMinutes * 0.25);
      const intDur = roundTo5(weeklyMinutes * 0.15);
      const easyDur = roundTo5(weeklyMinutes * 0.12);

      templates.push({ dayOfWeek: longDay, workoutType: "bike", title: "Easy Endurance Ride", intensity: "easy", durationMinutes: endDur, isKeySession: false });
      assigned.push(longDay);

      const intDay = pickNonAdjacentDay(available, [], assigned);
      if (intDay) {
        templates.push({ dayOfWeek: intDay, workoutType: "bike", title: "Short Openers", intensity: "moderate", durationMinutes: intDur, isKeySession: true });
        assigned.push(intDay);
      }

      const remaining = available.filter((d) => !assigned.includes(d));
      if (remaining.length > 0)
        templates.push({ dayOfWeek: remaining[0], workoutType: "bike", title: "Recovery Spin", intensity: "easy", durationMinutes: easyDur, isKeySession: false });
      break;
    }
  }

  return templates;
}

// ─── Main Template Dispatcher ─────────────────────────────────────────────────

function buildWeekTemplate(
  sport: "running" | "triathlon" | "cycling",
  availableDays: string[],
  weeklyHours: number,
  phase: string,
  isDeloadWeek: boolean,
  preferences: { longerWorkouts?: string; preferredTime?: string[] }
): WorkoutTemplate[] {
  const weeklyMinutes = Math.round(weeklyHours * 60);
  const normDays = normalizeAvailableDays(availableDays);
  const days = normDays.length > 0 ? normDays : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (sport) {
    case "triathlon":
      return buildTriathlonTemplates(days, weeklyMinutes, phase, isDeloadWeek, preferences);
    case "cycling":
      return buildCyclingTemplates(days, weeklyMinutes, phase, isDeloadWeek, preferences);
    case "running":
    default:
      return buildRunningTemplates(days, weeklyMinutes, phase, isDeloadWeek, preferences);
  }
}

// ─── Workout Prescription ─────────────────────────────────────────────────────

function estimateRunDistance(durationMin: number, avgPaceSecPerKm: number): number {
  return Math.round(((durationMin * 60) / avgPaceSecPerKm) * 1000);
}

function estimateBikeDistance(durationMin: number, speedKmh: number): number {
  return Math.round((durationMin / 60) * speedKmh * 1000);
}

function estimateSwimDistance(durationMin: number, pacePer100m: number): number {
  // Effective pool time ~85% of session (rest intervals, transitions)
  return Math.round(((durationMin * 60 * 0.85) / pacePer100m) * 100);
}

function buildRunDescription(
  template: WorkoutTemplate,
  zones: PaceZones
): string {
  const warmup = `Warmup: 10 min easy (${formatPaceRange(zones.easy)})`;
  const cooldown = `Cooldown: 10 min easy jog`;
  const mainMin = Math.max(10, template.durationMinutes - 20);

  switch (template.title) {
    case "Easy Run":
    case "Easy Recovery Run":
    case "Easy Shakeout Run":
      return `Run at an easy, conversational pace.\nTarget: ${formatPaceRange(zones.easy)}\nDuration: ${template.durationMinutes} min\nFocus on relaxed form and steady breathing.`;

    case "Long Run":
    case "Easy Long Run":
      return `${warmup}\nMain: ${mainMin} min at long run pace (${formatPaceRange(zones.longRun)})\nCooldown: 10 min walk/easy jog\nStay relaxed — this builds your aerobic engine.`;

    case "Progressive Long Run":
      return `${warmup}\nMain: ${mainMin} min building from easy to moderate\n  First half: ${formatPace(zones.longRun.max)}\n  Second half: build to ${formatPace(zones.moderate.min)}\n${cooldown}\nNegative split — finish feeling strong.`;

    case "Race-Specific Long Run":
      return `${warmup}\nMain: ${mainMin} min at race effort\n  Settle into ${formatPaceRange(zones.moderate)} for middle portion\n  Last 15 min push to ${formatPace(zones.tempo.max)}\n${cooldown}`;

    case "Tempo Run":
    case "Short Tempo":
      return `${warmup}\nMain: ${mainMin} min at tempo pace (${formatPaceRange(zones.tempo)})\n${cooldown}\nComfortably hard — you can speak in short phrases.`;

    case "Recovery Tempo":
      return `${warmup}\nMain: ${mainMin} min alternating 5 min tempo / 3 min easy\n  Tempo: ${formatPaceRange(zones.tempo)}\n  Recovery: ${formatPaceRange(zones.easy)}\n${cooldown}`;

    case "Interval Session": {
      const reps = Math.max(3, Math.floor(mainMin / 5));
      return `${warmup}\nMain: ${reps}x3 min hard (${formatPaceRange(zones.interval)}) with 2 min jog recovery\n${cooldown}\nHold even splits — don't go out too fast on rep 1.`;
    }

    case "Sharpening Intervals": {
      const reps = Math.max(4, Math.floor(mainMin / 3));
      return `${warmup}\nMain: ${reps}x90 sec hard (${formatPaceRange(zones.interval)}) with 90 sec jog recovery\n${cooldown}\nShort and sharp — focus on quick turnover.`;
    }

    case "Race Pace Run":
      return `${warmup}\nMain: ${mainMin} min at goal race pace (${formatPaceRange(zones.tempo)})\n${cooldown}\nDial in your race-day rhythm.`;

    case "Medium-Long Run":
      return `Run at an easy-to-moderate pace.\nTarget: ${formatPaceRange(zones.longRun)}\nDuration: ${template.durationMinutes} min\nThis is volume maintenance — no heroics.`;

    default:
      return `Duration: ${template.durationMinutes} min\nTarget pace: ${formatPaceRange(zones.easy)}`;
  }
}

function buildBikeDescription(
  template: WorkoutTemplate,
  zones: PowerZones | null,
  ftp: number
): string {
  const hasZones = zones !== null;
  const z2Str = hasZones ? `${zones.z2.min}-${zones.z2.max}W` : "Zone 2";
  const z3Str = hasZones ? `${zones.z3.min}-${zones.z3.max}W` : "Zone 3 (Tempo)";
  const z4Str = hasZones ? `${zones.z4.min}-${zones.z4.max}W` : "Zone 4 (Threshold)";
  const z5Str = hasZones ? `${zones.z5.min}-${zones.z5.max}W` : "Zone 5 (VO2max)";
  const mainMin = Math.max(10, template.durationMinutes - 20);

  switch (template.title) {
    case "Long Endurance Ride":
    case "Long Ride":
      return `Ride at ${z2Str}\nDuration: ${template.durationMinutes} min\nMaintain steady cadence 85-95 rpm.\nFuel every 30 min on rides over 90 min.`;

    case "Endurance Ride":
    case "Easy Endurance Ride":
    case "Easy Ride":
      return `Ride at ${z2Str}\nDuration: ${template.durationMinutes} min\nKeep cadence smooth, stay in the aerobic zone.`;

    case "Recovery Ride":
    case "Recovery Spin":
    case "Easy Spin":
      return `Very easy spin.\nDuration: ${template.durationMinutes} min\nKeep power below Zone 2. High cadence, zero effort.`;

    case "Tempo Ride":
      return `Warmup: 10 min easy\nMain: ${mainMin} min at tempo (${z3Str})\nCooldown: 10 min easy\nSustained effort — cadence 85-95 rpm.`;

    case "Sweet Spot":
      return `Warmup: 10 min easy\nMain: 2x${Math.round(mainMin / 2)} min at 88-93% FTP (${Math.round(ftp * 0.88)}-${Math.round(ftp * 0.93)}W)\n  5 min Zone 1 recovery between intervals\nCooldown: 10 min easy`;

    case "VO2max Intervals":
      return `Warmup: 15 min progressive\nMain: 5x3 min at ${z5Str} with 3 min easy spin recovery\nCooldown: 10 min easy\nThese should hurt — full commitment each rep.`;

    case "Race Pace Long Ride":
    case "Race Simulation":
      return `Warmup: 10 min easy\nMain: ${mainMin} min at race effort (${z3Str} to ${z4Str})\nCooldown: 10 min easy\nPractice race nutrition and pacing.`;

    case "Short Sharp Intervals":
      return `Warmup: 15 min progressive\nMain: 8x1 min at ${z5Str} with 2 min recovery\nCooldown: 10 min easy\nExplosive but controlled.`;

    case "Short Openers":
      return `Easy ride with 4x30 sec sprints scattered throughout.\nTotal: ${template.durationMinutes} min\nKeep legs feeling snappy.`;

    default:
      return `Duration: ${template.durationMinutes} min\nTarget: ${z2Str}`;
  }
}

function buildSwimDescription(
  template: WorkoutTemplate,
  pacePer100m: number
): string {
  const easyPace = formatSwimPace(Math.round(pacePer100m * 1.15));
  const steadyPace = formatSwimPace(pacePer100m);
  const fastPace = formatSwimPace(Math.round(pacePer100m * 0.92));

  switch (template.title) {
    case "Swim Technique":
      return `Warmup: 200m easy (${easyPace})\nDrill: 4x100m drill/swim (catch-up, fingertip drag, fist drill)\nMain: 6x100m at ${steadyPace} with 15s rest\nCooldown: 200m easy pull`;

    case "Swim Endurance":
      return `Warmup: 300m easy\nMain: Continuous ${Math.round(template.durationMinutes * 0.7)} min at ${steadyPace}\nCooldown: 200m easy\nFocus on breathing rhythm and stroke count.`;

    case "Swim Speed":
    case "Swim Sharpening":
      return `Warmup: 300m easy\nMain: 8x50m at ${fastPace} with 20s rest, then 4x100m at ${steadyPace} with 15s rest\nCooldown: 200m easy\nTouch the wall hard on every rep.`;

    case "Easy Swim":
      return `Easy, technique-focused swim.\nDuration: ${template.durationMinutes} min\nTarget: ${easyPace}\nDrills + easy continuous swimming.`;

    default:
      return `Duration: ${template.durationMinutes} min\nTarget: ${steadyPace}`;
  }
}

function buildBrickDescription(
  template: WorkoutTemplate,
  runZones: PaceZones | null,
  bikeZones: PowerZones | null,
  ftp: number
): string {
  const bikeMin = Math.round(template.durationMinutes * 0.65);
  const runMin = Math.round(template.durationMinutes * 0.3);
  const bikeTarget = bikeZones ? `${bikeZones.z2.min}-${bikeZones.z3.max}W` : "Zone 2-3";
  const runTarget = runZones ? formatPaceRange(runZones.moderate) : "moderate effort";

  if (template.title.includes("Race Simulation")) {
    const bikeRace = bikeZones ? `${bikeZones.z3.min}-${bikeZones.z4.max}W` : "race effort";
    const runRace = runZones ? formatPaceRange(runZones.tempo) : "race pace";
    return `Bike: ${bikeMin} min at race effort (${bikeRace})\nTransition: Quick change (<3 min)\nRun: ${runMin} min at ${runRace}\nPractice transitions — lay out gear beforehand.`;
  }

  return `Bike: ${bikeMin} min at ${bikeTarget}\nTransition: Quick change (<5 min)\nRun: ${runMin} min at ${runTarget}\nFocus on finding your legs quickly off the bike.`;
}

function buildStrengthDescription(template: WorkoutTemplate): string {
  return `Functional strength for endurance athletes.\nDuration: ${template.durationMinutes} min\n\nCircuit (3 rounds):\n- Single-leg deadlift: 10 each side\n- Bulgarian split squats: 10 each side\n- Plank: 45 sec\n- Side plank: 30 sec each\n- Glute bridges: 15\n- Push-ups: 12\n\nFocus on control and stability over heavy load.`;
}

interface PrescriptionContext {
  runPaceZones: PaceZones | null;
  bikePowerZones: PowerZones | null;
  swimPacePer100m: number | null;
  bikeFtp: number;
  experienceLevel: string;
  easyPaceSec: number;
  bikeSpeedKmh: number;
}

function prescribeWorkout(
  template: WorkoutTemplate,
  ctx: PrescriptionContext,
  weekMeta: WeekMeta
): {
  title: string;
  description: string;
  duration_minutes: number;
  distance_meters: number | null;
  workout_type: string;
  target_zones: Record<string, unknown>;
  coach_notes: string;
} {
  let description = "";
  let distance_meters: number | null = null;

  const targetZones: Record<string, unknown> = {
    intensity: template.intensity,
  };

  switch (template.workoutType) {
    case "run":
      if (ctx.runPaceZones) {
        description = buildRunDescription(template, ctx.runPaceZones);
        targetZones.pace_zones = ctx.runPaceZones;
        // Estimate distance
        const paceMap: Record<string, number> = {
          easy: ctx.runPaceZones.easy.min,
          moderate: (ctx.runPaceZones.moderate.min + ctx.runPaceZones.moderate.max) / 2,
          hard: (ctx.runPaceZones.interval.min + ctx.runPaceZones.interval.max) / 2,
          max: ctx.runPaceZones.interval.min,
        };
        const avgPace = paceMap[template.intensity] || ctx.easyPaceSec;
        // For interval/tempo workouts, effective pace is slower (warmup/cooldown)
        const effectivePace =
          template.intensity === "easy"
            ? avgPace
            : avgPace * 0.7 + ctx.easyPaceSec * 0.3;
        distance_meters = estimateRunDistance(template.durationMinutes, effectivePace);
      } else {
        description = `${template.title}\nDuration: ${template.durationMinutes} min\nIntensity: ${template.intensity}`;
        distance_meters = estimateRunDistance(template.durationMinutes, ctx.easyPaceSec);
      }
      break;

    case "bike":
      if (ctx.bikePowerZones) {
        description = buildBikeDescription(template, ctx.bikePowerZones, ctx.bikeFtp);
        targetZones.power_zones = ctx.bikePowerZones;
        targetZones.ftp = ctx.bikeFtp;
      } else {
        description = buildBikeDescription(template, null, ctx.bikeFtp);
      }
      distance_meters = estimateBikeDistance(template.durationMinutes, ctx.bikeSpeedKmh);
      break;

    case "swim":
      if (ctx.swimPacePer100m) {
        description = buildSwimDescription(template, ctx.swimPacePer100m);
        targetZones.swim_pace_per_100m = ctx.swimPacePer100m;
      } else {
        const defaultPace = DEFAULT_SWIM_PACE[ctx.experienceLevel] ?? 115;
        description = buildSwimDescription(template, defaultPace);
      }
      distance_meters = estimateSwimDistance(
        template.durationMinutes,
        ctx.swimPacePer100m ?? DEFAULT_SWIM_PACE[ctx.experienceLevel] ?? 115
      );
      break;

    case "brick":
      description = buildBrickDescription(
        template,
        ctx.runPaceZones,
        ctx.bikePowerZones,
        ctx.bikeFtp
      );
      // Rough combo distance
      const bikeMin = Math.round(template.durationMinutes * 0.65);
      const runMin = Math.round(template.durationMinutes * 0.3);
      const bikeDist = estimateBikeDistance(bikeMin, ctx.bikeSpeedKmh);
      const runDist = estimateRunDistance(runMin, ctx.easyPaceSec);
      distance_meters = bikeDist + runDist;
      targetZones.bike = ctx.bikePowerZones ?? {};
      targetZones.run = ctx.runPaceZones ?? {};
      break;

    case "strength":
      description = buildStrengthDescription(template);
      distance_meters = null;
      break;

    case "rest":
      description = "Full rest day. Prioritize sleep, nutrition, and mobility work.";
      distance_meters = null;
      break;
  }

  // Placeholder coach_notes — will be replaced by AI-generated ones
  const phaseLabel = weekMeta.phaseName.charAt(0).toUpperCase() + weekMeta.phaseName.slice(1);
  const deloadNote = weekMeta.isDeload ? " (recovery week)" : "";
  const coach_notes = `Week ${weekMeta.weekInPhase + 1} of ${phaseLabel}${deloadNote}`;

  return {
    title: template.title,
    description,
    duration_minutes: template.durationMinutes,
    distance_meters,
    workout_type: template.workoutType,
    target_zones: targetZones,
    coach_notes,
  };
}

// ─── AI Coach Notes Generation ────────────────────────────────────────────────

interface WorkoutSummary {
  index: number;
  date: string;
  title: string;
  type: string;
  duration: number;
  intensity: string;
}

async function generateCoachNotesBatch(
  profile: AthleteProfile,
  weekMeta: WeekMeta,
  workouts: WorkoutSummary[]
): Promise<string[]> {
  if (workouts.length === 0) return [];

  try {
    const phaseName = weekMeta.phaseName.charAt(0).toUpperCase() + weekMeta.phaseName.slice(1);
    const deloadStr = weekMeta.isDeload ? " (recovery/deload week)" : "";
    const athleteName = profile.full_name || "Athlete";
    const experience = profile.experience_level || "intermediate";
    const sport = profile.primary_sport || "running";
    const race = profile.goal_race_type
      ? `${profile.goal_race_type} on ${profile.goal_race_date || "TBD"}`
      : "general fitness";

    const workoutList = workouts
      .map((w, i) => `${i + 1}. ${w.date} — ${w.title} (${w.type}, ${w.duration}min, ${w.intensity})`)
      .join("\n");

    const prompt = `You are an endurance coach writing brief, personalized training notes.

ATHLETE: ${athleteName}, ${experience} ${sport} athlete
GOAL: ${race}
PHASE: ${phaseName} — week ${weekMeta.weekInPhase + 1}${deloadStr}

WORKOUTS:
${workoutList}

For each workout, write 1-2 sentences of personalized coaching notes. Include:
- Why this workout matters in the current training phase
- A specific focus point or mental cue
- Brief encouragement appropriate for their experience level

Return a JSON array of strings, one note per workout, in the same order. Only the JSON array, no other text.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    // Handle { "notes": [...] } or direct [...]
    const notes: string[] = Array.isArray(parsed) ? parsed : parsed.notes || parsed.coaching_notes || [];

    // Pad or trim to match workout count
    while (notes.length < workouts.length) {
      notes.push(`${phaseName} phase${deloadStr} — stay consistent and trust the process.`);
    }
    return notes.slice(0, workouts.length);
  } catch (error) {
    console.error("Failed to generate coach notes:", error);
    // Return fallback notes
    return workouts.map(() => {
      const phase = weekMeta.phaseName.charAt(0).toUpperCase() + weekMeta.phaseName.slice(1);
      return `${phase} phase — trust the process and stay consistent.`;
    });
  }
}

// ─── Volume Target Calculation ────────────────────────────────────────────────

function getTargetWeeklyHours(profile: AthleteProfile): number {
  const available = profile.weekly_hours_available ?? 10;
  const raceKey = profile.goal_race_type?.toLowerCase().replace(/\s+/g, "_");

  if (raceKey && VOLUME_TARGETS[raceKey]) {
    const { minHours, maxHours } = VOLUME_TARGETS[raceKey];
    const expScale: Record<string, number> = {
      beginner: 0.2,
      intermediate: 0.5,
      advanced: 0.75,
      elite: 0.9,
    };
    const scale = expScale[profile.experience_level ?? "intermediate"] ?? 0.5;
    const target = minHours + (maxHours - minHours) * scale;
    return Math.min(target, available);
  }

  return available;
}

// ─── Main: Generate Plan ──────────────────────────────────────────────────────

export async function generatePlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  planId: string;
  workoutsCreated: number;
  phases: Phase[];
}> {
  // 1. Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to fetch profile for user ${userId}: ${profileError?.message}`);
  }

  const athlete = profile as AthleteProfile;
  // Use the user's timezone (if set) to determine "today" for scheduling
  const userTimezone = (profile as Record<string, unknown>).timezone as string | undefined;
  const todayStr = getUserToday(userTimezone);
  const today = new Date(todayStr + "T00:00:00Z");

  // Check if user specified a start date during onboarding
  const onboardingData = (profile as Record<string, unknown>).onboarding_data as Record<string, unknown> | null;
  const requestedStart = onboardingData?.startDate as string | undefined;

  let startDate: Date;
  if (requestedStart) {
    const requested = new Date(requestedStart + "T00:00:00Z");
    // Use requested date if it's today or in the future, otherwise start tomorrow
    if (requested >= today) {
      startDate = requested;
    } else {
      // Requested date is in the past — start tomorrow
      startDate = addDays(today, 1);
    }
  } else {
    // No start date specified — start tomorrow
    startDate = addDays(today, 1);
  }
  const raceDate = athlete.goal_race_date ? new Date(athlete.goal_race_date) : null;
  const sport = (athlete.primary_sport || "running") as "running" | "triathlon" | "cycling";
  const experience = athlete.experience_level || "intermediate";
  const availableDays = athlete.preferred_training_days || [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  // 2. Calculate targets and zones
  const weeklyHoursTarget = getTargetWeeklyHours(athlete);
  const easyPaceSec = athlete.run_pace_per_km ?? DEFAULT_EASY_PACE[experience] ?? 317;
  const ftp = athlete.bike_ftp ?? DEFAULT_FTP[experience] ?? 220;
  const swimPace = athlete.swim_pace_per_100m ?? null;
  const bikeSpeedKmh = CYCLING_SPEED_KMH[experience] ?? 27;

  const runPaceZones = calculateRunPaceZones(easyPaceSec);
  const bikePowerZones = ftp > 0 ? calculateBikePowerZones(ftp) : null;

  const prescriptionCtx: PrescriptionContext = {
    runPaceZones,
    bikePowerZones,
    swimPacePer100m: swimPace,
    bikeFtp: ftp,
    experienceLevel: experience,
    easyPaceSec,
    bikeSpeedKmh,
  };

  // 3. Calculate phases and week schedule
  const phases = calculatePhases(startDate, raceDate);
  const weekSchedule = buildWeekSchedule(phases);

  // 4. Determine preferences
  const prefs = (athlete.preferences || {}) as Record<string, unknown>;
  const templatePrefs = {
    longerWorkouts: (prefs.longer_workouts as string) || "weekends",
  };

  // 5. Build plan config for storage
  const planConfig: PlanConfig = {
    phases,
    weekSchedule,
    weeklyHoursTarget,
    sport,
    runPaceZones,
    bikePowerZones,
    swimPacePer100m: swimPace,
    experienceLevel: experience,
    availableDays: normalizeAvailableDays(availableDays),
    preferences: templatePrefs,
  };

  // 6. Create training_plan row
  const totalWeeks = weekSchedule.length;
  const endDate = raceDate || addDays(startDate, totalWeeks * 7);
  const planName = athlete.goal_race_type
    ? `${athlete.goal_race_type} Training Plan`
    : `${sport.charAt(0).toUpperCase() + sport.slice(1)} Training Plan`;

  const firstPhase = weekSchedule[0]?.phaseName || "base";

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: userId,
      name: planName,
      description: `${totalWeeks}-week periodized plan`,
      goal_race_date: athlete.goal_race_date || null,
      goal_race_type: athlete.goal_race_type || null,
      goal_finish_time: athlete.goal_finish_time || null,
      status: "active",
      plan_config: planConfig,
      starts_at: toISODate(startDate),
      ends_at: toISODate(endDate),
      total_weeks: totalWeeks,
      current_week: 1,
      current_phase: firstPhase,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    throw new Error(`Failed to create training plan: ${planError?.message}`);
  }

  const planId = plan.id as string;

  // 7. Generate workouts for first 2 weeks (14 days)
  const allWorkoutRows: Array<Record<string, unknown>> = [];
  const allWorkoutSummaries: WorkoutSummary[] = [];
  const weekMetasUsed: WeekMeta[] = [];
  const weekTemplateCounts: number[] = [];

  // Generate first 4 weeks of workouts up front (extended weekly by cron after that)
  for (let weekIdx = 0; weekIdx < 4 && weekIdx < weekSchedule.length; weekIdx++) {
    const weekMeta = weekSchedule[weekIdx];
    const weekVolume = weeklyHoursTarget * weekMeta.volumeMultiplier;
    const weekStart = addDays(getWeekStart(startDate), weekIdx * 7);

    const templates = buildWeekTemplate(
      sport,
      availableDays,
      weekVolume,
      weekMeta.phaseName,
      weekMeta.isDeload,
      templatePrefs
    );

    for (const tmpl of templates) {
      const dayOffset = DAY_ORDER.indexOf(tmpl.dayOfWeek);
      const scheduledDate = toISODate(addDays(weekStart, dayOffset));

      const prescribed = prescribeWorkout(tmpl, prescriptionCtx, weekMeta);

      // Apply progressive overload multiplier within the phase
      const weekProgressionMultiplier = getWeekProgressionMultiplier(weekMeta);
      if (weekProgressionMultiplier !== 1.0) {
        prescribed.duration_minutes = roundTo5(prescribed.duration_minutes * weekProgressionMultiplier);
        if (prescribed.distance_meters) {
          prescribed.distance_meters = Math.round(prescribed.distance_meters * weekProgressionMultiplier);
        }
      }

      allWorkoutRows.push({
        plan_id: planId,
        user_id: userId,
        scheduled_date: scheduledDate,
        workout_type: prescribed.workout_type,
        title: prescribed.title,
        description: prescribed.description,
        duration_minutes: prescribed.duration_minutes,
        distance_meters: prescribed.distance_meters,
        intensity: tmpl.intensity,
        target_zones: prescribed.target_zones,
        intervals: [],
        status: "scheduled",
        coach_notes: prescribed.coach_notes,
      });

      allWorkoutSummaries.push({
        index: allWorkoutSummaries.length,
        date: scheduledDate,
        title: prescribed.title,
        type: prescribed.workout_type,
        duration: prescribed.duration_minutes,
        intensity: tmpl.intensity,
      });
    }

    weekMetasUsed.push(weekMeta);
    weekTemplateCounts.push(templates.length);
  }

  // 8. Generate AI coach notes (batch)
  // Split summaries by week using tracked per-week template counts
  let summaryOffset = 0;
  for (let weekIdx = 0; weekIdx < weekMetasUsed.length; weekIdx++) {
    const weekMeta = weekMetasUsed[weekIdx];
    const count = weekTemplateCounts[weekIdx];
    const weekSummaries = allWorkoutSummaries.slice(summaryOffset, summaryOffset + count);
    if (weekSummaries.length > 0) {
      const notes = await generateCoachNotesBatch(athlete, weekMeta, weekSummaries);
      for (let i = 0; i < notes.length && summaryOffset + i < allWorkoutRows.length; i++) {
        allWorkoutRows[summaryOffset + i].coach_notes = notes[i];
      }
    }
    summaryOffset += count;
  }

  // 9. Insert all workouts
  if (allWorkoutRows.length > 0) {
    const { error: insertError } = await supabase
      .from("workouts")
      .insert(allWorkoutRows);

    if (insertError) {
      // Clean up plan if workouts fail
      await supabase.from("training_plans").delete().eq("id", planId);
      throw new Error(`Failed to insert workouts: ${insertError.message}`);
    }
  }

  console.log(
    `Generated plan ${planId} for user ${userId}: ${allWorkoutRows.length} workouts, ${phases.length} phases`
  );

  return {
    planId,
    workoutsCreated: allWorkoutRows.length,
    phases,
  };
}

// ─── Main: Extend Plan ────────────────────────────────────────────────────────

export async function extendPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  workoutsCreated: number;
}> {
  // 1. Fetch active plan
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (planError || !plan) {
    console.log(`No active plan for user ${userId}, skipping extend`);
    return { workoutsCreated: 0 };
  }

  const planConfig = plan.plan_config as PlanConfig | null;
  if (!planConfig || !planConfig.weekSchedule) {
    console.log(`Plan ${plan.id} has no config, skipping extend`);
    return { workoutsCreated: 0 };
  }

  // 2. Fetch profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    throw new Error(`Failed to fetch profile: ${profileErr?.message}`);
  }

  const athlete = profile as AthleteProfile;

  // 3. Find the last scheduled workout date
  const { data: lastWorkouts } = await supabase
    .from("workouts")
    .select("scheduled_date")
    .eq("plan_id", plan.id)
    .eq("status", "scheduled")
    .order("scheduled_date", { ascending: false })
    .limit(1);

  // Use the user's timezone for date calculations
  const userTimezone = (profile as Record<string, unknown>).timezone as string | undefined;
  const todayStr = getUserToday(userTimezone);
  const lastDate = lastWorkouts?.[0]?.scheduled_date
    ? new Date(lastWorkouts[0].scheduled_date as string)
    : new Date(todayStr + "T00:00:00Z");

  const nextWeekStart = addDays(getWeekStart(lastDate), 7);

  // Guard against duplicate workouts on retry — check if this week already has workouts
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const { data: existingNextWeek } = await supabase
    .from("workouts")
    .select("id")
    .eq("plan_id", plan.id)
    .gte("scheduled_date", toISODate(nextWeekStart))
    .lte("scheduled_date", toISODate(nextWeekEnd))
    .limit(1);

  if (existingNextWeek && existingNextWeek.length > 0) {
    console.log(`Plan ${plan.id} already has workouts for week starting ${toISODate(nextWeekStart)}, skipping`);
    return { workoutsCreated: 0 };
  }

  // 4. Determine which week of the plan this is
  const planStart = new Date(plan.starts_at as string);
  let weeksSinceStart = weeksBetween(planStart, nextWeekStart);

  // Handle beyond-schedule cases
  if (weeksSinceStart >= planConfig.weekSchedule.length) {
    if (plan.goal_race_date) {
      // Race plan is complete — don't extend beyond
      console.log(`Plan ${plan.id} has reached its end date, not extending`);
      return { workoutsCreated: 0 };
    }
    // Rolling plan: loop back
    weeksSinceStart = weeksSinceStart % planConfig.weekSchedule.length;
  }

  const weekMeta = planConfig.weekSchedule[weeksSinceStart] || planConfig.weekSchedule[planConfig.weekSchedule.length - 1];

  // 5. Build prescription context
  const experience = planConfig.experienceLevel || "intermediate";
  const easyPaceSec = athlete.run_pace_per_km ?? DEFAULT_EASY_PACE[experience] ?? 317;
  const ftp = athlete.bike_ftp ?? DEFAULT_FTP[experience] ?? 220;

  const prescriptionCtx: PrescriptionContext = {
    runPaceZones: planConfig.runPaceZones,
    bikePowerZones: planConfig.bikePowerZones,
    swimPacePer100m: planConfig.swimPacePer100m,
    bikeFtp: ftp,
    experienceLevel: experience,
    easyPaceSec,
    bikeSpeedKmh: CYCLING_SPEED_KMH[experience] ?? 27,
  };

  // 6. Build templates for the next week
  const weekVolume = planConfig.weeklyHoursTarget * weekMeta.volumeMultiplier;
  const sport = (planConfig.sport || "running") as "running" | "triathlon" | "cycling";
  const templates = buildWeekTemplate(
    sport,
    planConfig.availableDays,
    weekVolume,
    weekMeta.phaseName,
    weekMeta.isDeload,
    planConfig.preferences
  );

  // 7. Prescribe and prepare workout rows
  const workoutRows: Array<Record<string, unknown>> = [];
  const summaries: WorkoutSummary[] = [];

  for (const tmpl of templates) {
    const dayOffset = DAY_ORDER.indexOf(tmpl.dayOfWeek);
    const scheduledDate = toISODate(addDays(nextWeekStart, dayOffset));

    const prescribed = prescribeWorkout(tmpl, prescriptionCtx, weekMeta);

    // Apply progressive overload multiplier within the phase
    const weekProgressionMultiplier = getWeekProgressionMultiplier(weekMeta);
    if (weekProgressionMultiplier !== 1.0) {
      prescribed.duration_minutes = roundTo5(prescribed.duration_minutes * weekProgressionMultiplier);
      if (prescribed.distance_meters) {
        prescribed.distance_meters = Math.round(prescribed.distance_meters * weekProgressionMultiplier);
      }
    }

    workoutRows.push({
      plan_id: plan.id,
      user_id: userId,
      scheduled_date: scheduledDate,
      workout_type: prescribed.workout_type,
      title: prescribed.title,
      description: prescribed.description,
      duration_minutes: prescribed.duration_minutes,
      distance_meters: prescribed.distance_meters,
      intensity: tmpl.intensity,
      target_zones: prescribed.target_zones,
      intervals: [],
      status: "scheduled",
      coach_notes: prescribed.coach_notes,
    });

    summaries.push({
      index: summaries.length,
      date: scheduledDate,
      title: prescribed.title,
      type: prescribed.workout_type,
      duration: prescribed.duration_minutes,
      intensity: tmpl.intensity,
    });
  }

  // 8. Generate AI coach notes
  if (summaries.length > 0) {
    const notes = await generateCoachNotesBatch(athlete, weekMeta, summaries);
    for (let i = 0; i < notes.length && i < workoutRows.length; i++) {
      workoutRows[i].coach_notes = notes[i];
    }
  }

  // 9. Insert workouts
  if (workoutRows.length > 0) {
    const { error: insertError } = await supabase
      .from("workouts")
      .insert(workoutRows);

    if (insertError) {
      throw new Error(`Failed to insert extended workouts: ${insertError.message}`);
    }
  }

  console.log(
    `Extended plan ${plan.id} for user ${userId}: +${workoutRows.length} workouts (week ${weekMeta.weekNumber}, ${weekMeta.phaseName}${weekMeta.isDeload ? " deload" : ""})`
  );

  return { workoutsCreated: workoutRows.length };
}

// ─── Phase Tracking ───────────────────────────────────────────────────────────

/**
 * Update `current_week` and `current_phase` on a training plan.
 * Calculates the current position based on `starts_at` and today's date,
 * then determines which phase the athlete is in from the stored plan config.
 */
export async function updatePlanPhase(
  supabase: SupabaseClient,
  planId: string
): Promise<void> {
  const { data: plan, error } = await supabase
    .from("training_plans")
    .select("plan_config, starts_at")
    .eq("id", planId)
    .single();

  if (error || !plan) {
    console.log(`updatePlanPhase: plan ${planId} not found`);
    return;
  }

  const planConfig = plan.plan_config as PlanConfig | null;
  if (!planConfig?.phases || planConfig.phases.length === 0) {
    console.log(`updatePlanPhase: plan ${planId} has no phase config`);
    return;
  }

  const startsAt = new Date(plan.starts_at as string);
  const now = new Date();
  const currentWeek = Math.max(0, weeksBetween(startsAt, now));

  // Determine current phase from week number and phase boundaries
  let currentPhase: string = planConfig.phases[planConfig.phases.length - 1].name;
  for (const phase of planConfig.phases) {
    if (currentWeek >= phase.startWeek && currentWeek < phase.startWeek + phase.weeks) {
      currentPhase = phase.name;
      break;
    }
  }

  await supabase
    .from("training_plans")
    .update({ current_week: currentWeek, current_phase: currentPhase })
    .eq("id", planId);

  console.log(
    `updatePlanPhase: plan ${planId} → week ${currentWeek}, phase ${currentPhase}`
  );
}
