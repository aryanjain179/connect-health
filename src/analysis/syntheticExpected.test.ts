/**
 * Expected outputs for the default synthetic dataset (documented in docs/DATASET.md).
 * Values were derived by hand from the dataset specification and are checked here against the engine.
 */
import { describe, expect, it } from 'vitest';
import { createSyntheticDataset, SYNTHETIC_END, SYNTHETIC_START } from '../data/syntheticDataset';
import { runPatternAnalysis } from './index';
import { DEFAULT_SETTINGS } from '../models/types';
import { summarizeSeizures, computeCompleteness } from './completeness';

const W = { start: SYNTHETIC_START, end: SYNTHETIC_END };
const data = createSyntheticDataset();
const findings = runPatternAnalysis(data, W, DEFAULT_SETTINGS);
const byId = (id: string) => {
  const f = findings.find((x) => x.id === id);
  if (!f) throw new Error(`missing finding ${id}`);
  return f;
};

describe('synthetic dataset – descriptive counts', () => {
  it('has 90 calendar days, 83 check-ins and 7 missing days', () => {
    const c = computeCompleteness(data, W);
    expect(c.calendarDays).toBe(90);
    expect(c.checkInDays).toBe(83);
    expect(c.missingDays).toHaveLength(7);
    expect(c.fields.find((f) => f.key === 'sleepHours')!.recordedDays).toBe(80);
    expect(c.fields.find((f) => f.key === 'stressLevel')!.recordedDays).toBe(80);
  });

  it('counts 15 events on 13 seizure days; 1 event on a day without a check-in', () => {
    const s = summarizeSeizures(data, W);
    expect(s.totalEvents).toBe(15);
    expect(s.seizureDays).toBe(13);
    expect(s.eventsOnObservedDays).toBe(14);
    expect(s.eventsOnDaysWithoutCheckIn).toBe(1);
    expect(s.mostRecentOverall?.date).toBe('2026-10-18');
    expect(s.prolonged).toHaveLength(0);
  });
});

describe('synthetic dataset – sleep', () => {
  const f = byId('pattern-sleep');
  it('compares 24 short-sleep days with 56 adequate-sleep days', () => {
    expect(f.groups[0]).toMatchObject({ eligibleDays: 24, seizureDays: 9, events: 11 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 56, seizureDays: 3, events: 3 });
    expect(f.stats!.rateRatio).toBeCloseTo(7.0, 5);
    expect(f.status).toBe('possible-pattern');
  });
  it('reports exclusions for missing check-ins and missing sleep', () => {
    expect(f.exclusions).toEqual([
      { reason: 'No daily check-in (sleep unknown)', days: 7, events: 1 },
      { reason: 'Check-in without sleep duration', days: 3, events: 0 },
    ]);
  });
  it('runs a sensitivity analysis without nocturnal-only seizure days', () => {
    expect(f.sensitivity!.groups[0]).toMatchObject({ eligibleDays: 22, seizureDays: 7 });
    expect(f.sensitivity!.groups[1]).toMatchObject({ eligibleDays: 56, seizureDays: 3 });
  });
});

describe('synthetic dataset – menstrual cycle', () => {
  const f = byId('pattern-menstrual');
  it('uses 71 eligible days across four phases', () => {
    expect(f.completeness.eligibleDays).toBe(71);
    expect(f.groups.map((g) => [g.label, g.eligibleDays, g.events])).toEqual([
      ['Perimenstrual', 15, 7],
      ['Follicular', 9, 0],
      ['Periovulatory', 20, 2],
      ['Luteal', 27, 3],
    ]);
  });
  it('flags a possible perimenstrual pattern', () => {
    expect(f.status).toBe('possible-pattern');
    expect(f.stats!.rateRatio).toBeCloseTo((7 / 15) / (5 / 56), 5);
    expect(f.stats!.pValue!).toBeLessThan(0.025);
  });
});

describe('synthetic dataset – medication changes', () => {
  it('levetiracetam dose change: 5 events / 26 days before vs 3 / 25 after, no clear change', () => {
    const f = findings.find((x) => x.id.startsWith('pattern-medication-med-lev:dose'))!;
    expect(f.groups[0]).toMatchObject({ eligibleDays: 26, events: 5, seizureDays: 4 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 25, events: 3, seizureDays: 3 });
    expect(f.status).toBe('no-clear-pattern');
    expect(f.confounders.join(' ')).toContain('2026-08-23');
  });
  it('melatonin start is suppressed for insufficient follow-up', () => {
    const f = findings.find((x) => x.id.startsWith('pattern-medication-med-mel:start'))!;
    expect(f.status).toBe('insufficient-data');
    expect(f.groups[1].eligibleDays).toBe(9);
  });
});

describe('synthetic dataset – stress and trend', () => {
  it('stress: 2/14 high-stress vs 10/66 lower-stress days, no clear pattern', () => {
    const f = byId('pattern-stress');
    expect(f.groups[0]).toMatchObject({ eligibleDays: 14, seizureDays: 2 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 66, seizureDays: 10 });
    expect(f.status).toBe('no-clear-pattern');
  });
  it('frequency: 9 events / 55 earlier days vs 5 / 28 recent days, no clear change', () => {
    const f = byId('pattern-trend-frequency');
    expect(f.groups[0]).toMatchObject({ eligibleDays: 55, events: 9 });
    expect(f.groups[1]).toMatchObject({ eligibleDays: 28, events: 5 });
    expect(f.status).toBe('no-clear-pattern');
  });
  it('type: new focal-to-bilateral tonic-clonic seizure is a notable change', () => {
    const f = byId('pattern-trend-type');
    expect(f.status).toBe('notable-change');
    expect(f.details.join(' ')).toContain('2026-10-14');
  });
});
