/** Output types produced by the deterministic analysis engine and clinical-connection rules. */
import type { ISODate } from './types';

export interface DateWindow {
  start: ISODate;
  end: ISODate;
}

export type FindingStatus =
  | 'possible-pattern'
  | 'no-clear-pattern'
  | 'notable-change'
  | 'insufficient-data'
  | 'not-applicable';

export type FindingFactor = 'sleep' | 'menstrual-cycle' | 'medication' | 'stress' | 'trend';

export interface ComparisonGroup {
  label: string;
  /** Eligible observed days in the group (the denominator). */
  eligibleDays: number;
  /** Days in the group with ≥1 recorded seizure. */
  seizureDays: number;
  /** Seizure events recorded on eligible days in the group. */
  events: number;
  /** seizureDays / eligibleDays, null if no eligible days. */
  seizureDayRate: number | null;
  /** events / eligibleDays, null if no eligible days. */
  eventRate: number | null;
}

export interface ComparisonStats {
  /** Primary rate ratio (exposed vs reference). */
  rateRatio: number | null;
  /** Absolute difference of the primary rate (exposed − reference). */
  rateDifference: number | null;
  metric: 'seizure-day proportion' | 'events per observed day';
  pValue: number | null;
  test: string;
}

export interface Exclusion {
  reason: string;
  days: number;
  /** Seizure events falling on the excluded days. */
  events: number;
}

export interface ConfounderOverlap {
  factor: string;
  /** Seizure days in the exposed group where the factor was also present. */
  count: number;
  /** Seizure days in the exposed group where the factor was recorded at all. */
  of: number;
}

export interface PatternFinding {
  id: string;
  factor: FindingFactor;
  category: 'personal-pattern';
  status: FindingStatus;
  title: string;
  explanation: string;
  method: string;
  window: DateWindow & { calendarDays: number };
  groups: ComparisonGroup[];
  stats: ComparisonStats | null;
  exclusions: Exclusion[];
  /** Share of calendar days in the window that were eligible for this analysis. */
  completeness: { eligibleDays: number; calendarDays: number };
  confounders: string[];
  confounderOverlap: ConfounderOverlap[];
  limitations: string[];
  discussionPoint: string;
  evidenceIds: string[];
  suppressionReason: string | null;
  /** Optional sensitivity analysis (e.g. excluding nocturnal seizures). */
  sensitivity: { label: string; groups: ComparisonGroup[]; stats: ComparisonStats | null } | null;
  /** Free-form extra details (e.g. new seizure types). */
  details: string[];
  /** Dates of the data points behind the finding (e.g. seizure days after short sleep). */
  involvedDates: string[];
  /** Intervals compared (e.g. before / after a medication change). */
  highlightRanges: Array<DateWindow & { label: string }>;
}

export type SignalKind =
  | 'confirmed-diagnosis'
  | 'patient-reported-symptom'
  | 'calculated-pattern'
  | 'daily-observation'
  | 'medication-context'
  | 'history-context';

export interface PatientSignal {
  kind: SignalKind;
  label: string;
  detail: string;
  sourceId: string | null;
}

export type ConnectionCategory = 'potential-comorbidity' | 'pattern-review' | 'safety-review';

export interface ConnectionResult {
  id: string;
  title: string;
  category: ConnectionCategory;
  surfaced: boolean;
  /** Why the connection was / was not surfaced. */
  rationale: string;
  /** Potential clinical hypothesis (only when surfaced). */
  hypothesis: string | null;
  signals: PatientSignal[];
  evidenceIds: string[];
  confounders: string[];
  limitations: string[];
  discussionPoint: string;
  urgency: 'routine' | 'prompt' | 'emergency-guidance';
}
