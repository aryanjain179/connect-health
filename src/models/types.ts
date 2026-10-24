/**
 * Core health-record models for HealthConnect.
 *
 * Conventions
 * - Dates are ISO calendar dates `YYYY-MM-DD` (no time zone). Times are `HH:MM` 24h local.
 * - `null` means "not recorded". It is never interpreted as a negative finding.
 * - Every record created by the synthetic generator has `isSynthetic: true`.
 */

export type ISODate = string;

export type ConditionFocus = 'epilepsy';

export interface PatientProfile {
  id: string;
  displayName: string;
  age: number;
  sex: 'female' | 'male' | 'intersex' | 'unspecified';
  pronouns?: string;
  conditionFocus: ConditionFocus;
  careTeamNote?: string;
  isSynthetic: boolean;
}

/** ILAE-2017-style operational seizure types, plus "unknown". */
export type SeizureType =
  | 'focal-aware'
  | 'focal-impaired-awareness'
  | 'focal-to-bilateral-tonic-clonic'
  | 'generalized-tonic-clonic'
  | 'absence'
  | 'myoclonic'
  | 'unknown';

export type Severity = 'mild' | 'moderate' | 'severe';

export interface SeizureEvent {
  id: string;
  date: ISODate;
  /** Local time `HH:MM` if known. */
  time: string | null;
  type: SeizureType;
  durationSeconds: number | null;
  severity: Severity | null;
  preSymptoms: string[];
  postSymptoms: string[];
  recoveryMinutes: number | null;
  notes: string;
  isSynthetic: boolean;
}

/**
 * A daily check-in. `sleepHours`/`sleepQuality` describe the night that ENDS on the morning of `date`.
 * A calendar day without a DailyObservation is a day without a check-in (missing, not "nothing happened").
 */
export interface DailyObservation {
  id: string;
  date: ISODate;
  sleepHours: number | null;
  /** 1 (very poor) – 5 (very good). */
  sleepQuality: number | null;
  /** 0 (none) – 10 (extreme). */
  stressLevel: number | null;
  illness: boolean | null;
  headache: boolean | null;
  dizziness: boolean | null;
  /** Attention or concentration difficulty reported for the day. */
  attentionDifficulty: boolean | null;
  otherSymptoms: string[];
  notes: string;
  isSynthetic: boolean;
}

export interface MenstrualRecord {
  id: string;
  periodStart: ISODate;
  periodEnd: ISODate | null;
  /** Whether the patient is sure of the start date. */
  startCertainty: 'exact' | 'approximate';
  notes: string;
  isSynthetic: boolean;
}

export type MedicationKind = 'prescription' | 'rescue' | 'otc-supplement';
export type RecordSource = 'clinician-documented' | 'patient-reported' | 'external-record';

export interface Medication {
  id: string;
  name: string;
  indication: string;
  kind: MedicationKind;
  startDate: ISODate;
  endDate: ISODate | null;
  initialDose: string;
  frequency: string;
  source: RecordSource;
  notes: string;
  isSynthetic: boolean;
}

export type MedicationEventKind = 'dose-change' | 'missed-dose' | 'side-effect';

export interface MedicationEvent {
  id: string;
  medicationId: string;
  date: ISODate;
  kind: MedicationEventKind;
  /** New dose for `dose-change` events, e.g. "750 mg". */
  newDose: string | null;
  description: string;
  source: RecordSource;
  isSynthetic: boolean;
}

export type HistoryKind = 'diagnosis' | 'symptom' | 'history' | 'referral';
export type HistoryStatus =
  | 'confirmed'
  | 'suspected'
  | 'patient-reported'
  | 'resolved'
  | 'ruled-out'
  | 'pending';

export interface HistoryRecord {
  id: string;
  kind: HistoryKind;
  label: string;
  status: HistoryStatus;
  source: RecordSource;
  date: ISODate | null;
  /** Machine-readable tags used by the clinical-connections rules, e.g. `epilepsy`, `attention`, `snoring`. */
  tags: string[];
  notes: string;
  isSynthetic: boolean;
}

export type TaskKind =
  | 'discuss-pattern'
  | 'ask-assessment'
  | 'referral-follow-up'
  | 'record-appointment'
  | 'other';
export type TaskStatus = 'open' | 'in-progress' | 'done';

export interface CareTask {
  id: string;
  title: string;
  reason: string;
  kind: TaskKind;
  /** Insight / finding / connection id this task was created from. */
  insightId: string | null;
  dueDate: ISODate | null;
  appointmentDate: ISODate | null;
  status: TaskStatus;
  createdOn: ISODate;
  isSynthetic: boolean;
}

export interface HealthData {
  profile: PatientProfile;
  seizures: SeizureEvent[];
  observations: DailyObservation[];
  menstrual: MenstrualRecord[];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  history: HistoryRecord[];
  tasks: CareTask[];
}

export interface AnalysisSettings {
  /** Nights shorter than this are "short sleep". */
  sleepThresholdHours: number;
  /** Stress ratings at or above this are "high stress". */
  highStressThreshold: number;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  sleepThresholdHours: 6,
  highStressThreshold: 7,
};

export const SEIZURE_TYPE_LABELS: Record<SeizureType, string> = {
  'focal-aware': 'Focal aware',
  'focal-impaired-awareness': 'Focal impaired awareness',
  'focal-to-bilateral-tonic-clonic': 'Focal to bilateral tonic-clonic',
  'generalized-tonic-clonic': 'Generalized tonic-clonic',
  absence: 'Absence',
  myoclonic: 'Myoclonic',
  unknown: 'Unknown / not sure',
};
