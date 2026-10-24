/** Unit tests for the pattern-discovery engine using small, hand-computed fixtures. */
import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { analyzeSleep } from './sleep';
import { analyzeMenstrual } from './menstrual';
import { analyzeMedicationChanges } from './medication';
import { analyzeFrequencyTrend, analyzeTypeChanges } from './trend';
import { runPatternAnalysis } from './index';
import { summarizeSeizures } from './completeness';
import { eachDay } from './dates';
import { DEFAULT_SETTINGS, type HealthData, type MenstrualRecord } from '../models/types';
import { emptyData, obs, sz } from '../test/fixtures';
import { createSyntheticDataset, SYNTHETIC_END, SYNTHETIC_START } from '../data/syntheticDataset';
import { reducer, initialState } from '../store/reducer';
import { evaluateConnections } from '../clinical/connections';
import { buildClinicianSummary, summaryToMarkdown } from '../summary/clinicianSummary';

const W = { start: '2026-01-01', end: '2026-01-30' };
const days = eachDay(W.start, W.end);

/** 30 days: days 1–12 short sleep (5 h), 13–30 adequate (7.5 h). */
function sleepFixture(): HealthData {
  return emptyData({
    observations: days.map((d, i) => obs(d, { sleepHours: i < 12 ? 5 : 7.5 })),
    seizures: [
      sz('2026-01-02'),
      sz('2026-01-02', { time: '18:00' }), // second event, same day
      sz('2026-01-05'),
      sz('2026-01-08'),
      sz('2026-01-11'),
      sz('2026-01-20'),
    ],
  });
}

describe('sleep analysis', () => {
  it('counts seizure days, not events, as exposure units', () => {
    const f = analyzeSleep(buildContext(sleepFixture(), W), DEFAULT_SETTINGS);
    expect(f.groups[0]).toMatchObject({ eligibleDays: 12, seizureDays: 4, events: 5 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 18, seizureDays: 1, events: 1 });
    expect(f.groups[0].seizureDayRate).toBeCloseTo(4 / 12);
    expect(f.stats!.rateRatio).toBeCloseTo(4 / 12 / (1 / 18));
  });

  it('excludes missing sleep rather than counting it as 0 hours', () => {
    const data = sleepFixture();
    // Blank out sleep on two adequate days; if missing were treated as 0 h they would join the short group.
    data.observations = data.observations.map((o) => (o.date === '2026-01-20' || o.date === '2026-01-21' ? { ...o, sleepHours: null } : o));
    const f = analyzeSleep(buildContext(data, W), DEFAULT_SETTINGS);
    expect(f.groups[0].eligibleDays).toBe(12);
    expect(f.groups[1].eligibleDays).toBe(16);
    expect(f.exclusions).toContainEqual({ reason: 'Check-in without sleep duration', days: 2, events: 1 });
    expect(f.completeness.eligibleDays).toBe(28);
  });

  it('excludes days without a check-in from denominators but reports their seizures', () => {
    const data = sleepFixture();
    data.observations = data.observations.filter((o) => o.date !== '2026-01-11');
    const f = analyzeSleep(buildContext(data, W), DEFAULT_SETTINGS);
    expect(f.groups[0]).toMatchObject({ eligibleDays: 11, seizureDays: 3, events: 4 });
    expect(f.exclusions[0]).toEqual({ reason: 'No daily check-in (sleep unknown)', days: 1, events: 1 });
  });

  it('suppresses the finding when a group is too small', () => {
    const data = sleepFixture();
    data.observations = data.observations.map((o, i) => (i < 12 && i > 4 ? { ...o, sleepHours: 7 } : o)); // only 5 short days
    const f = analyzeSleep(buildContext(data, W), DEFAULT_SETTINGS);
    expect(f.status).toBe('insufficient-data');
    expect(f.suppressionReason).toMatch(/at least 10/);
  });

  it('suppresses when there are too few seizure days', () => {
    const data = sleepFixture();
    data.seizures = data.seizures.slice(0, 3);
    expect(analyzeSleep(buildContext(data, W), DEFAULT_SETTINGS).status).toBe('insufficient-data');
  });
});

const cyc = (id: string, start: string): MenstrualRecord => ({ id, periodStart: start, periodEnd: null, startCertainty: 'exact', notes: '', isSynthetic: true });

describe('menstrual-cycle analysis', () => {
  const MW = { start: '2026-01-01', end: '2026-02-25' };
  const base = (): HealthData =>
    emptyData({
      observations: eachDay(MW.start, MW.end).map((d) => obs(d)),
      menstrual: [cyc('a', '2026-01-01'), cyc('b', '2026-01-29'), cyc('c', '2026-02-26')],
      seizures: [sz('2026-01-01'), sz('2026-01-02'), sz('2026-01-28'), sz('2026-01-29'), sz('2026-01-30'), sz('2026-02-15')],
    });

  it('uses eligible observed days per phase as the denominator', () => {
    const f = analyzeMenstrual(buildContext(base(), MW), base());
    const peri = f.groups.find((g) => g.label === 'Perimenstrual')!;
    // Two 28-day cycles → 6 perimenstrual days each = 12 days.
    expect(peri.eligibleDays).toBe(12);
    expect(peri.events).toBe(5);
    expect(f.groups.reduce((n, g) => n + g.eligibleDays, 0)).toBe(56);
    expect(f.status).toBe('possible-pattern');
  });

  it('suppresses with only one bounded cycle (incomplete records)', () => {
    const data = base();
    data.menstrual = data.menstrual.slice(0, 2);
    const f = analyzeMenstrual(buildContext(data, MW), data);
    expect(f.status).toBe('insufficient-data');
    expect(f.suppressionReason).toMatch(/2 cycles/);
  });

  it('is not applicable without cycle records, and says so without assuming absence', () => {
    const data = base();
    data.menstrual = [];
    const f = analyzeMenstrual(buildContext(data, MW), data);
    expect(f.status).toBe('not-applicable');
    expect(f.explanation).toMatch(/not interpreted as the absence/);
  });
});

describe('medication-change analysis', () => {
  const MW = { start: '2026-01-01', end: '2026-03-31' };
  const make = (): HealthData =>
    emptyData({
      observations: eachDay(MW.start, MW.end).map((d) => obs(d)),
      medications: [
        { id: 'm1', name: 'Drug A', indication: '', kind: 'prescription', startDate: '2025-01-01', endDate: null, initialDose: '100 mg', frequency: 'bd', source: 'clinician-documented', notes: '', isSynthetic: true },
      ],
      medicationEvents: [
        { id: 'e1', medicationId: 'm1', date: '2026-02-15', kind: 'dose-change', newDose: '200 mg', description: '', source: 'clinician-documented', isSynthetic: true },
        { id: 'e2', medicationId: 'm1', date: '2026-02-10', kind: 'missed-dose', newDose: null, description: '', source: 'patient-reported', isSynthetic: true },
      ],
      seizures: ['2026-01-20', '2026-01-25', '2026-02-01', '2026-02-05', '2026-02-10', '2026-02-12', '2026-02-20'].map((d) => sz(d)),
    });

  it('compares 28 observed days before and after a change inside the window', () => {
    const [f] = analyzeMedicationChanges(buildContext(make(), MW), make());
    expect(f.groups[0]).toMatchObject({ eligibleDays: 28, events: 6 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 28, events: 1 });
    expect(f.confounders.join(' ')).toMatch(/missed dose/);
    expect(f.limitations[0]).toMatch(/temporal association, not a measure of whether the medication works/);
    expect(f.explanation).not.toMatch(/works|effective|improved/i);
  });

  it('ignores changes outside the observation window', () => {
    const data = make();
    const fs = analyzeMedicationChanges(buildContext(data, { start: '2026-03-01', end: '2026-03-31' }), data);
    expect(fs).toHaveLength(1);
    expect(fs[0].status).toBe('not-applicable');
  });

  it('suppresses when follow-up is too short', () => {
    const data = make();
    const [f] = analyzeMedicationChanges(buildContext(data, { start: '2026-01-01', end: '2026-02-20' }), data);
    expect(f.status).toBe('insufficient-data');
  });
});

describe('trend analysis', () => {
  it('needs at least 60 days for a frequency comparison', () => {
    const data = sleepFixture();
    expect(analyzeFrequencyTrend(buildContext(data, W)).status).toBe('insufficient-data');
  });
  it('flags a new seizure type not in history', () => {
    const TW = { start: '2026-01-01', end: '2026-03-31' };
    const data = emptyData({
      observations: eachDay(TW.start, TW.end).map((d) => obs(d)),
      seizures: [sz('2026-01-10'), sz('2026-03-20', { type: 'generalized-tonic-clonic' })],
    });
    const f = analyzeTypeChanges(buildContext(data, TW), data);
    expect(f.status).toBe('notable-change');
    data.history = [{ id: 'h', kind: 'diagnosis', label: 'Epilepsy', status: 'confirmed', source: 'clinician-documented', date: null, tags: ['epilepsy', 'seizure-type:generalized-tonic-clonic'], notes: '', isSynthetic: true }];
    expect(analyzeTypeChanges(buildContext(data, TW), data).status).toBe('no-clear-pattern');
  });
  it('with a 30-day period, still flags a type absent from documented history (safety)', () => {
    const data = createSyntheticDataset();
    const f = analyzeTypeChanges(buildContext(data, { start: '2026-09-21', end: SYNTHETIC_END }), data);
    expect(f.status).toBe('notable-change');
    expect(f.details[0]).toMatch(/documented history/);
    // Without any documented types and a short period, there is nothing to compare against.
    const noHistory = { ...data, history: [] };
    expect(analyzeTypeChanges(buildContext(noHistory, { start: '2026-09-21', end: SYNTHETIC_END }), noHistory).status).toBe('insufficient-data');
  });
});

// ---------------------------------------------------------------------------------------------------------------

/** Deterministic shuffle (LCG) so the test is reproducible. */
function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('engine invariants on the synthetic dataset', () => {
  const SW = { start: SYNTHETIC_START, end: SYNTHETIC_END };

  it('reordering input records does not change any result', () => {
    const data = createSyntheticDataset();
    const shuffled: HealthData = {
      ...data,
      seizures: shuffle(data.seizures, 1),
      observations: shuffle(data.observations, 2),
      menstrual: shuffle(data.menstrual, 3),
      medications: shuffle(data.medications, 4),
      medicationEvents: shuffle(data.medicationEvents, 5),
      history: shuffle(data.history, 6),
    };
    const fa = runPatternAnalysis(data, SW, DEFAULT_SETTINGS);
    const fb = runPatternAnalysis(shuffled, SW, DEFAULT_SETTINGS);
    expect(fb).toEqual(fa);
    const ca = evaluateConnections(data, fa, SW);
    const cb = evaluateConnections(shuffled, fb, SW);
    expect(cb).toEqual(ca);
    shuffled.tasks = shuffle(data.tasks, 7);
    expect(summaryToMarkdown(buildClinicianSummary(shuffled, fb, cb, SW, DEFAULT_SETTINGS))).toBe(summaryToMarkdown(buildClinicianSummary(data, fa, ca, SW, DEFAULT_SETTINGS)));
  });

  it('event counts in any group never exceed recorded events', () => {
    const data = createSyntheticDataset();
    const total = summarizeSeizures(data, SW).totalEvents;
    for (const f of runPatternAnalysis(data, SW, DEFAULT_SETTINGS)) {
      const sum = f.groups.reduce((n, g) => n + g.events, 0);
      expect(sum).toBeLessThanOrEqual(total);
      for (const g of f.groups) {
        expect(g.seizureDays).toBeLessThanOrEqual(g.events);
        expect(g.seizureDays).toBeLessThanOrEqual(g.eligibleDays);
      }
    }
  });

  it('is deterministic: the synthetic generator produces identical data', () => {
    expect(createSyntheticDataset()).toEqual(createSyntheticDataset());
    expect(createSyntheticDataset().seizures.every((s) => s.isSynthetic)).toBe(true);
  });

  it('recalculates after editing and deleting records', () => {
    let state = initialState();
    const before = runPatternAnalysis(state.data, SW, DEFAULT_SETTINGS).find((f) => f.id === 'pattern-sleep')!;
    expect(before.groups[0].seizureDays).toBe(9);

    // Edit: the night before the 2026-07-26 seizure becomes 7.5 h (moves one seizure day to the adequate group).
    const o = state.data.observations.find((x) => x.date === '2026-07-26')!;
    state = reducer(state, { type: 'upsert', collection: 'observations', record: { ...o, sleepHours: 7.5 } });
    const edited = runPatternAnalysis(state.data, SW, DEFAULT_SETTINGS).find((f) => f.id === 'pattern-sleep')!;
    expect(edited.groups[0]).toMatchObject({ eligibleDays: 23, seizureDays: 8 });
    expect(edited.groups[1]).toMatchObject({ eligibleDays: 57, seizureDays: 4 });

    // Delete: remove both seizures on 2026-08-09.
    for (const s of state.data.seizures.filter((x) => x.date === '2026-08-09')) state = reducer(state, { type: 'delete', collection: 'seizures', id: s.id });
    const deleted = runPatternAnalysis(state.data, SW, DEFAULT_SETTINGS);
    expect(deleted.find((f) => f.id === 'pattern-sleep')!.groups[0]).toMatchObject({ seizureDays: 7, events: 8 });
    expect(summarizeSeizures(state.data, SW).totalEvents).toBe(13);
  });
});
