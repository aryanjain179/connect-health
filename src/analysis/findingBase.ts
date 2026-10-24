/** Shared thresholds and helpers for pattern findings. */
import type {
  ComparisonGroup,
  ComparisonStats,
  ConfounderOverlap,
  Exclusion,
  PatternFinding,
} from '../models/analysis';
import type { ISODate } from '../models/types';
import type { AnalysisContext } from './context';
import { eventsOnDays, missedDoseWithin48h } from './context';
import { fisherExactTwoSided, safeRatio } from './stats';

/** Minimum eligible days in each comparison group. */
export const MIN_GROUP_DAYS = 10;
/** Minimum seizure days across both groups for binary-exposure analyses. */
export const MIN_TOTAL_SEIZURE_DAYS = 5;
/** Rate ratio considered large enough to describe as a possible pattern. */
export const RR_THRESHOLD = 1.5;
/** Exploratory significance level. */
export const ALPHA = 0.05;

export const OBSERVATIONAL_LIMITATION =
  'Observational diary data: an association in these records does not establish cause and effect, and other unrecorded factors may explain it.';
export const MULTIPLE_COMPARISONS_LIMITATION =
  'Several factors are examined at once; exploratory p-values are not adjusted for multiple comparisons and some apparent patterns may arise by chance.';

export function emptyFinding(
  ctx: AnalysisContext,
  init: Pick<PatternFinding, 'id' | 'factor' | 'title' | 'method' | 'discussionPoint'> & Partial<PatternFinding>,
): PatternFinding {
  return {
    category: 'personal-pattern',
    status: 'insufficient-data',
    explanation: '',
    window: { ...ctx.window, calendarDays: ctx.calendarDays },
    groups: [],
    stats: null,
    exclusions: [],
    completeness: { eligibleDays: 0, calendarDays: ctx.calendarDays },
    confounders: [],
    confounderOverlap: [],
    limitations: [],
    evidenceIds: [],
    suppressionReason: null,
    sensitivity: null,
    details: [],
    involvedDates: [],
    highlightRanges: [],
    ...init,
  };
}

export function exclusion(ctx: AnalysisContext, reason: string, days: ISODate[]): Exclusion | null {
  if (!days.length) return null;
  return { reason, days: days.length, events: eventsOnDays(ctx, days) };
}

export function compact<T>(xs: Array<T | null>): T[] {
  return xs.filter((x): x is T => x !== null);
}

/** Seizure-day proportion comparison with Fisher's exact test. */
export function seizureDayStats(exposed: ComparisonGroup, reference: ComparisonGroup): ComparisonStats {
  const rr = safeRatio(exposed.seizureDayRate, reference.seizureDayRate);
  const diff =
    exposed.seizureDayRate !== null && reference.seizureDayRate !== null
      ? exposed.seizureDayRate - reference.seizureDayRate
      : null;
  return {
    rateRatio: rr,
    rateDifference: diff,
    metric: 'seizure-day proportion',
    pValue: fisherExactTwoSided(
      exposed.seizureDays,
      exposed.eligibleDays - exposed.seizureDays,
      reference.seizureDays,
      reference.eligibleDays - reference.seizureDays,
    ),
    test: "Fisher's exact test (two-sided), seizure day vs no seizure day",
  };
}

/** True when the exposed group shows a meaningfully higher rate. */
export function isElevated(stats: ComparisonStats, exposedRate: number | null, alpha = ALPHA): boolean {
  if (stats.pValue === null || stats.pValue >= alpha) return false;
  if (stats.rateRatio === null) return (exposedRate ?? 0) > 0; // reference rate 0
  return stats.rateRatio >= RR_THRESHOLD;
}

/** True when either direction exceeds the threshold (used for before/after and trend). */
export function isChanged(stats: ComparisonStats, alpha = ALPHA): boolean {
  if (stats.pValue === null || stats.pValue >= alpha || stats.rateRatio === null) return false;
  return stats.rateRatio >= RR_THRESHOLD || stats.rateRatio <= 1 / RR_THRESHOLD;
}

export interface OverlapOptions {
  shortSleepBelow?: number;
  highStressAtLeast?: number;
  include: Array<'short-sleep' | 'high-stress' | 'illness' | 'missed-dose' | 'perimenstrual'>;
}

/** For the given seizure days, count how often other recorded factors co-occurred. */
export function computeOverlap(ctx: AnalysisContext, seizureDays: ISODate[], opts: OverlapOptions): ConfounderOverlap[] {
  const out: ConfounderOverlap[] = [];
  const obs = (d: ISODate) => ctx.obsByDate.get(d);
  if (opts.include.includes('short-sleep') && opts.shortSleepBelow !== undefined) {
    const rec = seizureDays.filter((d) => obs(d)?.sleepHours != null);
    out.push({
      factor: `Short sleep (< ${opts.shortSleepBelow} h)`,
      count: rec.filter((d) => (obs(d)!.sleepHours as number) < opts.shortSleepBelow!).length,
      of: rec.length,
    });
  }
  if (opts.include.includes('high-stress') && opts.highStressAtLeast !== undefined) {
    const rec = seizureDays.filter((d) => obs(d)?.stressLevel != null);
    out.push({
      factor: `High stress (≥ ${opts.highStressAtLeast}/10)`,
      count: rec.filter((d) => (obs(d)!.stressLevel as number) >= opts.highStressAtLeast!).length,
      of: rec.length,
    });
  }
  if (opts.include.includes('illness')) {
    const rec = seizureDays.filter((d) => obs(d)?.illness != null);
    out.push({ factor: 'Illness reported', count: rec.filter((d) => obs(d)!.illness === true).length, of: rec.length });
  }
  if (opts.include.includes('missed-dose')) {
    out.push({
      factor: 'Missed dose logged within 48 h before',
      count: seizureDays.filter((d) => missedDoseWithin48h(ctx, d)).length,
      of: seizureDays.length,
    });
  }
  if (opts.include.includes('perimenstrual') && ctx.hasMenstrualRecords) {
    const rec = seizureDays.filter((d) => {
      const c = ctx.cycle.get(d);
      return c && c.phase !== null && c.basis !== 'projected';
    });
    out.push({
      factor: 'Perimenstrual phase (recorded/estimated)',
      count: rec.filter((d) => ctx.cycle.get(d)!.phase === 'perimenstrual').length,
      of: rec.length,
    });
  }
  return out;
}

export function seizureDaysIn(ctx: AnalysisContext, days: ISODate[]): ISODate[] {
  return days.filter((d) => (ctx.seizuresByDate.get(d)?.length ?? 0) > 0);
}
