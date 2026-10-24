import { describe, expect, it } from 'vitest';
import { addDays, diffDays, eachDay, isValidISODate, windowDays } from './dates';
import { binomialTwoSided, fisherExactTwoSided } from './stats';
import { mapCycleDays, phaseFor, summarizeCycles } from './cycle';
import type { MenstrualRecord } from '../models/types';

describe('dates', () => {
  it('handles month and DST boundaries in UTC', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(diffDays('2026-07-23', '2026-10-20')).toBe(89);
    expect(eachDay('2026-07-23', '2026-10-20')).toHaveLength(90);
    expect(windowDays({ start: '2026-01-01', end: '2026-01-01' })).toBe(1);
  });
  it('validates ISO dates strictly', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-1-01')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe('exact tests', () => {
  it("Fisher's exact test matches a known value", () => {
    // [[3,1],[1,3]] two-sided p = 0.4857
    expect(fisherExactTwoSided(3, 1, 1, 3)).toBeCloseTo(0.4857, 3);
    expect(fisherExactTwoSided(0, 0, 0, 0)).toBe(1);
  });
  it('binomial two-sided test matches known values', () => {
    expect(binomialTwoSided(0, 10, 0.5)).toBeCloseTo(2 / 1024, 6);
    expect(binomialTwoSided(5, 10, 0.5)).toBeCloseTo(1, 6);
    expect(binomialTwoSided(0, 0, 0.3)).toBe(1);
  });
});

const rec = (id: string, start: string, end: string | null = null): MenstrualRecord => ({
  id,
  periodStart: start,
  periodEnd: end,
  startCertainty: 'exact',
  notes: '',
  isSynthetic: true,
});

describe('cycle mapping (Herzog et al. 1997 phases)', () => {
  it('assigns phases for a 28-day cycle', () => {
    expect(phaseFor(1, 28)).toBe('perimenstrual');
    expect(phaseFor(3, 28)).toBe('perimenstrual');
    expect(phaseFor(4, 28)).toBe('follicular');
    expect(phaseFor(9, 28)).toBe('follicular');
    expect(phaseFor(10, 28)).toBe('periovulatory');
    expect(phaseFor(16, 28)).toBe('periovulatory'); // day −13
    expect(phaseFor(17, 28)).toBe('luteal'); // day −12
    expect(phaseFor(25, 28)).toBe('luteal'); // day −4
    expect(phaseFor(26, 28)).toBe('perimenstrual'); // day −3
    expect(phaseFor(29, 28)).toBeNull();
  });

  it('distinguishes recorded, estimated and projected days', () => {
    const records = [rec('a', '2026-01-01', '2026-01-05'), rec('b', '2026-01-29', '2026-02-02')];
    const m = mapCycleDays(records, ['2026-01-02', '2026-01-15', '2026-02-10']);
    expect(m.get('2026-01-02')).toMatchObject({ basis: 'recorded', eligible: true, cycleDay: 2, phase: 'perimenstrual' });
    expect(m.get('2026-01-15')).toMatchObject({ basis: 'estimated', eligible: true, cycleDay: 15 });
    expect(m.get('2026-02-10')).toMatchObject({ basis: 'projected', eligible: false });
  });

  it('marks implausibly long cycles (likely a missing record) as ineligible', () => {
    const records = [rec('a', '2026-01-01'), rec('b', '2026-03-01')]; // 59 days
    const m = mapCycleDays(records, ['2026-01-20']);
    expect(m.get('2026-01-20')).toMatchObject({ bounded: true, eligible: false });
    expect(summarizeCycles(records).irregular).toHaveLength(1);
  });

  it('a single period record yields no eligible days (incomplete cycle record)', () => {
    const m = mapCycleDays([rec('a', '2026-01-01')], eachDay('2026-01-01', '2026-01-28'));
    expect([...m.values()].every((d) => !d.eligible)).toBe(true);
  });

  it('is independent of record order', () => {
    const records = [rec('a', '2026-01-01'), rec('b', '2026-01-29'), rec('c', '2026-02-27')];
    const days = eachDay('2026-01-01', '2026-03-10');
    const a = [...mapCycleDays(records, days).values()];
    const b = [...mapCycleDays([...records].reverse(), days).values()];
    expect(b).toEqual(a);
  });
});
