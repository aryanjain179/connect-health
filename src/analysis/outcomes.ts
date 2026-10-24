/**
 * Outcomes the pattern engine can analyse.
 *
 * - `seizures`: seizure events from the event diary (optional module).
 * - Daily symptom fields (`headache`, `dizziness`, `attentionDifficulty`): one "event" per day the symptom was
 *   reported. Only days where the field was answered (yes or no) are observed – "not recorded" is never "no".
 *
 * Free-text symptoms (e.g. "fatigue" in `otherSymptoms`) cannot be analysed because their absence is never
 * recorded, so there is no valid denominator.
 */
import type { DailyObservation, HealthData, OutcomeKey } from '../models/types';
import type { PatternFinding } from '../models/analysis';
import { MEASURE_BY_ID, OUTCOME_MEASURES, seizureModuleOn } from '../conditions/checkin';

export interface OutcomeDef {
  key: OutcomeKey;
  label: string;
  noun: string;
  plural: string;
  /** Reads the yes/no answer for a day; null for the seizure diary (events) or when not answered. */
  read: ((o: DailyObservation) => boolean | null) | null;
}

const field = (k: 'headache' | 'dizziness' | 'attentionDifficulty') => (o: DailyObservation) => o[k] ?? null;

const BUILTIN: Record<'seizures' | 'headache' | 'dizziness' | 'attentionDifficulty', OutcomeDef> = {
  seizures: { key: 'seizures', label: 'Seizures', noun: 'seizure', plural: 'seizures', read: null },
  headache: { key: 'headache', label: 'Headache days', noun: 'headache', plural: 'headaches', read: field('headache') },
  dizziness: { key: 'dizziness', label: 'Dizziness days', noun: 'dizziness', plural: 'dizziness episodes', read: field('dizziness') },
  attentionDifficulty: { key: 'attentionDifficulty', label: 'Attention-difficulty days', noun: 'attention difficulty', plural: 'attention-difficulty days', read: field('attentionDifficulty') },
};

/** Definition for any outcome key, including yes/no condition measures (`measure:<id>`). */
export function getOutcome(key: OutcomeKey): OutcomeDef {
  if (key in BUILTIN) return BUILTIN[key as keyof typeof BUILTIN];
  const id = key.replace(/^measure:/, '');
  const m = MEASURE_BY_ID.get(id);
  const noun = m?.noun ?? id;
  return {
    key,
    label: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} days`,
    noun,
    plural: m?.plural ?? `${noun} days`,
    read: (o) => {
      const v = o.measures?.[id];
      return typeof v === 'boolean' ? v : null;
    },
  };
}

/** Kept for code that only needs built-in outcomes. */
export const OUTCOMES = BUILTIN;

export const OUTCOME_ORDER: OutcomeKey[] = ['seizures', 'headache', 'dizziness', 'attentionDifficulty', ...OUTCOME_MEASURES.map((m) => `measure:${m.id}` as OutcomeKey)];

export interface OutcomeAvailability {
  key: OutcomeKey;
  available: boolean;
  reason: string;
}

export function outcomeAvailability(data: HealthData): OutcomeAvailability[] {
  return OUTCOME_ORDER.map((key) => {
    if (key === 'seizures') {
      const on = seizureModuleOn(data);
      return { key, available: on, reason: on ? `${data.seizures.length} seizure events recorded` : 'Seizure log is only used when epilepsy is among your conditions.' };
    }
    const read = getOutcome(key).read!;
    const recorded = data.observations.filter((o) => read(o) !== null).length;
    return { key, available: recorded > 0, reason: recorded ? `Answered on ${recorded} check-ins` : 'Not yet answered in any daily check-in.' };
  });
}

/** Outcome finding ids keep their original names for seizures and gain a suffix otherwise. */
export function outcomeId(id: string, outcome: OutcomeKey): string {
  return outcome === 'seizures' ? id : `${id}~${outcome}`;
}

export function outcomeOfFindingId(id: string): OutcomeKey {
  const suffix = id.split('~')[1] as OutcomeKey | undefined;
  return suffix && (suffix in BUILTIN || (suffix.startsWith('measure:') && MEASURE_BY_ID.has(suffix.slice(8)))) ? suffix : 'seizures';
}

/**
 * Re-label seizure wording for symptom outcomes. Symptom outcomes have one event per day, so "seizure events" and
 * "seizure days" both become "<symptom> days".
 */
export function relabelFinding(f: PatternFinding, outcome: OutcomeKey): PatternFinding {
  if (outcome === 'seizures') return f;
  const o = getOutcome(outcome);
  const day = `${o.noun} days`;
  const swap = (s: string) =>
    s
      .replace(/No daily check-in/g, `No check-in, or ${o.noun} not answered`)
      .replace(/seizure events?/g, day)
      .replace(/seizure days?/g, day)
      .replace(/Seizure days?/g, cap(day))
      .replace(/Seizure events?/g, cap(day))
      .replace(/seizures/g, o.plural)
      .replace(/Seizures/g, cap(o.plural))
      .replace(/seizure/g, o.noun)
      .replace(/Seizure/g, cap(o.noun));
  return {
    ...f,
    id: outcomeId(f.id, outcome),
    title: swap(f.title),
    explanation: swap(f.explanation),
    method: swap(f.method) + ` Each day with ${o.noun} reported counts once; days where it was not answered are excluded.`,
    discussionPoint: swap(f.discussionPoint),
    confounders: f.confounders.map(swap),
    limitations: [...f.limitations.map(swap), `${cap(o.noun)} is a yes/no daily answer, not a count or severity.`],
    details: f.details.map(swap),
    suppressionReason: f.suppressionReason ? swap(f.suppressionReason) : null,
    exclusions: f.exclusions.map((e) => ({ ...e, reason: swap(e.reason) })),
    confounderOverlap: f.confounderOverlap,
    groups: f.groups.map((g) => ({ ...g, label: swap(g.label) })),
    // Seizure-precipitant and catamenial evidence does not apply to other outcomes.
    evidenceIds: [],
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
