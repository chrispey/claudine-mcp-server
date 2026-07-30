export const CONTRACT_VERSION = "v0.1";

export const DB = {
  SESSION_DEPOSITS:    "6623409e-4181-4620-81db-7b6e0d08ad6c",
  CLAUDINE_TASKS:      "4461502e-a32c-40fa-a747-97a1b97672da",
  LIVING_SYNC:         "2df66a03d036810580fcff805404c039",
  PATTERN_LANGUAGE:    "2e066a03d03681f9b7e7de4c571bd0ff",
  MESSAGES:            "3636036808be48a4b041286f619f5501",
  ARCHITECTURE_HUB:    "6eb96975c5e940c897ff261445d0a1f6",
  SIGNAL_BOARD:     process.env.SIGNAL_BOARD_DB_ID ?? "",
  PULSE_ARCHIVE:    process.env.PULSE_ARCHIVE_DB_ID ?? "",
} as const;

// Contract-frozen: Source Morph allowed values for Session Deposits
export const SOURCE_MORPHS = [
  "AR", "Bridge", "Constellation", "Repository", "Crucible",
  "Versailles", "TYC", "Track Two", "Brunch Babies",
  "Feral Claudine", "La Fondation", "Keeper", "Non-morph",
] as const;
export type SourceMorph = typeof SOURCE_MORPHS[number];

// Contract-frozen: Domain allowed values for Claudine Tasks
export const TASK_DOMAINS = [
  "System", "Bridge", "Constellation", "Keeper", "Versailles",
  "Crucible", "TYC", "Track Two", "Repository", "Brunch Babies", "La Fondation",
] as const;
export type TaskDomain = typeof TASK_DOMAINS[number];

// Contract-frozen: Type (multi-select) for Session Deposits
export const DEPOSIT_TYPES = [
  "Decision", "Insight", "Action Item", "State Change",
  "Observation", "Changelog", "Proposition",
] as const;
export type DepositType = typeof DEPOSIT_TYPES[number];

// Contract-frozen: Confidence select for Session Deposits
export const CONFIDENCE_VALUES = ["tentative", "probable", "verified"] as const;
export type Confidence = typeof CONFIDENCE_VALUES[number];

// Contract-frozen: Status for Session Deposits
export const DEPOSIT_STATUS = ["Not started", "In progress", "Done"] as const;
export type DepositStatus = typeof DEPOSIT_STATUS[number];

// Contract-frozen: Status for Claudine Tasks
export const TASK_STATUS = ["Inbox", "To do", "Doing", "Done"] as const;
export type TaskStatus = typeof TASK_STATUS[number];

// Contract-frozen: Priority for Claudine Tasks
export const TASK_PRIORITY = ["High", "Medium", "Low"] as const;
export type TaskPriority = typeof TASK_PRIORITY[number];

// Contract-frozen: Triage for Claudine Tasks
export const TASK_TRIAGE = ["Inbox", "Upcoming", "Scheduled", "Someday"] as const;
export type TaskTriage = typeof TASK_TRIAGE[number];

// Signal types for inter-morph signaling
export const SIGNAL_TYPES = [
  "needs-review", "conflict-detected", "dependency", "FYI", "pattern",
] as const;
export type SignalType = typeof SIGNAL_TYPES[number];

export const CHARACTER_LIMIT = 50_000;
