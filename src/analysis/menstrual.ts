/**
 * Seizure rates by menstrual-cycle phase.
 *
 * Denominator: eligible observed days = days with a check-in that fall in a bounded cycle (next start recorded) of
 * plausible length (21–45 days). Rate = seizure events per eligible day ("average daily seizure frequency", as in
 * Herzog et al. 1997). Pre-specified comparisons: perimenstrual (C1) and periovulatory (C2) vs all other eligible
 * days. A possible pattern requires ≥ 2× the rate on other days (Herzog's proposed twofold definition), events in
 * ≥ 2 different cycles, and a Bonferroni-adjusted exploratory p < 0.025.
 */
import type { ComparisonStats, PatternFinding } from '../models/analysis';
import type { AnalysisSettings, HealthData, ISODate } from '../models/types';
import { DEFAULT_SETTINGS } from '../models/types';
import type { AnalysisContext } from './context';
import { eventsOn, groupFor } from './context';
import { PHASE_LABELS, summarizeCycles, type CyclePhase } from './cycle';
import { ALPHA, MULTIPLE_COMPARISONS_LIMITATION, OBSERVATIONAL_LIMITATION, compact, computeOverlap, emptyFinding, exclusion, seizureDaysIn } from './findingBase';
import { binomialTwoSided, safeRatio } from './stats';
import { pct, plural, ratio } from './format';

export const MIN_BOUNDED_CYCLES = 2;
export const MIN_PHASE_DAYS = 5;
export const MIN_ELIGIBLE_EVENTS = 5;
export const CATAMENIAL_RATIO = 2;
const PRESPECIFIED: CyclePhase[] = ['perimenstrual', 'periovulatory'];
const PHASE_ORDER: CyclePhase[] = ['perimenstrual', 'follicular', 'periovulatory', 'luteal'];

export function analyzeMenstrual(ctx: AnalysisContext, data: HealthData, settings: AnalysisSettings = DEFAULT_SETTINGS): PatternFinding {
  const finding = emptyFinding(ctx, {
    id: 'pattern-menstrual',
    factor: 'menstrual-cycle',
    title: 'Menstrual-cycle phase and seizures',
    method:
      'Cycle days are counted from recorded period starts (day 1 = first day of bleeding). Phases follow Herzog et al. ' +
      '(1997): perimenstrual −3…+3, follicular 4…9, periovulatory 10…−13, luteal −12…−4. Only observed days in cycles ' +
      'with both start dates recorded and a length of 21–45 days are eligible. Seizure events per eligible day are ' +
      'compared for the pre-specified perimenstrual and periovulatory phases against all other eligible days ' +
      '(exact conditional binomial test, Bonferroni-adjusted α = 0.025).',
    discussionPoint:
      'Review whether the timing of seizures relative to the menstrual cycle is clinically relevant and whether further cycle charting would help.',
    evidenceIds: ['herzog-1997-catamenial'],
  });

  if (!ctx.hasMenstrualRecords || data.profile.sex === 'male') {
    finding.status = 'not-applicable';
    finding.title = 'Menstrual cycle: no cycle records';
    finding.explanation =
      'No menstrual-cycle records are stored, so cycle timing is not analysed. This is not interpreted as the absence of a cycle.';
    finding.suppressionReason = 'No menstrual-cycle records.';
    return finding;
  }

  const days = ctx.days;
  const info = (d: ISODate) => ctx.cycle.get(d);
  const eligible = days.filter((d) => ctx.obsByDate.has(d) && info(d)?.eligible && info(d)?.phase);
  const projected = days.filter((d) => !info(d)?.bounded);
  const irregular = days.filter((d) => info(d)?.bounded && !info(d)?.eligible);
  const unobservedBounded = days.filter((d) => !ctx.obsByDate.has(d) && info(d)?.eligible);

  finding.exclusions = compact([
    exclusion(ctx, 'Outside a cycle with both start dates recorded (projected phase)', projected),
    exclusion(ctx, 'Cycle length outside 21–45 days (possible missing record)', irregular),
    exclusion(ctx, 'No daily check-in', unobservedBounded),
  ]);
  finding.completeness = { eligibleDays: eligible.length, calendarDays: ctx.calendarDays };

  const byPhase = new Map<CyclePhase, ISODate[]>();
  for (const p of PHASE_ORDER) byPhase.set(p, []);
  for (const d of eligible) byPhase.get(info(d)!.phase!)!.push(d);
  finding.groups = PHASE_ORDER.map((p) => groupFor(ctx, PHASE_LABELS[p], byPhase.get(p)!));

  const cyclesInWindow = new Set(eligible.map((d) => info(d)!.cycleIndex));
  const totalEvents = eligible.reduce((n, d) => n + eventsOn(ctx, d), 0);
  const summary = summarizeCycles(data.menstrual);

  finding.confounders = [
    'Sleep, stress and missed doses can cluster around particular cycle phases.',
    'Hormonal contraception or other hormonal treatment (if any) is not recorded here and can change cycle timing.',
  ];
  finding.limitations = [
    OBSERVATIONAL_LIMITATION,
    'Ovulation is not confirmed (no hormone or temperature data); non-menstrual phases are calendar estimates.',
    'Few cycles are observed; a pattern needs confirmation over more cycles.',
    MULTIPLE_COMPARISONS_LIMITATION,
  ];
  if (summary.irregular.length) {
    finding.details.push(
      ...summary.irregular.map((c) => `Cycle starting ${c.start} lasted ${c.length} days and was excluded as implausible or incomplete.`),
    );
  }
  const approx = data.menstrual.filter((m) => m.startCertainty === 'approximate');
  if (approx.length) {
    finding.limitations.push(`${plural(approx.length, 'period start date')} recorded as approximate.`);
  }

  if (cyclesInWindow.size < MIN_BOUNDED_CYCLES) {
    finding.suppressionReason = `At least ${MIN_BOUNDED_CYCLES} cycles with both start dates recorded are needed in the period (found ${cyclesInWindow.size}).`;
  } else if (totalEvents < MIN_ELIGIBLE_EVENTS) {
    finding.suppressionReason = `At least ${MIN_ELIGIBLE_EVENTS} seizure events on eligible days are needed (found ${totalEvents}).`;
  } else {
    const small = finding.groups.filter((g) => g.eligibleDays < MIN_PHASE_DAYS);
    if (small.length)
      finding.suppressionReason = `Each phase needs at least ${MIN_PHASE_DAYS} eligible days (${small.map((g) => `${g.label}: ${g.eligibleDays}`).join(', ')}).`;
  }
  if (finding.suppressionReason) {
    finding.status = 'insufficient-data';
    finding.title = 'Menstrual cycle: not enough data yet';
    finding.explanation = `This comparison is suppressed. ${finding.suppressionReason}`;
    return finding;
  }

  // Evaluate pre-specified phases.
  const alpha = ALPHA / PRESPECIFIED.length;
  const evaluations = PRESPECIFIED.map((phase) => {
    const inPhase = byPhase.get(phase)!;
    const others = eligible.filter((d) => info(d)!.phase !== phase);
    const g = groupFor(ctx, PHASE_LABELS[phase], inPhase);
    const o = groupFor(ctx, 'All other eligible days', others);
    const rr = safeRatio(g.eventRate, o.eventRate);
    const p = binomialTwoSided(g.events, g.events + o.events, inPhase.length / eligible.length);
    const cyclesWithEvents = new Set(inPhase.filter((d) => eventsOn(ctx, d) > 0).map((d) => info(d)!.cycleIndex));
    const stats: ComparisonStats = {
      rateRatio: rr,
      rateDifference: g.eventRate !== null && o.eventRate !== null ? g.eventRate - o.eventRate : null,
      metric: 'events per observed day',
      pValue: p,
      test: `Exact conditional binomial test (two-sided), ${PHASE_LABELS[phase].toLowerCase()} vs other eligible days`,
    };
    const meets =
      p < alpha && cyclesWithEvents.size >= 2 && (rr === null ? (g.eventRate ?? 0) > 0 : rr >= CATAMENIAL_RATIO);
    return { phase, g, o, stats, meets, cyclesWithEvents: cyclesWithEvents.size, inPhase };
  });

  const best =
    evaluations.find((e) => e.meets) ??
    [...evaluations].sort((a, b) => (b.stats.rateRatio ?? 0) - (a.stats.rateRatio ?? 0))[0];
  finding.stats = best.stats;
  finding.details.push(
    ...evaluations.map(
      (e) =>
        `${PHASE_LABELS[e.phase]}: ${e.g.events} events over ${e.g.eligibleDays} eligible days vs ${e.o.events} over ${e.o.eligibleDays} other days (ratio ${ratio(e.stats.rateRatio)}; events in ${plural(e.cyclesWithEvents, 'cycle')}).`,
    ),
  );
  finding.involvedDates = seizureDaysIn(ctx, best.inPhase);
  finding.confounderOverlap = computeOverlap(ctx, finding.involvedDates, {
    shortSleepBelow: settings.sleepThresholdHours,
    highStressAtLeast: settings.highStressThreshold,
    include: ['short-sleep', 'high-stress', 'illness', 'missed-dose'],
  });

  const label = PHASE_LABELS[best.phase].toLowerCase();
  const sentence =
    `Across ${plural(cyclesInWindow.size, 'observed cycle')}, ${best.g.events} seizure events were recorded on ` +
    `${best.g.eligibleDays} eligible ${label} days (${best.g.eventRate!.toFixed(2)} per day) vs ${best.o.events} events on ` +
    `${best.o.eligibleDays} other eligible days (${best.o.eventRate!.toFixed(2)} per day).`;

  if (best.meets) {
    finding.status = 'possible-pattern';
    finding.title = `Possible pattern: higher seizure rate in the ${label} phase`;
    finding.explanation = `${sentence} The ${label} rate is ${ratio(best.stats.rateRatio, 1)}× the rate on other days, above the twofold level used in published definitions of catamenial patterns. This is a calculated pattern for clinician review, not a diagnosis.`;
  } else {
    finding.status = 'no-clear-pattern';
    finding.title = 'No clear difference across cycle phases';
    finding.explanation = `${sentence} These records do not show a clear phase-related difference (share of eligible days in this phase: ${pct(best.g.eligibleDays / eligible.length)}).`;
  }
  return finding;
}
