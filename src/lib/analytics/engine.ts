/**
 * Core Workout Analytics Engine
 *
 * Processes raw Strava activity + stream data into structured metrics
 * for running, cycling, swimming, and brick workouts.
 */

import {
  StravaStream,
  hasHeartRateData,
  hasPowerData,
  hasAltitudeData,
  hasCadenceData,
} from "./strava-streams";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserZones {
  maxHr?: number;
  lthr?: number;     // Lactate threshold HR
  ftp?: number;      // Functional threshold power (watts)
  easyPace?: number; // sec/km
  thresholdPace?: number; // sec/km
  swimCss?: number;  // sec/100m critical swim speed
}

export interface HrZoneDistribution {
  z1: number; // % time
  z2: number;
  z3: number;
  z4: number;
  z5: number;
}

export interface PowerZoneDistribution {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  z6: number;
}

export interface PaceZoneDistribution {
  z1_recovery: number;
  z2_easy: number;
  z3_tempo: number;
  z4_threshold: number;
  z5_interval: number;
}

export interface SplitData {
  km: number;
  pace: number;       // sec/km
  hr: number | null;   // avg HR for this split
  elevation: number | null; // net elevation change
  cadence: number | null;
}

export interface WorkoutAnalytics {
  // Zone distributions
  hrZones: HrZoneDistribution | null;
  paceZones: PaceZoneDistribution | null;
  powerZones: PowerZoneDistribution | null;

  // Core metrics
  trainingStressScore: number | null;
  intensityFactor: number | null;
  normalizedPower: number | null;
  normalizedGradedPace: number | null;
  variabilityIndex: number | null;
  efficiencyFactor: number | null;

  // Decoupling
  aerobicDecoupling: number | null;

  // Splits
  splits: SplitData[];

  // Compliance
  zoneComplianceScore: number | null;
  zoneComplianceDetails: Record<string, unknown>;

  // Cadence
  avgCadence: number | null;
  cadenceVariability: number | null;

  // Elevation
  totalAscent: number | null;
  totalDescent: number | null;
  gradeAdjustedPace: number | null;

  // Running
  trimp: number | null;
}

// ─── HR Zone Helpers ──────────────────────────────────────────────────────────

function getHrZoneBoundaries(maxHr: number): number[] {
  // Returns boundaries: [z1_max, z2_max, z3_max, z4_max]
  return [
    Math.round(maxHr * 0.6),  // Z1 < 60%
    Math.round(maxHr * 0.7),  // Z2 60-70%
    Math.round(maxHr * 0.8),  // Z3 70-80%
    Math.round(maxHr * 0.9),  // Z4 80-90%
    // Z5 > 90%
  ];
}

function classifyHrZone(hr: number, boundaries: number[]): number {
  if (hr < boundaries[0]) return 1;
  if (hr < boundaries[1]) return 2;
  if (hr < boundaries[2]) return 3;
  if (hr < boundaries[3]) return 4;
  return 5;
}

function calculateHrZoneDistribution(
  heartrate: number[],
  time: number[],
  maxHr: number
): HrZoneDistribution {
  const boundaries = getHrZoneBoundaries(maxHr);
  const zoneTimes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  let totalTime = 0;

  for (let i = 1; i < heartrate.length; i++) {
    if (heartrate[i] <= 0) continue;
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > 30) continue; // skip gaps
    const zone = classifyHrZone(heartrate[i], boundaries);
    const key = `z${zone}` as keyof HrZoneDistribution;
    zoneTimes[key] += dt;
    totalTime += dt;
  }

  if (totalTime === 0) {
    return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  }

  return {
    z1: round2((zoneTimes.z1 / totalTime) * 100),
    z2: round2((zoneTimes.z2 / totalTime) * 100),
    z3: round2((zoneTimes.z3 / totalTime) * 100),
    z4: round2((zoneTimes.z4 / totalTime) * 100),
    z5: round2((zoneTimes.z5 / totalTime) * 100),
  };
}

// ─── Power Zone Helpers ───────────────────────────────────────────────────────

function getPowerZoneBoundaries(ftp: number): number[] {
  return [
    Math.round(ftp * 0.55),  // Z1 < 55%
    Math.round(ftp * 0.75),  // Z2 55-75%
    Math.round(ftp * 0.90),  // Z3 75-90%
    Math.round(ftp * 1.05),  // Z4 90-105%
    Math.round(ftp * 1.20),  // Z5 105-120%
    // Z6 > 120%
  ];
}

function classifyPowerZone(watts: number, boundaries: number[]): number {
  if (watts < boundaries[0]) return 1;
  if (watts < boundaries[1]) return 2;
  if (watts < boundaries[2]) return 3;
  if (watts < boundaries[3]) return 4;
  if (watts < boundaries[4]) return 5;
  return 6;
}

function calculatePowerZoneDistribution(
  watts: number[],
  time: number[],
  ftp: number
): PowerZoneDistribution {
  const boundaries = getPowerZoneBoundaries(ftp);
  const zoneTimes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
  let totalTime = 0;

  for (let i = 1; i < watts.length; i++) {
    if (watts[i] < 0) continue;
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > 30) continue;
    const zone = classifyPowerZone(watts[i], boundaries);
    const key = `z${zone}` as keyof PowerZoneDistribution;
    zoneTimes[key] += dt;
    totalTime += dt;
  }

  if (totalTime === 0) {
    return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
  }

  return {
    z1: round2((zoneTimes.z1 / totalTime) * 100),
    z2: round2((zoneTimes.z2 / totalTime) * 100),
    z3: round2((zoneTimes.z3 / totalTime) * 100),
    z4: round2((zoneTimes.z4 / totalTime) * 100),
    z5: round2((zoneTimes.z5 / totalTime) * 100),
    z6: round2((zoneTimes.z6 / totalTime) * 100),
  };
}

// ─── Pace Zone Helpers ────────────────────────────────────────────────────────

function getPaceZoneBoundaries(easyPace: number): number[] {
  // Pace zones in sec/km (note: slower = higher number)
  // Returns: [recovery_min, easy_min, tempo_min, threshold_min]
  // (these are the FAST end of each zone — lower sec/km = faster)
  return [
    Math.round(easyPace * 1.15), // Recovery slower than this
    easyPace,                     // Easy zone boundary
    Math.round(easyPace * 0.88), // Tempo
    Math.round(easyPace * 0.82), // Threshold
    // Interval: faster than threshold
  ];
}

function classifyPaceZone(paceSecPerKm: number, boundaries: number[]): number {
  // Slower = higher number, so zone classification is inverted
  if (paceSecPerKm > boundaries[0]) return 1; // Recovery (very slow)
  if (paceSecPerKm > boundaries[1]) return 2; // Easy
  if (paceSecPerKm > boundaries[2]) return 3; // Tempo
  if (paceSecPerKm > boundaries[3]) return 4; // Threshold
  return 5; // Interval (very fast)
}

function calculatePaceZoneDistribution(
  velocity: number[],
  time: number[],
  easyPace: number
): PaceZoneDistribution {
  const boundaries = getPaceZoneBoundaries(easyPace);
  const zoneTimes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  let totalTime = 0;

  for (let i = 1; i < velocity.length; i++) {
    if (velocity[i] <= 0.5) continue; // Skip near-zero velocity (standing still)
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > 30) continue;
    const paceSecPerKm = 1000 / velocity[i];
    const zone = classifyPaceZone(paceSecPerKm, boundaries);
    const key = `z${zone}` as keyof typeof zoneTimes;
    zoneTimes[key] += dt;
    totalTime += dt;
  }

  if (totalTime === 0) {
    return { z1_recovery: 0, z2_easy: 0, z3_tempo: 0, z4_threshold: 0, z5_interval: 0 };
  }

  return {
    z1_recovery: round2((zoneTimes.z1 / totalTime) * 100),
    z2_easy: round2((zoneTimes.z2 / totalTime) * 100),
    z3_tempo: round2((zoneTimes.z3 / totalTime) * 100),
    z4_threshold: round2((zoneTimes.z4 / totalTime) * 100),
    z5_interval: round2((zoneTimes.z5 / totalTime) * 100),
  };
}

// ─── Normalized Power (Cycling) ───────────────────────────────────────────────

function calculateNormalizedPower(watts: number[], time: number[]): number | null {
  if (watts.length < 30) return null;

  // 1. Calculate 30-second rolling average power
  const rollingAvg: number[] = [];
  let windowSum = 0;
  const windowSize = 30;

  for (let i = 0; i < watts.length; i++) {
    windowSum += watts[i];
    if (i >= windowSize) {
      windowSum -= watts[i - windowSize];
    }
    if (i >= windowSize - 1) {
      rollingAvg.push(windowSum / windowSize);
    }
  }

  if (rollingAvg.length === 0) return null;

  // 2. Raise each value to the 4th power
  let sum4th = 0;
  for (const val of rollingAvg) {
    sum4th += Math.pow(val, 4);
  }

  // 3. Average, then take 4th root
  const np = Math.pow(sum4th / rollingAvg.length, 0.25);
  return round2(np);
}

// ─── Grade Adjusted Pace (Running) ───────────────────────────────────────────

function calculateGradeAdjustedPace(
  velocity: number[],
  altitude: number[],
  distance: number[],
  time: number[]
): number | null {
  if (velocity.length < 10 || altitude.length < 10) return null;

  let totalGapTime = 0;
  let totalDistance = 0;

  for (let i = 1; i < velocity.length; i++) {
    if (velocity[i] <= 0.5) continue;
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > 30) continue;

    const dDist = distance[i] - distance[i - 1];
    if (dDist <= 0) continue;

    const grade = (altitude[i] - altitude[i - 1]) / dDist;
    // Minetti cost factor approximation
    const costFactor = 1 + 3.5 * grade;
    const adjustedSpeed = velocity[i] / Math.max(0.3, costFactor);
    const adjustedTime = dDist / adjustedSpeed;

    totalGapTime += adjustedTime;
    totalDistance += dDist;
  }

  if (totalDistance < 100) return null;

  // Return GAP in sec/km
  return round2((totalGapTime / totalDistance) * 1000);
}

// ─── Aerobic Decoupling ──────────────────────────────────────────────────────

function calculateAerobicDecoupling(
  velocity: number[],
  heartrate: number[],
  time: number[],
  type: "run" | "bike",
  watts?: number[]
): number | null {
  if (heartrate.length < 20) return null;

  const totalTime = time[time.length - 1] - time[0];
  const midpoint = time[0] + totalTime / 2;

  let firstHalfOutputSum = 0, firstHalfHrSum = 0, firstHalfCount = 0;
  let secondHalfOutputSum = 0, secondHalfHrSum = 0, secondHalfCount = 0;

  for (let i = 0; i < heartrate.length; i++) {
    if (heartrate[i] <= 0) continue;
    const output = type === "bike" && watts && watts[i] > 0
      ? watts[i]
      : velocity[i] > 0.5 ? velocity[i] : 0;

    if (output <= 0) continue;

    if (time[i] < midpoint) {
      firstHalfOutputSum += output;
      firstHalfHrSum += heartrate[i];
      firstHalfCount++;
    } else {
      secondHalfOutputSum += output;
      secondHalfHrSum += heartrate[i];
      secondHalfCount++;
    }
  }

  if (firstHalfCount < 10 || secondHalfCount < 10) return null;

  const firstRatio = (firstHalfOutputSum / firstHalfCount) / (firstHalfHrSum / firstHalfCount);
  const secondRatio = (secondHalfOutputSum / secondHalfCount) / (secondHalfHrSum / secondHalfCount);

  if (firstRatio === 0) return null;

  // Positive = HR drifted up relative to output (bad)
  const decoupling = ((firstRatio - secondRatio) / firstRatio) * 100;
  return round2(decoupling);
}

// ─── Efficiency Factor ────────────────────────────────────────────────────────

function calculateEfficiencyFactor(
  avgOutput: number,
  avgHr: number
): number | null {
  if (avgHr <= 0 || avgOutput <= 0) return null;
  return round2(avgOutput / avgHr);
}

// ─── TRIMP (Training Impulse) ─────────────────────────────────────────────────

function calculateTrimp(
  heartrate: number[],
  time: number[],
  maxHr: number,
  restingHr: number = 50,
  gender: "male" | "female" = "male"
): number | null {
  if (heartrate.length < 10) return null;

  const hrReserve = maxHr - restingHr;
  if (hrReserve <= 0) return null;

  const k = gender === "male" ? 1.92 : 1.67;
  let trimp = 0;

  for (let i = 1; i < heartrate.length; i++) {
    if (heartrate[i] <= 0) continue;
    const dt = (time[i] - time[i - 1]) / 60; // minutes
    if (dt <= 0 || dt > 0.5) continue;

    const hrr = (heartrate[i] - restingHr) / hrReserve;
    const hrFraction = Math.max(0, Math.min(1, hrr));
    trimp += dt * hrFraction * 0.64 * Math.exp(k * hrFraction);
  }

  return round2(trimp);
}

// ─── Running TSS (rTSS) ──────────────────────────────────────────────────────

function calculateRunningTSS(
  durationSeconds: number,
  normalizedGradedPace: number | null,
  thresholdPace: number
): number | null {
  if (!normalizedGradedPace || thresholdPace <= 0) return null;

  // NGP intensity factor
  const intensityFactor = thresholdPace / normalizedGradedPace; // faster pace = higher IF
  const tss = (durationSeconds * intensityFactor * intensityFactor) / (thresholdPace * 3600) * 100;
  return round2(Math.max(0, tss));
}

// ─── Cycling TSS ──────────────────────────────────────────────────────────────

function calculateCyclingTSS(
  durationSeconds: number,
  normalizedPower: number,
  ftp: number
): number | null {
  if (ftp <= 0 || normalizedPower <= 0) return null;

  const intensityFactor = normalizedPower / ftp;
  const tss = (durationSeconds * normalizedPower * intensityFactor) / (ftp * 3600) * 100;
  return round2(tss);
}

// ─── Split Analysis ───────────────────────────────────────────────────────────

function calculateSplits(
  velocity: number[],
  distance: number[],
  time: number[],
  heartrate: number[],
  altitude: number[]
): SplitData[] {
  if (distance.length < 10) return [];

  const splits: SplitData[] = [];
  let currentKm = 1;
  let splitStartIdx = 0;

  for (let i = 1; i < distance.length; i++) {
    const km = distance[i] / 1000;
    if (km >= currentKm) {
      // Calculate split metrics
      const splitTime = time[i] - time[splitStartIdx];
      const splitDist = distance[i] - distance[splitStartIdx];
      const pace = splitDist > 0 ? (splitTime / splitDist) * 1000 : 0;

      // Average HR for split
      let hrSum = 0, hrCount = 0;
      for (let j = splitStartIdx; j <= i; j++) {
        if (heartrate[j] > 0) {
          hrSum += heartrate[j];
          hrCount++;
        }
      }

      // Elevation for split
      let elevChange: number | null = null;
      if (altitude.length > i) {
        elevChange = round2(altitude[i] - altitude[splitStartIdx]);
      }

      // Cadence for split
      splits.push({
        km: currentKm,
        pace: round2(pace),
        hr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
        elevation: elevChange,
        cadence: null, // Could add cadence analysis per split
      });

      currentKm++;
      splitStartIdx = i;
    }
  }

  return splits;
}

// ─── Cadence Analysis ─────────────────────────────────────────────────────────

function calculateCadenceStats(
  cadence: number[],
  time: number[]
): { avg: number; variability: number } | null {
  const validCadence: number[] = [];
  for (let i = 0; i < cadence.length; i++) {
    if (cadence[i] > 0) {
      validCadence.push(cadence[i]);
    }
  }

  if (validCadence.length < 10) return null;

  const avg = validCadence.reduce((s, c) => s + c, 0) / validCadence.length;
  const variance = validCadence.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / validCadence.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avg) * 100; // coefficient of variation

  return {
    avg: round2(avg),
    variability: round2(cv),
  };
}

// ─── Elevation Analysis ──────────────────────────────────────────────────────

function calculateElevation(
  altitude: number[]
): { ascent: number; descent: number } | null {
  if (altitude.length < 10) return null;

  // Smooth altitude data to reduce noise (simple 5-point moving average)
  const smoothed: number[] = [];
  for (let i = 0; i < altitude.length; i++) {
    const start = Math.max(0, i - 2);
    const end = Math.min(altitude.length - 1, i + 2);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += altitude[j];
    smoothed.push(sum / (end - start + 1));
  }

  let ascent = 0;
  let descent = 0;
  const threshold = 1; // Minimum 1m change to count

  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - smoothed[i - 1];
    if (diff > threshold) ascent += diff;
    else if (diff < -threshold) descent += Math.abs(diff);
  }

  return { ascent: round2(ascent), descent: round2(descent) };
}

// ─── Zone Compliance ──────────────────────────────────────────────────────────

export function calculateZoneCompliance(
  actualZones: HrZoneDistribution | PaceZoneDistribution | PowerZoneDistribution | null,
  prescribedIntensity: string
): { score: number; details: Record<string, unknown> } {
  if (!actualZones) return { score: 50, details: { reason: "no zone data available" } };

  // Map prescribed intensity to expected zone distribution
  const expectedDistributions: Record<string, Record<string, number>> = {
    easy: { z1: 20, z2: 60, z3: 15, z4: 5, z5: 0 },
    moderate: { z1: 5, z2: 30, z3: 45, z4: 15, z5: 5 },
    hard: { z1: 5, z2: 15, z3: 25, z4: 35, z5: 20 },
    max: { z1: 0, z2: 10, z3: 15, z4: 30, z5: 45 },
  };

  const expected = expectedDistributions[prescribedIntensity] || expectedDistributions.moderate;
  const actual = actualZones as unknown as Record<string, number>;

  // Normalize actual zone keys (handle both z1 and z1_recovery style)
  const normalizedActual: Record<string, number> = {};
  for (const [key, val] of Object.entries(actual)) {
    const zoneNum = key.match(/z(\d)/)?.[1];
    if (zoneNum) {
      normalizedActual[`z${zoneNum}`] = (normalizedActual[`z${zoneNum}`] || 0) + val;
    }
  }

  // Calculate weighted deviation
  let totalDeviation = 0;
  const details: Record<string, unknown> = {};

  for (const zone of Object.keys(expected)) {
    const exp = expected[zone] || 0;
    const act = normalizedActual[zone] || 0;
    const diff = Math.abs(act - exp);
    totalDeviation += diff;
    details[zone] = { expected: exp, actual: round2(act), diff: round2(diff) };
  }

  // Max possible deviation = 200 (all time in wrong zone)
  // Score: 100 = perfect compliance, 0 = completely off
  const score = Math.max(0, Math.min(100, round2(100 - (totalDeviation / 2))));

  return { score, details };
}

// ─── Swimming Analytics ───────────────────────────────────────────────────────

export interface SwimAnalytics {
  pacePer100m: number | null;
  estimatedCss: number | null;
  swolfScore: number | null;
  intervalAnalysis: Array<{ intervalNum: number; distance: number; pace: number; rest: number }>;
}

function analyzeSwimWorkout(
  streams: StravaStream | null,
  activity: { distance: number; moving_time: number; average_speed?: number }
): SwimAnalytics {
  const result: SwimAnalytics = {
    pacePer100m: null,
    estimatedCss: null,
    swolfScore: null,
    intervalAnalysis: [],
  };

  if (activity.distance > 0 && activity.moving_time > 0) {
    result.pacePer100m = round2((activity.moving_time / activity.distance) * 100);
  }

  if (!streams || streams.velocity_smooth.length < 10) return result;

  // Detect intervals by finding rest periods (velocity near zero)
  const intervals: Array<{ startIdx: number; endIdx: number }> = [];
  let inInterval = false;
  let intervalStart = 0;

  for (let i = 0; i < streams.velocity_smooth.length; i++) {
    const isMoving = streams.velocity_smooth[i] > 0.3;

    if (isMoving && !inInterval) {
      inInterval = true;
      intervalStart = i;
    } else if (!isMoving && inInterval) {
      inInterval = false;
      const duration = streams.time[i] - streams.time[intervalStart];
      if (duration > 20) { // Minimum 20s to count as an interval
        intervals.push({ startIdx: intervalStart, endIdx: i });
      }
    }
  }

  // Handle last interval if still going
  if (inInterval) {
    const lastIdx = streams.velocity_smooth.length - 1;
    const duration = streams.time[lastIdx] - streams.time[intervalStart];
    if (duration > 20) {
      intervals.push({ startIdx: intervalStart, endIdx: lastIdx });
    }
  }

  // Analyze each interval
  for (let n = 0; n < intervals.length; n++) {
    const { startIdx, endIdx } = intervals[n];
    const distance = streams.distance[endIdx] - streams.distance[startIdx];
    const time = streams.time[endIdx] - streams.time[startIdx];
    const pace = distance > 0 ? (time / distance) * 100 : 0;

    // Rest between this and next interval
    let rest = 0;
    if (n < intervals.length - 1) {
      rest = streams.time[intervals[n + 1].startIdx] - streams.time[endIdx];
    }

    result.intervalAnalysis.push({
      intervalNum: n + 1,
      distance: round2(distance),
      pace: round2(pace),
      rest: round2(rest),
    });
  }

  // Estimate CSS from best intervals (simplified: fastest 400m equivalent pace)
  if (result.intervalAnalysis.length >= 2) {
    const sortedByPace = [...result.intervalAnalysis]
      .filter((i) => i.distance >= 100)
      .sort((a, b) => a.pace - b.pace);

    if (sortedByPace.length >= 2) {
      // CSS approximation: average of fastest sustained efforts
      const fastestPaces = sortedByPace.slice(0, Math.min(3, sortedByPace.length));
      result.estimatedCss = round2(
        fastestPaces.reduce((s, i) => s + i.pace, 0) / fastestPaces.length
      );
    }
  }

  // SWOLF estimate if cadence available
  if (hasCadenceData(streams) && result.pacePer100m) {
    const avgStrokes = streams.cadence.filter((c) => c > 0);
    if (avgStrokes.length > 0) {
      const avgStrokeRate = avgStrokes.reduce((s, c) => s + c, 0) / avgStrokes.length;
      // SWOLF for 25m pool: time for 25m + strokes for 25m
      const timePer25m = (result.pacePer100m / 100) * 25;
      const strokesPer25m = (avgStrokeRate / 60) * timePer25m;
      result.swolfScore = round2(timePer25m + strokesPer25m);
    }
  }

  return result;
}

// ─── Brick Workout Analysis ──────────────────────────────────────────────────

export interface BrickAnalytics {
  bikePhase: { duration: number; avgPower: number | null; avgHr: number | null };
  runPhase: { duration: number; avgPace: number | null; avgHr: number | null };
  transitionTime: number | null;
  runPaceStabilizationTime: number | null; // seconds until run pace stabilizes after bike
  combinedTSS: number | null;
}

// ─── Main Analysis Functions ──────────────────────────────────────────────────

/**
 * Analyze a running workout
 */
export function analyzeRunning(
  streams: StravaStream | null,
  activity: {
    distance: number;
    moving_time: number;
    elapsed_time: number;
    average_heartrate?: number;
    max_heartrate?: number;
    total_elevation_gain?: number;
    average_speed?: number;
  },
  zones: UserZones
): WorkoutAnalytics {
  const result = createEmptyAnalytics();
  const maxHr = zones.maxHr || 190;
  const easyPace = zones.easyPace || 320;
  const thresholdPace = zones.thresholdPace || Math.round(easyPace * 0.82);

  if (!streams) {
    // Summary-only analysis from activity data
    if (activity.average_heartrate && activity.average_heartrate > 0) {
      result.efficiencyFactor = calculateEfficiencyFactor(
        activity.average_speed || 0,
        activity.average_heartrate
      );
    }
    result.totalAscent = activity.total_elevation_gain || null;
    return result;
  }

  const hasHr = hasHeartRateData(streams);
  const hasAlt = hasAltitudeData(streams);
  const hasCad = hasCadenceData(streams);

  // HR zones
  if (hasHr) {
    result.hrZones = calculateHrZoneDistribution(streams.heartrate, streams.time, maxHr);
    result.trimp = calculateTrimp(streams.heartrate, streams.time, maxHr);

    // Aerobic decoupling
    result.aerobicDecoupling = calculateAerobicDecoupling(
      streams.velocity_smooth,
      streams.heartrate,
      streams.time,
      "run"
    );
  }

  // Pace zones
  if (streams.velocity_smooth.length > 0) {
    result.paceZones = calculatePaceZoneDistribution(
      streams.velocity_smooth,
      streams.time,
      easyPace
    );
  }

  // Grade adjusted pace
  if (hasAlt && streams.distance.length > 0) {
    result.gradeAdjustedPace = calculateGradeAdjustedPace(
      streams.velocity_smooth,
      streams.altitude,
      streams.distance,
      streams.time
    );
    result.normalizedGradedPace = result.gradeAdjustedPace;
  } else if (activity.average_speed && activity.average_speed > 0) {
    // Fallback: use average pace as NGP
    result.normalizedGradedPace = round2(1000 / activity.average_speed);
  }

  // Efficiency factor
  const avgHr = hasHr
    ? streams.heartrate.filter((h) => h > 0).reduce((s, h) => s + h, 0) /
      streams.heartrate.filter((h) => h > 0).length
    : activity.average_heartrate || 0;

  if (result.normalizedGradedPace && avgHr > 0) {
    // EF for running: speed / HR (higher = more efficient)
    const ngpSpeed = 1000 / result.normalizedGradedPace;
    result.efficiencyFactor = calculateEfficiencyFactor(ngpSpeed * 100, avgHr);
  }

  // Running TSS
  result.trainingStressScore = calculateRunningTSS(
    activity.moving_time,
    result.normalizedGradedPace,
    thresholdPace
  );

  if (result.normalizedGradedPace && thresholdPace > 0) {
    result.intensityFactor = round2(thresholdPace / result.normalizedGradedPace);
  }

  // Splits
  result.splits = calculateSplits(
    streams.velocity_smooth,
    streams.distance,
    streams.time,
    streams.heartrate,
    streams.altitude
  );

  // Cadence
  if (hasCad) {
    const cadStats = calculateCadenceStats(streams.cadence, streams.time);
    if (cadStats) {
      result.avgCadence = cadStats.avg;
      result.cadenceVariability = cadStats.variability;
    }
  }

  // Elevation
  if (hasAlt) {
    const elev = calculateElevation(streams.altitude);
    if (elev) {
      result.totalAscent = elev.ascent;
      result.totalDescent = elev.descent;
    }
  }

  return result;
}

/**
 * Analyze a cycling workout
 */
export function analyzeCycling(
  streams: StravaStream | null,
  activity: {
    distance: number;
    moving_time: number;
    elapsed_time: number;
    average_heartrate?: number;
    max_heartrate?: number;
    total_elevation_gain?: number;
    average_watts?: number;
    weighted_average_watts?: number;
  },
  zones: UserZones
): WorkoutAnalytics {
  const result = createEmptyAnalytics();
  const maxHr = zones.maxHr || 190;
  const ftp = zones.ftp || 200;

  if (!streams) {
    // Summary-only analysis
    if (activity.weighted_average_watts || activity.average_watts) {
      const np = activity.weighted_average_watts || activity.average_watts || 0;
      result.normalizedPower = np;
      result.intensityFactor = round2(np / ftp);
      result.trainingStressScore = calculateCyclingTSS(activity.moving_time, np, ftp);

      if (activity.average_watts && np > 0) {
        result.variabilityIndex = round2(np / activity.average_watts);
      }
    }
    result.totalAscent = activity.total_elevation_gain || null;
    return result;
  }

  const hasHr = hasHeartRateData(streams);
  const hasPwr = hasPowerData(streams);
  const hasCad = hasCadenceData(streams);
  const hasAlt = hasAltitudeData(streams);

  // Power analysis
  if (hasPwr) {
    result.powerZones = calculatePowerZoneDistribution(streams.watts, streams.time, ftp);
    result.normalizedPower = calculateNormalizedPower(streams.watts, streams.time);

    if (result.normalizedPower) {
      result.intensityFactor = round2(result.normalizedPower / ftp);
      result.trainingStressScore = calculateCyclingTSS(
        activity.moving_time,
        result.normalizedPower,
        ftp
      );

      // Variability index
      const avgPower = streams.watts.filter((w) => w > 0).reduce((s, w) => s + w, 0) /
        Math.max(1, streams.watts.filter((w) => w > 0).length);
      if (avgPower > 0) {
        result.variabilityIndex = round2(result.normalizedPower / avgPower);
      }
    }
  }

  // HR zones
  if (hasHr) {
    result.hrZones = calculateHrZoneDistribution(streams.heartrate, streams.time, maxHr);
    result.trimp = calculateTrimp(streams.heartrate, streams.time, maxHr);

    // Efficiency factor: NP / avg HR
    const avgHr = streams.heartrate.filter((h) => h > 0).reduce((s, h) => s + h, 0) /
      Math.max(1, streams.heartrate.filter((h) => h > 0).length);

    if (result.normalizedPower && avgHr > 0) {
      result.efficiencyFactor = calculateEfficiencyFactor(result.normalizedPower, avgHr);
    }

    // Power:HR decoupling
    if (hasPwr) {
      result.aerobicDecoupling = calculateAerobicDecoupling(
        streams.velocity_smooth,
        streams.heartrate,
        streams.time,
        "bike",
        streams.watts
      );
    }
  }

  // Cadence
  if (hasCad) {
    const cadStats = calculateCadenceStats(streams.cadence, streams.time);
    if (cadStats) {
      result.avgCadence = cadStats.avg;
      result.cadenceVariability = cadStats.variability;
    }
  }

  // Elevation
  if (hasAlt) {
    const elev = calculateElevation(streams.altitude);
    if (elev) {
      result.totalAscent = elev.ascent;
      result.totalDescent = elev.descent;
    }
  }

  return result;
}

/**
 * Analyze a swimming workout
 */
export function analyzeSwimming(
  streams: StravaStream | null,
  activity: {
    distance: number;
    moving_time: number;
    elapsed_time: number;
    average_heartrate?: number;
    average_speed?: number;
  },
  zones: UserZones
): WorkoutAnalytics {
  const result = createEmptyAnalytics();
  const maxHr = zones.maxHr || 190;

  const swimData = analyzeSwimWorkout(streams, activity);

  // Convert swim-specific metrics into WorkoutAnalytics
  if (swimData.pacePer100m) {
    result.normalizedGradedPace = swimData.pacePer100m; // Using NGP field for swim pace/100m
  }

  // HR zones from streams
  if (streams && hasHeartRateData(streams)) {
    result.hrZones = calculateHrZoneDistribution(streams.heartrate, streams.time, maxHr);
    result.trimp = calculateTrimp(streams.heartrate, streams.time, maxHr);
  }

  // Swimming TSS: simplified estimate based on pace vs CSS
  if (swimData.pacePer100m && zones.swimCss && zones.swimCss > 0) {
    const intensityFactor = zones.swimCss / swimData.pacePer100m;
    result.intensityFactor = round2(intensityFactor);
    result.trainingStressScore = round2(
      (activity.moving_time * intensityFactor * intensityFactor) / 3600 * 100
    );
  }

  return result;
}

/**
 * Main entry point: analyze any workout type
 */
export function analyzeWorkoutStreams(
  workoutType: string,
  streams: StravaStream | null,
  activity: Record<string, unknown>,
  zones: UserZones,
  prescribed?: { intensity?: string; target_zones?: Record<string, unknown> }
): WorkoutAnalytics {
  const activityData = {
    distance: (activity.distance as number) || 0,
    moving_time: (activity.moving_time as number) || 0,
    elapsed_time: (activity.elapsed_time as number) || 0,
    average_heartrate: activity.average_heartrate as number | undefined,
    max_heartrate: activity.max_heartrate as number | undefined,
    total_elevation_gain: activity.total_elevation_gain as number | undefined,
    average_speed: activity.average_speed as number | undefined,
    average_watts: activity.average_watts as number | undefined,
    weighted_average_watts: activity.weighted_average_watts as number | undefined,
  };

  let analytics: WorkoutAnalytics;

  switch (workoutType) {
    case "run":
      analytics = analyzeRunning(streams, activityData, zones);
      break;
    case "bike":
      analytics = analyzeCycling(streams, activityData, zones);
      break;
    case "swim":
      analytics = analyzeSwimming(streams, activityData, zones);
      break;
    case "brick":
      // For bricks, analyze as the primary discipline (usually cycling for the main phase)
      // The webhook splits these if possible; otherwise treat as cycling
      analytics = analyzeCycling(streams, activityData, zones);
      break;
    default:
      analytics = createEmptyAnalytics();
  }

  // Zone compliance
  if (prescribed?.intensity) {
    const zoneData = analytics.hrZones || analytics.paceZones || analytics.powerZones;
    const compliance = calculateZoneCompliance(zoneData, prescribed.intensity);
    analytics.zoneComplianceScore = compliance.score;
    analytics.zoneComplianceDetails = compliance.details;
  }

  return analytics;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyAnalytics(): WorkoutAnalytics {
  return {
    hrZones: null,
    paceZones: null,
    powerZones: null,
    trainingStressScore: null,
    intensityFactor: null,
    normalizedPower: null,
    normalizedGradedPace: null,
    variabilityIndex: null,
    efficiencyFactor: null,
    aerobicDecoupling: null,
    splits: [],
    zoneComplianceScore: null,
    zoneComplianceDetails: {},
    avgCadence: null,
    cadenceVariability: null,
    totalAscent: null,
    totalDescent: null,
    gradeAdjustedPace: null,
    trimp: null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Find the best N-minute power from watts stream.
 * Used for FTP detection and performance tracking.
 */
export function bestPowerForDuration(
  watts: number[],
  time: number[],
  durationSeconds: number
): number | null {
  if (watts.length < durationSeconds) return null;

  let bestAvg = 0;

  for (let i = 0; i < watts.length; i++) {
    // Find end index for the duration window
    let endIdx = i;
    while (endIdx < watts.length && time[endIdx] - time[i] < durationSeconds) {
      endIdx++;
    }
    if (endIdx >= watts.length) break;

    // Calculate average power in this window
    let sum = 0;
    let count = 0;
    for (let j = i; j < endIdx; j++) {
      if (watts[j] > 0) {
        sum += watts[j];
        count++;
      }
    }

    if (count > 0) {
      const avg = sum / count;
      if (avg > bestAvg) bestAvg = avg;
    }
  }

  return bestAvg > 0 ? round2(bestAvg) : null;
}

/**
 * Get user zones from profile and plan_config data.
 * Falls back to defaults based on experience level.
 */
export function getUserZonesFromProfile(
  profile: {
    run_pace_per_km?: number | null;
    bike_ftp?: number | null;
    swim_pace_per_100m?: number | null;
    experience_level?: string | null;
  },
  planConfig?: {
    runPaceZones?: Record<string, unknown> | null;
    bikePowerZones?: Record<string, unknown> | null;
    swimPacePer100m?: number | null;
  } | null
): UserZones {
  const experience = profile.experience_level || "intermediate";

  // Default max HR (rough estimate)
  const defaultMaxHr: Record<string, number> = {
    beginner: 190,
    intermediate: 185,
    advanced: 182,
    elite: 180,
  };

  const defaultFtp: Record<string, number> = {
    beginner: 150,
    intermediate: 220,
    advanced: 280,
    elite: 340,
  };

  const defaultEasyPace: Record<string, number> = {
    beginner: 373,
    intermediate: 317,
    advanced: 280,
    elite: 255,
  };

  const easyPace = profile.run_pace_per_km || defaultEasyPace[experience] || 317;
  const ftp = profile.bike_ftp || defaultFtp[experience] || 220;

  return {
    maxHr: defaultMaxHr[experience] || 185,
    lthr: Math.round((defaultMaxHr[experience] || 185) * 0.85),
    ftp,
    easyPace,
    thresholdPace: Math.round(easyPace * 0.82),
    swimCss: profile.swim_pace_per_100m || planConfig?.swimPacePer100m || undefined,
  };
}
