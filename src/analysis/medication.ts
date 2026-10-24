/**
 * Seizure rates around medication changes (start, stop, dose change).
 *
 * For each change on day D inside the analysis window, compare observed days D−28…D−1 ("before") with D+1…D+28
 * ("after"); D itself is excluded. Both windows are clipped to the analysis window. Results are TEMPORAL
 * ASSOCIATIONS only – they do not measure whether a treatment works (no control group, regression to the mean,
 * titration time, adherence and other changes are not accounted for).
 */
import type { ComparisonStats, PatternFinding } from '../models/analysis';
import type { HealthData, ISODate, Medication } from '../models/types';
import type { AnalysisContext } from './context';
import { groupFor, sortByDateId } from './context';
import { addDays, diffDays, eachDay, inWindow } from './dates';
import { MULTIPLE_COMPARISONS_LIMITATION, emptyFinding, isChanged } from './findingBase';
import { binomialTwoSided, safeRatio } from './stats';
import { per30, plural, ratio } from './format';

export const MED_WINDOW_DAYS = 28;
export const MIN_MED_OBSERVED_DAYS = 14;
export const MIN_MED_EVENTS = 3;

export interface ChangePoint {
  id: string;
  medication: Medication;
  date: ISODate;
  kind: 'start' | 'stop' | 'dose-change';
  description: string;
}

export function findChangePoints(data: HealthData, ctx: AnalysisContext): ChangePoint[] {
  const out: ChangePoint[] = [];
  const meds = [...data.medications].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const m of meds) {
    if (inWindow(m.startDate, ctx.window))
      out.push({ id: `${m.id}:start:${m.startDate}`, medication: m, date: m.startDate, kind: 'start', description: `${m.name} started (${m.initialDose}, ${m.frequency})` });
    if (m.endDate && inWindow(m.endDate, ctx.window))
      out.push({ id: `${m.id}:stop:${m.endDate}`, medication: m, date: m.endDate, kind: 'stop', description: `${m.name} stopped` });
  }
  for (const e of sortByDateId(data.medicationEvents)) {
    if (e.kind !== 'dose-change' || !inWindow(e.date, ctx.window)) continue;
    const m = data.medications.find((x) => x.id === e.medicationId);
    if (!m) continue;
    out.push({ id: `${m.id}:dose:${e.date}:${e.id}`, medication: m, date: e.date, kind: 'dose-change', description: `${m.name} dose changed${e.newDose ? ` to ${e.newDose}` : ''}` });
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : 1));
}

function clip(ctx: AnalysisContext, start: ISODate, end: ISODate): ISODate[] {
  const s = start < ctx.window.start ? ctx.window.start : start;
  const e = end > ctx.window.end ? ctx.window.end : end;
  return s <= e ? eachDay(s, e) : [];
}

export function analyzeMedicationChanges(ctx: AnalysisContext, data: HealthData): PatternFinding[] {
  const points = findChangePoints(data, ctx);
  if (!points.length) {
    const f = emptyFinding(ctx, {
      id: 'pattern-medication-none',
      factor: 'medication',
      title: 'Medication changes: none in this period',
      method: 'Looks for medication starts, stops and dose changes inside the selected period.',
      discussionPoint: 'No medication change to review in the selected period.',
    });
    f.status = 'not-applicable';
    f.explanation = 'No medication starts, stops or dose changes were recorded in the selected period.';
    f.suppressionReason = 'No change points.';
    return [f];
  }

  const events = sortByDateId(data.medicationEvents);
  return points.map((cp) => {
    const beforeAll = clip(ctx, addDays(cp.date, -MED_WINDOW_DAYS), addDays(cp.date, -1));
    const afterAll = clip(ctx, addDays(cp.date, 1), addDays(cp.date, MED_WINDOW_DAYS));
    const before = beforeAll.filter((d) => ctx.obsByDate.has(d));
    const after = afterAll.filter((d) => ctx.obsByDate.has(d));
    const gb = groupFor(ctx, `${MED_WINDOW_DAYS} days before`, before);
    const ga = groupFor(ctx, `${MED_WINDOW_DAYS} days after`, after);

    const rr = safeRatio(ga.eventRate, gb.eventRate);
    const total = ga.events + gb.events;
    const stats: ComparisonStats = {
      rateRatio: rr,
      rateDifference: ga.eventRate !== null && gb.eventRate !== null ? ga.eventRate - gb.eventRate : null,
      metric: 'events per observed day',
      pValue: before.length + after.length ? binomialTwoSided(ga.events, total, after.length / (before.length + after.length)) : null,
      test: 'Exact conditional binomial test (two-sided), after vs before',
    };

    const missedBefore = events.filter((e) => e.kind === 'missed-dose' && beforeAll.includes(e.date));
    const missedAfter = events.filter((e) => e.kind === 'missed-dose' && afterAll.includes(e.date));
    const sideEffects = events.filter(
      (e) => e.kind === 'side-effect' && e.medicationId === cp.medication.id && afterAll.includes(e.date),
    );
    const otherChanges = findChangePoints(data, ctx).filter(
      (o) => o.id !== cp.id && Math.abs(diffDays(cp.date, o.date)) <= MED_WINDOW_DAYS,
    );

    const finding = emptyFinding(ctx, {
      id: `pattern-medication-${cp.id}`,
      factor: 'medication',
      title: `${cp.description}: seizures before and after`,
      method:
        `Seizure events per observed day in the ${MED_WINDOW_DAYS} days before ${cp.date} are compared with the ` +
        `${MED_WINDOW_DAYS} days after (the change day is excluded; windows are limited to the selected period). ` +
        'Exact conditional binomial test, exploratory.',
      discussionPoint:
        'Review the seizure diary around this change together with adherence, side effects and other changes. Any treatment decision rests with the treating clinician.',
      groups: [gb, ga],
      stats,
      completeness: { eligibleDays: before.length + after.length, calendarDays: beforeAll.length + afterAll.length },
      exclusions: [
        { reason: 'Days without a check-in in the before/after windows', days: beforeAll.length + afterAll.length - before.length - after.length, events: [...beforeAll, ...afterAll].filter((d) => !ctx.obsByDate.has(d)).reduce((n, d) => n + (ctx.seizuresByDate.get(d)?.length ?? 0), 0) },
        { reason: 'Change day itself', days: 1, events: ctx.seizuresByDate.get(cp.date)?.length ?? 0 },
      ].filter((e) => e.days > 0),
      confounders: [
        ...(missedBefore.length ? [`${plural(missedBefore.length, 'missed dose')} logged in the before window (${missedBefore.map((e) => e.date).join(', ')}).`] : []),
        ...(missedAfter.length ? [`${plural(missedAfter.length, 'missed dose')} logged in the after window (${missedAfter.map((e) => e.date).join(', ')}).`] : []),
        ...otherChanges.map((o) => `Another medication change within ${MED_WINDOW_DAYS} days: ${o.description} on ${o.date}.`),
        'Changes are often made after a period with more seizures, so some decrease afterwards can be expected by chance (regression to the mean).',
        'Sleep, stress and cycle timing may differ between the two windows.',
      ],
      limitations: [
        'This is a temporal association, not a measure of whether the medication works.',
        'Medications may take time to reach a steady effect; the windows are fixed and arbitrary.',
        'Missed doses are known only when logged.',
        MULTIPLE_COMPARISONS_LIMITATION,
      ],
      details: sideEffects.map((e) => `Side effect reported ${e.date}: ${e.description}`),
      involvedDates: [cp.date],
      highlightRanges: [
        ...(beforeAll.length ? [{ start: beforeAll[0], end: beforeAll[beforeAll.length - 1], label: 'Before change' }] : []),
        ...(afterAll.length ? [{ start: afterAll[0], end: afterAll[afterAll.length - 1], label: 'After change' }] : []),
      ],
    });

    if (before.length < MIN_MED_OBSERVED_DAYS || after.length < MIN_MED_OBSERVED_DAYS) {
      finding.status = 'insufficient-data';
      finding.suppressionReason = `Both windows need at least ${MIN_MED_OBSERVED_DAYS} observed days inside the selected period (before: ${before.length}, after: ${after.length}).`;
      finding.title = `${cp.description}: not enough follow-up yet`;
      finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
      return finding;
    }
    if (total < MIN_MED_EVENTS) {
      finding.status = 'insufficient-data';
      finding.suppressionReason = `At least ${MIN_MED_EVENTS} seizure events across both windows are needed (found ${total}).`;
      finding.title = `${cp.description}: too few seizures to compare`;
      finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
      return finding;
    }

    const sentence =
      `${gb.events} seizure events were recorded over ${gb.eligibleDays} observed days before (${per30(gb.eventRate)} per 30 days) ` +
      `and ${ga.events} over ${ga.eligibleDays} observed days after (${per30(ga.eventRate)} per 30 days), a ratio of ${ratio(rr)}.`;
    if (isChanged(stats)) {
      finding.status = 'possible-pattern';
      finding.title = `${cp.description}: seizure rate ${rr! < 1 ? 'lower' : 'higher'} afterwards (temporal association)`;
      finding.explanation = `${sentence} The timing lines up with the change, but this is a temporal association and does not show a treatment effect.`;
    } else {
      finding.status = 'no-clear-pattern';
      finding.title = `${cp.description}: no clear change in recorded seizure rate`;
      finding.explanation = `${sentence} With these small numbers the difference is not clear, and it would not show a treatment effect either way.`;
    }
    return finding;
  });
}
