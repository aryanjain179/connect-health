/**
 * Core health-record models for ConnectHealth.
 *
 * Conventions
 * - Dates are ISO calendar dates `YYYY-MM-DD` (no time zone). Times are `HH:MM` 24h local.
 * - `null` means "not recorded". It is never interpreted as a negative finding.
 * - Every record created by the synthetic generator has `isSynthetic: true`.
 */

export type ISODate = string;

/** Free-text summary of the main condition(s); display only. Conditions themselves live in `history`. */
export type ConditionFocus = string;

/** 'unspecified' is shown as "Prefer not to say". */
export type Sex = 'female' | 'male' | 'intersex' | 'unspecified';

export type GoalId =
  | 'understand-patterns'
  | 'prepare-appointments'
  | 'organize-medications'
  | 'explore-connections'
  | 'find-specialists'
  | 'insurance-referrals'
  | 'track-factors'
  | 'share-caregiver';

export interface Trackers {
  /** Seizure / event diary (e.g. epilepsy). */
  seizures: boolean;
  /** Menstrual-cycle tracking – optional, never assumed. */
  menstrual: boolean;
}

export interface CareTeamMember {
  id: string;
  specialty: string;
  name: string;
  notes: string;
}

export interface PatientProfile {
  id: string;
  displayName: string;
  preferredName?: string;
  /** Either age or date of birth is required at onboarding. */
  age: number;
  dateOfBirth?: ISODate | null;
  sex: Sex;
  genderIdentity?: string;
  pronouns?: string;
  conditionFocus: ConditionFocus;
  careTeamNote?: string;
  goals?: GoalId[];
  trackers?: Trackers;
  noKnownConditions?: boolean;
  /** True only when the person explicitly said they have no known allergies (absence of records ≠ no allergies). */
  noKnownAllergies?: boolean;
  careTeam?: CareTeamMember[];
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
  /**
   * Condition-specific check-in answers keyed by measure id (see src/conditions/checkin.ts), e.g. `pain-level`.
   * Missing key or null = not recorded.
   */
  measures?: Record<string, number | boolean | null>;
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

export type AllergyCategory = 'medication' | 'food' | 'environmental' | 'insect' | 'latex' | 'other';
export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'unknown';

/** An allergy or intolerance as reported or documented. Never inferred. */
export interface AllergyRecord {
  id: string;
  substance: string;
  category: AllergyCategory;
  /** Reaction in the person's words, e.g. "rash", "hives", "throat swelling". */
  reaction: string;
  severity: AllergySeverity;
  status: 'confirmed' | 'patient-reported' | 'suspected' | 'resolved';
  source: RecordSource;
  notedOn: ISODate | null;
  notes: string;
  isSynthetic: boolean;
}

export const ALLERGY_CATEGORY_LABELS: Record<AllergyCategory, string> = {
  medication: 'Medication',
  food: 'Food',
  environmental: 'Environmental',
  insect: 'Insect sting/bite',
  latex: 'Latex',
  other: 'Other',
};

export type TaskKind =
  | 'discuss-pattern'
  | 'ask-assessment'
  | 'referral-follow-up'
  | 'record-appointment'
  | 'other';
/** 'in-progress' = started, 'done' = completed. */
export type TaskStatus = 'open' | 'in-progress' | 'waiting' | 'blocked' | 'done';

export interface TaskLink {
  kind: 'condition' | 'finding' | 'flag' | 'connection' | 'specialty' | 'report';
  id: string;
  label: string;
}

export interface CareTask {
  id: string;
  title: string;
  reason: string;
  kind: TaskKind;
  /** Insight / finding / connection / flag id this task was created from. */
  insightId: string | null;
  dueDate: ISODate | null;
  appointmentDate: ISODate | null;
  status: TaskStatus;
  createdOn: ISODate;
  /** Who the user recorded contacting, and when (only ever entered by the user). */
  contactedWho?: string;
  contactedOn?: ISODate | null;
  followUpDate?: ISODate | null;
  notes?: string;
  links?: TaskLink[];
  isSynthetic: boolean;
}

/** Voice / text journal entry. Records are only created from approved proposals. */
export interface JournalEntry {
  id: string;
  createdAt: string;
  date: ISODate;
  /** Saved only if the user opted in. */
  transcript: string | null;
  source: 'speech' | 'typed';
  /** Records created from approved proposals (for deletion). */
  createdRecords: Array<{ collection: 'seizures' | 'observations' | 'menstrual' | 'medicationEvents' | 'history'; id: string }>;
  /** Fields changed on existing check-ins, with previous values (for undo). */
  updatedFields: Array<{ observationId: string; field: string; previous: unknown }>;
  /** Period records as they were before bleeding answers changed them (for undo). */
  previousMenstrual?: MenstrualRecord[];
  approvedCount: number;
  rejectedCount: number;
}

export type PermissionKey =
  | 'profile'
  | 'symptoms'
  | 'events'
  | 'medications'
  | 'sleep'
  | 'menstrual'
  | 'insights'
  | 'reports'
  | 'tasks';

export interface SharedPerson {
  id: string;
  name: string;
  relationship: string;
  contact: string;
  role: 'caregiver' | 'family-member' | 'support-person' | 'other';
  /** pending = configured, not confirmed; active = confirmed (local demo only); revoked = no access. */
  status: 'pending' | 'active' | 'revoked';
  permissions: Record<PermissionKey, boolean>;
  createdOn: ISODate;
  confirmedOn: ISODate | null;
  revokedOn: ISODate | null;
}

export interface ContactLogEntry {
  id: string;
  date: ISODate;
  party: 'insurer' | 'primary-care' | 'specialist-office' | 'pharmacy' | 'other';
  name: string;
  referenceNumber: string;
  notes: string;
  followUpDate: ISODate | null;
}

export interface NavigatorState {
  pathway: Record<string, boolean>;
  checklist: Record<string, boolean>;
  insurance: { insurer: string; phone: string; planType: '' | 'HMO' | 'PPO' | 'EPO' | 'POS' | 'Medicaid' | 'Medicare' | 'Other' | 'Unknown'; notes: string };
  contacts: ContactLogEntry[];
}

export interface HealthData {
  profile: PatientProfile;
  seizures: SeizureEvent[];
  observations: DailyObservation[];
  menstrual: MenstrualRecord[];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  history: HistoryRecord[];
  allergies: AllergyRecord[];
  tasks: CareTask[];
  journal: JournalEntry[];
  sharing: SharedPerson[];
  navigator: NavigatorState;
  /** Review-flag ids the user chose to leave out of the clinician report. */
  reviewExcluded: string[];
}

/** Outcome analysed by the pattern engine. */
/** Built-in outcomes plus yes/no condition measures (`measure:<id>`). */
export type OutcomeKey = 'seizures' | 'headache' | 'dizziness' | 'attentionDifficulty' | `measure:${string}`;

export interface AnalysisSettings {
  /** Nights shorter than this are "short sleep". */
  sleepThresholdHours: number;
  /** Stress ratings at or above this are "high stress". */
  highStressThreshold: number;
  /** Outcome shown in Pattern Discovery. */
  outcome: OutcomeKey;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  sleepThresholdHours: 6,
  highStressThreshold: 7,
  outcome: 'seizures',
};

export function emptyNavigator(): NavigatorState {
  return { pathway: {}, checklist: {}, insurance: { insurer: '', phone: '', planType: '', notes: '' }, contacts: [] };
}

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  intersex: 'Intersex',
  unspecified: 'Prefer not to say',
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
