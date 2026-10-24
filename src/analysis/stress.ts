/**
 * Reported stress vs seizure days.
 *
 * Exposure: the stress rating (0–10) on the check-in for the same calendar day. High = rating ≥ threshold.
 * Ratings may be entered after a seizure, so the seizure can influence the rating (reverse direction).
 */
import type { PatternFinding } from '../models/analysis';
import type { AnalysisSettings } from '../models/types';
import type { AnalysisContext } from './context';
import { groupFor } from './context';
import {
  MIN_GROUP_DAYS,
  MIN_TOTAL_SEIZURE_DAYS,
  MULTIPLE_COMPARISONS_LIMITATION,
  OBSERVATIONAL_LIMITATION,
  compact,
  computeOverlap,
  emptyFinding,
  exclusion,
  isElevated,
  seizureDayStats,
  seizureDaysIn,
} from './findingBase';
import { pct } from './format';

export function analyzeStress(ctx: AnalysisContext, settings: AnalysisSettings): PatternFinding {
  const t = settings.highStressThreshold;
  const rated = ctx.observedDays.filter((d) => ctx.obsByDate.get(d)!.stressLevel !== null);
  const notRated = ctx.observedDays.filter((d) => ctx.obsByDate.get(d)!.stressLevel === null);
  const highDays = rated.filter((d) => (ctx.obsByDate.get(d)!.stressLevel as number) >= t);
  const lowDays = rated.filter((d) => (ctx.obsByDate.get(d)!.stressLevel as number) < t);

  const high = groupFor(ctx, `High stress (≥ ${t}/10)`, highDays);
  const low = groupFor(ctx, `Stress < ${t}/10`, lowDays);
  const stats = seizureDayStats(high, low);

  const finding = emptyFinding(ctx, {
    id: 'pattern-stress',
    factor: 'stress',
    title: 'Reported stress and seizure days',
    method:
      `Each observed day is classified by the same-day stress rating (high: ≥ ${t}/10). The share of days with at ` +
      "least one recorded seizure is compared between groups (Fisher's exact test, exploratory).",
    discussionPoint:
      'Discuss whether stress is a relevant factor for this patient and whether the timing of stress ratings relative to seizures is reliable.',
    groups: [high, low],
    stats,
    exclusions: compact([
      exclusion(ctx, 'No daily check-in (stress unknown)', ctx.unobservedDays),
      exclusion(ctx, 'Check-in without stress rating', notRated),
    ]),
    completeness: { eligibleDays: rated.length, calendarDays: ctx.calendarDays },
    evidenceIds: ['ferlisi-2014-precipitants', 'nakken-2005-precipitants'],
    confounders: [
      'Stress often co-occurs with short sleep; the two cannot be separated with these data.',
      'A seizure on the same day can raise the stress rating given for that day.',
    ],
    limitations: [
      OBSERVATIONAL_LIMITATION,
      'Stress is a subjective single daily rating.',
      MULTIPLE_COMPARISONS_LIMITATION,
    ],
  });

  finding.involvedDates = seizureDaysIn(ctx, highDays);
  finding.confounderOverlap = computeOverlap(ctx, finding.involvedDates, {
    shortSleepBelow: settings.sleepThresholdHours,
    include: ['short-sleep', 'illness', 'missed-dose', 'perimenstrual'],
  });

  const totalSeizureDays = high.seizureDays + low.seizureDays;
  if (high.eligibleDays < MIN_GROUP_DAYS || low.eligibleDays < MIN_GROUP_DAYS) {
    finding.suppressionReason = `Each stress group needs at least ${MIN_GROUP_DAYS} observed days (high: ${high.eligibleDays}, lower: ${low.eligibleDays}).`;
  } else if (totalSeizureDays < MIN_TOTAL_SEIZURE_DAYS) {
    finding.suppressionReason = `At least ${MIN_TOTAL_SEIZURE_DAYS} seizure days with a stress rating are needed (found ${totalSeizureDays}).`;
  }
  if (finding.suppressionReason) {
    finding.status = 'insufficient-data';
    finding.title = 'Reported stress: not enough data yet';
    finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
    return finding;
  }

  const summary =
    `A seizure was recorded on ${high.seizureDays} of ${high.eligibleDays} high-stress days (${pct(high.seizureDayRate)}) ` +
    `and on ${low.seizureDays} of ${low.eligibleDays} lower-stress days (${pct(low.seizureDayRate)}).`;
  if (isElevated(stats, high.seizureDayRate)) {
    finding.status = 'possible-pattern';
    finding.title = 'Possible pattern: more seizure days on high-stress days';
    finding.explanation = `${summary} This is a possible personal pattern in observational diary data, not proof that stress brings on seizures.`;
  } else {
    finding.status = 'no-clear-pattern';
    finding.title = 'No clear difference by reported stress';
    finding.explanation = `${summary} These records do not show a clear difference between high- and lower-stress days.`;
  }
  return finding;
}
