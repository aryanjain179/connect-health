/**
 * Changes in seizure frequency and type over time.
 *
 * Frequency: the most recent 30 days of the window vs the earlier part of the window (≥ 30 days required).
 * Rates are events per observed day. Exact conditional binomial test (exploratory).
 * Type: a known seizure type recorded in the recent period that does not appear earlier in the window nor in the
 * documented history (`seizure-type:<type>` tags) is flagged as a notable change for clinician review.
 * Prolonged seizures (≥ 5 minutes) are always flagged for the safety protocol.
 */
import type { ComparisonStats, PatternFinding } from '../models/analysis';
import { SEIZURE_TYPE_LABELS, type HealthData, type SeizureType } from '../models/types';
import type { AnalysisContext } from './context';
import { groupFor } from './context';
import { addDays, eachDay } from './dates';
import { PROLONGED_SECONDS } from './completeness';
import { MULTIPLE_COMPARISONS_LIMITATION, OBSERVATIONAL_LIMITATION, emptyFinding, isChanged } from './findingBase';
import { binomialTwoSided, safeRatio } from './stats';
import { duration, per30, plural, ratio } from './format';

export const RECENT_DAYS = 30;
export const MIN_EARLIER_DAYS = 30;
export const MIN_TREND_OBSERVED = 14;
export const MIN_TREND_EVENTS = 3;

function splitWindow(ctx: AnalysisContext) {
  const recentStart = addDays(ctx.window.end, -(RECENT_DAYS - 1));
  const recentAll = recentStart < ctx.window.start ? ctx.days : eachDay(recentStart, ctx.window.end);
  const earlierAll = ctx.days.filter((d) => d < recentAll[0]);
  return { recentAll, earlierAll };
}

export function analyzeFrequencyTrend(ctx: AnalysisContext): PatternFinding {
  const { recentAll, earlierAll } = splitWindow(ctx);
  const recent = recentAll.filter((d) => ctx.obsByDate.has(d));
  const earlier = earlierAll.filter((d) => ctx.obsByDate.has(d));
  const gr = groupFor(ctx, `Most recent ${RECENT_DAYS} days`, recent);
  const ge = groupFor(ctx, `Earlier ${earlierAll.length} days`, earlier);
  const rr = safeRatio(gr.eventRate, ge.eventRate);
  const total = gr.events + ge.events;
  const stats: ComparisonStats = {
    rateRatio: rr,
    rateDifference: gr.eventRate !== null && ge.eventRate !== null ? gr.eventRate - ge.eventRate : null,
    metric: 'events per observed day',
    pValue: recent.length + earlier.length ? binomialTwoSided(gr.events, total, recent.length / (recent.length + earlier.length)) : null,
    test: 'Exact conditional binomial test (two-sided), recent vs earlier',
  };
  const finding = emptyFinding(ctx, {
    id: 'pattern-trend-frequency',
    factor: 'trend',
    title: 'Seizure frequency over time',
    method:
      `Seizure events per observed day in the most recent ${RECENT_DAYS} days are compared with the earlier part of ` +
      'the selected period. Days without a check-in are excluded from both. Exact conditional binomial test, exploratory.',
    discussionPoint: 'Review whether the recent seizure frequency differs from the patient’s usual pattern.',
    groups: [ge, gr],
    stats,
    completeness: { eligibleDays: recent.length + earlier.length, calendarDays: ctx.calendarDays },
    exclusions: ctx.unobservedDays.length
      ? [{ reason: 'No daily check-in', days: ctx.unobservedDays.length, events: ctx.unobservedDays.reduce((n, d) => n + (ctx.seizuresByDate.get(d)?.length ?? 0), 0) }]
      : [],
    confounders: [
      'Medication changes, missed doses, illness and sleep can differ between the two periods.',
      'Diary habits (how consistently seizures are logged) may change over time.',
    ],
    limitations: [OBSERVATIONAL_LIMITATION, 'Seizure counts naturally fluctuate; short periods give unstable rates.', MULTIPLE_COMPARISONS_LIMITATION],
  });

  if (earlierAll.length < MIN_EARLIER_DAYS) {
    finding.suppressionReason = `Select a period of at least ${RECENT_DAYS + MIN_EARLIER_DAYS} days so the recent ${RECENT_DAYS} days can be compared with at least ${MIN_EARLIER_DAYS} earlier days.`;
  } else if (recent.length < MIN_TREND_OBSERVED || earlier.length < MIN_TREND_OBSERVED) {
    finding.suppressionReason = `Both periods need at least ${MIN_TREND_OBSERVED} observed days (recent: ${recent.length}, earlier: ${earlier.length}).`;
  } else if (total < MIN_TREND_EVENTS) {
    finding.suppressionReason = `At least ${MIN_TREND_EVENTS} seizure events on observed days are needed (found ${total}).`;
  }
  if (finding.suppressionReason) {
    finding.status = 'insufficient-data';
    finding.title = 'Seizure frequency trend: not enough data';
    finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
    return finding;
  }

  const sentence =
    `${gr.events} events over ${gr.eligibleDays} observed days in the most recent ${RECENT_DAYS} days ` +
    `(${per30(gr.eventRate)} per 30 days) vs ${ge.events} over ${ge.eligibleDays} observed earlier days ` +
    `(${per30(ge.eventRate)} per 30 days); ratio ${ratio(rr)}.`;
  if (isChanged(stats)) {
    finding.status = 'possible-pattern';
    finding.title = rr! > 1 ? 'Recorded seizure frequency has increased recently' : 'Recorded seizure frequency has decreased recently';
    finding.explanation = `${sentence} A change in seizure frequency may warrant review with the treating clinician.`;
  } else {
    finding.status = 'no-clear-pattern';
    finding.title = 'Seizure frequency: no clear change';
    finding.explanation = `${sentence} The recorded frequency is broadly similar between the two periods.`;
  }
  return finding;
}

export function analyzeTypeChanges(ctx: AnalysisContext, data: HealthData): PatternFinding {
  const { recentAll, earlierAll } = splitWindow(ctx);
  const recentSet = new Set(recentAll);
  const earlierSet = new Set(earlierAll);
  const recentEvents = ctx.seizuresInWindow.filter((s) => recentSet.has(s.date));
  const earlierEvents = ctx.seizuresInWindow.filter((s) => earlierSet.has(s.date));
  const documented = new Set(
    data.history.flatMap((h) => h.tags.filter((t) => t.startsWith('seizure-type:')).map((t) => t.slice('seizure-type:'.length))),
  );
  const earlierTypes = new Set(earlierEvents.map((s) => s.type));
  const shortEarlier = earlierAll.length < MIN_EARLIER_DAYS;
  // With a short comparison period, still compare against the documented history (if any types are documented).
  const canCompare = !shortEarlier || documented.size > 0;
  const newTypes = canCompare
    ? [...new Set(recentEvents.map((s) => s.type))].filter((t): t is SeizureType => t !== 'unknown' && !earlierTypes.has(t) && !documented.has(t)).sort()
    : [];
  const prolonged = ctx.seizuresInWindow.filter((s) => (s.durationSeconds ?? 0) >= PROLONGED_SECONDS);

  const finding = emptyFinding(ctx, {
    id: 'pattern-trend-type',
    factor: 'trend',
    title: 'Seizure type and duration over time',
    method:
      `Seizure types recorded in the most recent ${RECENT_DAYS} days are compared with types recorded earlier in the ` +
      `period and with types documented in the medical history. Seizures lasting ≥ ${PROLONGED_SECONDS / 60} minutes are flagged.`,
    discussionPoint:
      'A new or different seizure type, or a prolonged seizure, may warrant prompt review with the treating clinician.',
    completeness: { eligibleDays: ctx.calendarDays, calendarDays: ctx.calendarDays },
    evidenceIds: prolonged.length ? ['cdc-seizure-first-aid', 'trinka-2015-status-epilepticus'] : [],
    confounders: ['Seizure type is patient- or witness-described and may be misclassified.'],
    limitations: [
      'Seizure types are self-reported labels, not EEG-confirmed classifications.',
      'Documented history may be incomplete.',
    ],
  });

  for (const t of newTypes) {
    const events = recentEvents.filter((s) => s.type === t);
    finding.details.push(
      `${SEIZURE_TYPE_LABELS[t]}: ${plural(events.length, 'event')} in the recent period (${events.map((e) => e.date).join(', ')}); not recorded ${shortEarlier ? 'in the documented history (the selected period is too short for an earlier comparison)' : 'earlier in the period or in the documented history'}.`,
    );
  }
  for (const s of prolonged) {
    finding.details.push(`Prolonged seizure on ${s.date}: ${duration(s.durationSeconds)} (≥ ${PROLONGED_SECONDS / 60} minutes).`);
  }

  if (!ctx.seizuresInWindow.length) {
    finding.status = 'insufficient-data';
    finding.suppressionReason = 'No seizures recorded in the selected period.';
    finding.title = 'Seizure type: no events in this period';
    finding.explanation = 'No seizures were recorded in the selected period, so type changes cannot be assessed.';
    return finding;
  }
  if (shortEarlier && !prolonged.length && !newTypes.length) {
    finding.status = 'insufficient-data';
    finding.suppressionReason = `Select a period of at least ${RECENT_DAYS + MIN_EARLIER_DAYS} days to compare recent seizure types with earlier ones.`;
    finding.title = 'Seizure type change: not enough data';
    finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
    return finding;
  }

  if (newTypes.length || prolonged.length) {
    finding.status = 'notable-change';
    const parts: string[] = [];
    if (newTypes.length) parts.push(`a seizure type not previously recorded (${newTypes.map((t) => SEIZURE_TYPE_LABELS[t].toLowerCase()).join(', ')})`);
    if (prolonged.length) parts.push(`${plural(prolonged.length, 'seizure')} lasting ${PROLONGED_SECONDS / 60} minutes or longer`);
    finding.title = newTypes.length ? 'New seizure type recorded recently' : 'Prolonged seizure recorded';
    finding.explanation = `The records include ${parts.join(' and ')}. This is a change that may warrant prompt clinician review; it is not used to predict any condition.`;
  } else {
    finding.status = 'no-clear-pattern';
    finding.title = 'Seizure types: no new type recorded';
    finding.explanation = `All seizure types in the most recent ${RECENT_DAYS} days were also recorded earlier or are documented in the history, and none lasted ${PROLONGED_SECONDS / 60} minutes or longer.`;
  }
  return finding;
}
