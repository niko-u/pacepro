/**
 * Analytics Module — Public API
 *
 * Exports the main functions needed by the webhook and other consumers.
 */

export {
  fetchStravaStreams,
  hasHeartRateData,
  hasPowerData,
  hasAltitudeData,
  hasCadenceData,
} from "./strava-streams";
export type { StravaStream } from "./strava-streams";

export {
  analyzeWorkoutStreams,
  getUserZonesFromProfile,
  calculateZoneCompliance,
  bestPowerForDuration,
} from "./engine";
export type {
  WorkoutAnalytics,
  UserZones,
  HrZoneDistribution,
  PowerZoneDistribution,
  PaceZoneDistribution,
  SplitData,
} from "./engine";

export {
  updateTrainingLoad,
  getTrainingLoadHistory,
  analyzeFitnessTrend,
  getWeeklyStats,
  getEfficiencyFactorTrend,
  getRecoveryTrend,
  checkPowerPRs,
} from "./trends";
export type {
  TrainingLoadSnapshot,
  FitnessTrend,
  WeeklyStats,
  RecoveryTrend,
  PersonalRecord,
} from "./trends";

export {
  detectZoneBreakthroughs,
  checkFtpBreakthrough,
  checkRunningThresholdBreakthrough,
  checkSwimCssBreakthrough,
} from "./zone-detection";
export type { ZoneBreakthrough } from "./zone-detection";
