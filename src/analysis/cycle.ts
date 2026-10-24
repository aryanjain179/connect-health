/**
 * Menstrual-cycle day and phase mapping.
 *
 * Phase definitions follow Herzog, Klein & Ransil (1997), with day 1 = first day of menses and negative days counted
 * back from the next recorded start (day −1 = the day before the next period):
 *   perimenstrual −3…+3 · follicular 4…9 · periovulatory 10…−13 · luteal −12…−4
 *
 * Basis
 *   recorded  – the day lies within a logged period (menses observed by the patient)
 *   estimated – bounded cycle (next start recorded); phase from calendar counting (ovulation is NOT confirmed)
 *   projected – after the last recorded start or before the first; uses an assumed cycle length
 *
 * Only days in bounded cycles of plausible length (21–45 days) are `eligible` for rate comparisons.
 */
import type { ISODate, MenstrualRecord } from '../models/types';
import { addDays, diffDays } from './dates';

export type CyclePhase = 'perimenstrual' | 'follicular' | 'periovulatory' | 'luteal';
export type PhaseBasis = 'recorded' | 'estimated' | 'projected';

export const PHASE_LABELS: Record<CyclePhase, string> = {
  perimenstrual: 'Perimenstrual',
  follicular: 'Follicular',
  periovulatory: 'Periovulatory',
  luteal: 'Luteal',
};

export const MIN_CYCLE_LENGTH = 21;
export const MAX_CYCLE_LENGTH = 45;
export const DEFAULT_CYCLE_LENGTH = 28;

export interface CycleDayInfo {
  date: ISODate;
  /** 1-based day since the most recent start; negative for days before the first recorded start. */
  cycleDay: number;
  cycleLength: number | null;
  phase: CyclePhase | null;
  basis: PhaseBasis;
  bounded: boolean;
  eligible: boolean;
  /** Index of the cycle (by sorted start) the day belongs to; −1 before the first start. */
  cycleIndex: number;
  /** Reason the day is not eligible, if applicable. */
  note: string | null;
}

export interface CycleSummary {
  starts: ISODate[];
  lengths: number[];
  boundedPlausible: number;
  irregular: Array<{ start: ISODate; length: number }>;
  averageLength: number | null;
}

/** Phase for a cycle day given a cycle length. */
export function phaseFor(cycleDay: number, cycleLength: number): CyclePhase | null {
  if (cycleDay < 1 || cycleDay > cycleLength) return null;
  const neg = cycleDay - cycleLength - 1; // day L → −1
  if (cycleDay <= 3 || neg >= -3) return 'perimenstrual';
  if (cycleDay <= 9) return 'follicular';
  if (neg >= -12 && neg <= -4) return 'luteal';
  return 'periovulatory';
}

function sortedRecords(records: MenstrualRecord[]): MenstrualRecord[] {
  // De-duplicate identical start dates and sort; order-independent.
  const byStart = new Map<ISODate, MenstrualRecord>();
  for (const r of records) {
    const existing = byStart.get(r.periodStart);
    if (!existing || r.id < existing.id) byStart.set(r.periodStart, r);
  }
  return [...byStart.values()].sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
}

export function summarizeCycles(records: MenstrualRecord[]): CycleSummary {
  const sorted = sortedRecords(records);
  const starts = sorted.map((r) => r.periodStart);
  const lengths: number[] = [];
  const irregular: CycleSummary['irregular'] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const len = diffDays(starts[i], starts[i + 1]);
    lengths.push(len);
    if (len < MIN_CYCLE_LENGTH || len > MAX_CYCLE_LENGTH) irregular.push({ start: starts[i], length: len });
  }
  const plausible = lengths.filter((l) => l >= MIN_CYCLE_LENGTH && l <= MAX_CYCLE_LENGTH);
  return {
    starts,
    lengths,
    boundedPlausible: plausible.length,
    irregular,
    averageLength: plausible.length ? Math.round(plausible.reduce((a, b) => a + b, 0) / plausible.length) : null,
  };
}

function withinRecordedPeriod(date: ISODate, r: MenstrualRecord): boolean {
  // If the end date is not recorded, only the start day itself counts as observed menses.
  const end = r.periodEnd ?? r.periodStart;
  return date >= r.periodStart && date <= end;
}

/** Map every requested day to cycle information. Days are not required to be contiguous. */
export function mapCycleDays(records: MenstrualRecord[], days: ISODate[]): Map<ISODate, CycleDayInfo> {
  const out = new Map<ISODate, CycleDayInfo>();
  const sorted = sortedRecords(records);
  if (sorted.length === 0) return out;
  const summary = summarizeCycles(records);
  const assumedLength = summary.averageLength ?? DEFAULT_CYCLE_LENGTH;

  for (const date of days) {
    // Find the latest start ≤ date.
    let idx = -1;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].periodStart <= date) idx = i;
      else break;
    }
    const recorded = sorted.some((r) => withinRecordedPeriod(date, r));

    if (idx === -1) {
      // Before the first recorded start: count back from it with the assumed length.
      const daysBefore = diffDays(date, sorted[0].periodStart); // ≥ 1
      const cycleDay = assumedLength - daysBefore + 1;
      out.set(date, {
        date,
        cycleDay: -daysBefore,
        cycleLength: null,
        phase: cycleDay >= 1 ? phaseFor(cycleDay, assumedLength) : null,
        basis: 'projected',
        bounded: false,
        eligible: false,
        cycleIndex: -1,
        note: 'Before the first recorded period start.',
      });
      continue;
    }

    const start = sorted[idx].periodStart;
    const cycleDay = diffDays(start, date) + 1;
    const next = sorted[idx + 1]?.periodStart ?? null;

    if (next) {
      const len = diffDays(start, next);
      const plausible = len >= MIN_CYCLE_LENGTH && len <= MAX_CYCLE_LENGTH;
      out.set(date, {
        date,
        cycleDay,
        cycleLength: len,
        phase: phaseFor(cycleDay, len),
        basis: recorded ? 'recorded' : 'estimated',
        bounded: true,
        eligible: plausible,
        cycleIndex: idx,
        note: plausible
          ? null
          : `Cycle length ${len} days is outside ${MIN_CYCLE_LENGTH}–${MAX_CYCLE_LENGTH} days (possible missing period record or irregular cycle).`,
      });
    } else {
      out.set(date, {
        date,
        cycleDay,
        cycleLength: null,
        phase: phaseFor(cycleDay, assumedLength),
        basis: recorded ? 'recorded' : 'projected',
        bounded: false,
        eligible: false,
        cycleIndex: idx,
        note: 'After the most recent recorded period start – next start not yet recorded.',
      });
    }
  }
  return out;
}

/** Next expected start based on the average plausible cycle length (for display only). */
export function projectedNextStart(records: MenstrualRecord[]): ISODate | null {
  const s = summarizeCycles(records);
  if (!s.starts.length) return null;
  return addDays(s.starts[s.starts.length - 1], s.averageLength ?? DEFAULT_CYCLE_LENGTH);
}
