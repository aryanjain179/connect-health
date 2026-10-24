/**
 * Sleep duration vs seizure days.
 *
 * Exposure definition: for calendar day D, the exposure is `sleepHours` on the check-in dated D, i.e. the night that
 * ended on the morning of D ("the preceding night"). Unit of analysis = day, so two seizures on one day count as one
 * seizure day (events are reported separately). Days without a check-in or with sleep not recorded are excluded.
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
import { pct, plural } from './format';

/** A seizure starting 00:00–05:59 may have disrupted the sleep record for that night. */
export function isNocturnal(time: string | null): boolean {
  return time !== null && time >= '00:00' && time < '06:00';
}

export function analyzeSleep(ctx: AnalysisContext, settings: AnalysisSettings): PatternFinding {
  const t = settings.sleepThresholdHours;
  const withSleep = ctx.observedDays.filter((d) => ctx.obsByDate.get(d)!.sleepHours !== null);
  const sleepMissing = ctx.observedDays.filter((d) => ctx.obsByDate.get(d)!.sleepHours === null);
  const shortDays = withSleep.filter((d) => (ctx.obsByDate.get(d)!.sleepHours as number) < t);
  const adequateDays = withSleep.filter((d) => (ctx.obsByDate.get(d)!.sleepHours as number) >= t);

  const short = groupFor(ctx, `Short sleep (< ${t} h)`, shortDays);
  const adequate = groupFor(ctx, `Sleep ≥ ${t} h`, adequateDays);
  const stats = seizureDayStats(short, adequate);

  const finding = emptyFinding(ctx, {
    id: 'pattern-sleep',
    factor: 'sleep',
    title: 'Sleep duration and seizure days',
    method:
      `Each observed day is classified by the sleep recorded for the night ending that morning (short: < ${t} h; ` +
      `otherwise ≥ ${t} h). The share of days with at least one recorded seizure is compared between groups ` +
      "(Fisher's exact test, exploratory). Multiple seizures on one day count as one seizure day.",
    discussionPoint:
      'Review whether sleep duration and sleep quality should be discussed as part of seizure management, and whether the pattern is consistent with the clinical history.',
    groups: [short, adequate],
    stats,
    exclusions: compact([
      exclusion(ctx, 'No daily check-in (sleep unknown)', ctx.unobservedDays),
      exclusion(ctx, 'Check-in without sleep duration', sleepMissing),
    ]),
    completeness: { eligibleDays: withSleep.length, calendarDays: ctx.calendarDays },
    evidenceIds: ['ferlisi-2014-precipitants'],
    confounders: [
      'Stress, illness, missed doses and menstrual-cycle timing can co-occur with short sleep.',
      'Nocturnal seizures can shorten or disrupt the recorded night (reverse direction).',
    ],
    limitations: [
      OBSERVATIONAL_LIMITATION,
      'Sleep duration is self-reported and may be estimated.',
      'Days without a check-in are excluded rather than assumed seizure-free or well-slept.',
      MULTIPLE_COMPARISONS_LIMITATION,
    ],
  });

  const shortSeizureDays = seizureDaysIn(ctx, shortDays);
  finding.involvedDates = shortSeizureDays;
  finding.confounderOverlap = computeOverlap(ctx, shortSeizureDays, {
    highStressAtLeast: settings.highStressThreshold,
    include: ['high-stress', 'illness', 'missed-dose', 'perimenstrual'],
  });

  // Sensitivity: drop days where every seizure was nocturnal.
  const allNocturnal = (d: string) => {
    const list = ctx.seizuresByDate.get(d);
    return !!list && list.length > 0 && list.every((s) => isNocturnal(s.time));
  };
  const nocturnalDays = withSleep.filter(allNocturnal);
  if (nocturnalDays.length) {
    const s2 = groupFor(ctx, short.label, shortDays.filter((d) => !allNocturnal(d)));
    const a2 = groupFor(ctx, adequate.label, adequateDays.filter((d) => !allNocturnal(d)));
    finding.sensitivity = {
      label: `Excluding ${plural(nocturnalDays.length, 'day')} where all seizures began 00:00–05:59`,
      groups: [s2, a2],
      stats: seizureDayStats(s2, a2),
    };
  }

  const totalSeizureDays = short.seizureDays + adequate.seizureDays;
  if (short.eligibleDays < MIN_GROUP_DAYS || adequate.eligibleDays < MIN_GROUP_DAYS) {
    finding.status = 'insufficient-data';
    finding.suppressionReason = `Each sleep group needs at least ${MIN_GROUP_DAYS} observed days (short: ${short.eligibleDays}, ≥ ${t} h: ${adequate.eligibleDays}).`;
  } else if (totalSeizureDays < MIN_TOTAL_SEIZURE_DAYS) {
    finding.status = 'insufficient-data';
    finding.suppressionReason = `At least ${MIN_TOTAL_SEIZURE_DAYS} seizure days with a sleep record are needed (found ${totalSeizureDays}).`;
  }
  if (finding.status === 'insufficient-data' && finding.suppressionReason) {
    finding.title = 'Sleep duration: not enough data yet';
    finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
    return finding;
  }

  const summary =
    `A seizure was recorded on ${short.seizureDays} of ${short.eligibleDays} days after a night shorter than ${t} h ` +
    `(${pct(short.seizureDayRate)}), compared with ${adequate.seizureDays} of ${adequate.eligibleDays} days after ` +
    `${t} h or more (${pct(adequate.seizureDayRate)}).`;

  if (isElevated(stats, short.seizureDayRate)) {
    finding.status = 'possible-pattern';
    finding.title = 'Possible pattern: more seizure days after short sleep';
    finding.explanation = `${summary} This is a possible personal pattern in observational diary data. It is not proof that short sleep brings on seizures.`;
  } else {
    finding.status = 'no-clear-pattern';
    finding.title = 'No clear difference by sleep duration';
    finding.explanation = `${summary} The difference is not large or consistent enough in these records to describe as a pattern.`;
  }
  return finding;
}
