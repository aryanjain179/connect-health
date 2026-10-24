/**
 * Clinician-review flags.
 *
 * Rules (see docs/ANALYSIS_METHODS.md):
 * - RED  – based on clinically reviewed public guidance with a documented source. Currently only: a recorded seizure
 *          lasting ≥ 5 minutes (CDC seizure first aid; ILAE status epilepticus t1 = 5 min for tonic-clonic seizures).
 * - AMBER – prototype analytic rule: a finding with status "possible-pattern" or "notable-change". The thresholds
 *          behind these statuses are prototype heuristics, NOT validated clinical rules.
 * - Findings with insufficient data are never flagged; they are listed as "Insufficient data to assess this pattern".
 *
 * Flags never name or speculate about a disease.
 */
import type { DateWindow, PatternFinding } from '../models/analysis';
import type { HealthData, ISODate, OutcomeKey } from '../models/types';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { getOutcome, outcomeOfFindingId } from '../analysis/outcomes';
import { PROLONGED_SECONDS } from '../analysis/completeness';
import { duration, pct, per30, plural } from '../analysis/format';
import { inWindow } from '../analysis/dates';

export const PATIENT_FLAG_MESSAGE =
  'Pattern identified for clinician review. A change or correlation was observed in your recorded health data during this period. The significance is uncertain. Please discuss this finding with a qualified healthcare professional.';

export type FlagLevel = 'red' | 'amber';

export interface FlagRule {
  name: string;
  basis: 'clinically-reviewed-guidance' | 'prototype-analytic-rule';
  description: string;
  evidenceIds: string[];
}

export interface ReviewFlag {
  id: string;
  findingId: string | null;
  level: FlagLevel;
  outcome: OutcomeKey;
  title: string;
  patientMessage: string;
  /** Neutral description of what was observed (from the finding). */
  observation: string;
  dataCompared: string;
  involvedDates: ISODate[];
  ranges: Array<DateWindow & { label: string }>;
  window: DateWindow;
  comparison: string;
  observations: number;
  missing: string[];
  limitations: string[];
  rule: FlagRule;
  questions: string[];
  urgentGuidance: string | null;
}

export interface InsufficientItem {
  findingId: string;
  title: string;
  reason: string;
}

const PROTOTYPE_RULE: FlagRule = {
  name: 'Prototype analytic rule',
  basis: 'prototype-analytic-rule',
  description:
    'Shown because the pattern engine labelled this finding a possible pattern or notable change (e.g. rate ratio ≥ 1.5 with exploratory p < 0.05). These thresholds are prototype heuristics, not validated clinical rules; amber means "worth routine discussion", not urgency.',
  evidenceIds: [],
};

const PROLONGED_RULE: FlagRule = {
  name: 'Seizure lasting 5 minutes or longer',
  basis: 'clinically-reviewed-guidance',
  description:
    'Public seizure first-aid guidance (CDC) advises seeking immediate medical attention or calling 911 when a seizure lasts more than 5 minutes; the ILAE status epilepticus definition uses 5 minutes (t1) for tonic-clonic seizures.',
  evidenceIds: ['cdc-seizure-first-aid', 'trinka-2015-status-epilepticus'],
};

function questionFor(f: PatternFinding, outcome: OutcomeKey): string {
  const o = getOutcome(outcome);
  switch (f.factor) {
    case 'sleep':
      return `My records show more ${o.noun} days after short nights. Is this worth looking into, and what else could explain it?`;
    case 'menstrual-cycle':
      return `My recorded ${o.plural} seem to cluster in one part of my menstrual cycle. Should I keep charting this, and is it relevant to my care?`;
    case 'medication':
      return `My recorded ${o.noun} rate changed around a medication change (${f.involvedDates[0] ?? 'see report'}). How should we interpret this, given that it is only a timing association?`;
    case 'stress':
      return `My records show more ${o.noun} days on high-stress days. Is this relevant, and how reliable is this kind of tracking?`;
    case 'trend':
      return f.id.startsWith('pattern-trend-type')
        ? 'I recorded a seizure type I had not recorded before. Should my seizure action plan be reviewed?'
        : `My recorded ${o.noun} frequency changed recently. Should we review this together?`;
  }
}

function comparisonText(f: PatternFinding): string {
  if (!f.groups.length) return f.details.join(' ');
  return f.groups
    .map((g) => `${g.label}: ${g.seizureDays} of ${g.eligibleDays} days (${pct(g.seizureDayRate)}), ${g.events} events (${per30(g.eventRate)} per 30 days)`)
    .join(' · ');
}

function missingText(f: PatternFinding): string[] {
  const out = f.exclusions.map((e) => `${e.reason}: ${plural(e.days, 'day')} excluded (${plural(e.events, 'event')} on those days not compared).`);
  out.push(`${f.completeness.eligibleDays} of ${f.completeness.calendarDays} days in the window were eligible for this comparison.`);
  return out;
}

export function buildReviewFlags(
  data: HealthData,
  findingsByOutcome: Partial<Record<OutcomeKey, PatternFinding[]>>,
  window: DateWindow,
): { flags: ReviewFlag[]; insufficient: InsufficientItem[] } {
  const flags: ReviewFlag[] = [];
  const insufficient: InsufficientItem[] = [];

  // RED – prolonged seizures (clinically reviewed public guidance).
  const prolonged = data.seizures
    .filter((s) => inWindow(s.date, window) && (s.durationSeconds ?? 0) >= PROLONGED_SECONDS)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  for (const s of prolonged) {
    flags.push({
      id: `flag:prolonged:${s.id}`,
      findingId: null,
      level: 'red',
      outcome: 'seizures',
      title: `Seizure lasting ${duration(s.durationSeconds)} recorded on ${s.date}`,
      patientMessage: PATIENT_FLAG_MESSAGE,
      observation: `A ${SEIZURE_TYPE_LABELS[s.type].toLowerCase()} seizure on ${s.date}${s.time ? ` at ${s.time}` : ''} was recorded as lasting ${duration(s.durationSeconds)}.`,
      dataCompared: 'Recorded seizure duration compared with the 5-minute threshold in public seizure first-aid guidance.',
      involvedDates: [s.date],
      ranges: [],
      window,
      comparison: `Recorded duration ${duration(s.durationSeconds)} vs 5 minutes.`,
      observations: 1,
      missing: ['Duration is patient- or witness-reported and may be estimated.'],
      limitations: ['A single recorded value; timing during a seizure is often approximate.'],
      rule: PROLONGED_RULE,
      questions: ['A seizure lasting 5 minutes or longer was recorded. Can we review my seizure action plan, including rescue medication and when to call emergency services?'],
      urgentGuidance:
        'If a seizure lasts more than 5 minutes, follow your seizure action plan and call 911 (CDC first-aid guidance). Tell your treating clinician about this recorded event promptly.',
    });
  }

  for (const [outcome, findings] of Object.entries(findingsByOutcome) as Array<[OutcomeKey, PatternFinding[]]>) {
    for (const f of findings) {
      if (f.status === 'insufficient-data') {
        insufficient.push({ findingId: f.id, title: f.title, reason: f.suppressionReason ?? 'Not enough data.' });
        continue;
      }
      if (f.status !== 'possible-pattern' && f.status !== 'notable-change') continue;
      // A notable change caused only by prolonged seizures is already covered by the red flag.
      if (f.id.startsWith('pattern-trend-type') && f.details.every((d) => d.startsWith('Prolonged seizure'))) continue;
      flags.push({
        id: `flag:${f.id}`,
        findingId: f.id,
        level: 'amber',
        outcome: outcomeOfFindingId(f.id) ?? outcome,
        title: f.title,
        patientMessage: PATIENT_FLAG_MESSAGE,
        observation: f.explanation,
        dataCompared: f.method,
        involvedDates: f.involvedDates,
        ranges: f.highlightRanges,
        window: { start: f.window.start, end: f.window.end },
        comparison: comparisonText(f),
        observations: f.completeness.eligibleDays,
        missing: missingText(f),
        limitations: f.limitations,
        rule: PROTOTYPE_RULE,
        questions: [questionFor(f, outcome)],
        urgentGuidance: null,
      });
    }
  }
  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === 'red' ? -1 : 1));
  return { flags, insufficient };
}

export function flagsOnDate(flags: ReviewFlag[], date: ISODate): ReviewFlag[] {
  return flags.filter((f) => f.involvedDates.includes(date));
}
