import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './reducer';
import { exportJson, loadState, parseImport, saveState, STORAGE_KEY } from './storage';
import { validateMedication, validateMenstrual, validateObservation, validateSeizure, validateTask } from './validation';
import { obs, sz } from '../test/fixtures';

const TODAY = '2026-10-24';

describe('persistence', () => {
  it('round-trips state through localStorage (survives a refresh)', () => {
    let s = initialState();
    s = reducer(s, { type: 'upsert', collection: 'seizures', record: sz('2026-10-21', { id: 'new-1' }) });
    s = reducer(s, { type: 'setSettings', settings: { sleepThresholdHours: 7 } });
    s = reducer(s, { type: 'setPeriod', period: '30' });
    saveState(s);
    const loaded = loadState();
    expect(loaded.source).toBe('stored');
    expect(loaded.state).toEqual(s);
  });

  it('seeds the synthetic dataset when nothing is stored, and recovers from corrupt data', () => {
    expect(loadState().source).toBe('seed');
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState().source).toBe('invalid');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: { data: { profile: {} } } }));
    const r = loadState();
    expect(r.source).toBe('invalid');
    expect(r.state.data.seizures).toHaveLength(15);
  });

  it('exports and re-imports data; rejects invalid files', () => {
    const data = initialState().data;
    expect(parseImport(exportJson(data))).toEqual(data);
    expect(() => parseImport('{"format":"healthconnect-export","data":{"seizures":[]}}')).toThrow();
  });
});

describe('reducer', () => {
  it('upserts, deletes and cascades medication deletion to its events', () => {
    let s = initialState();
    const n = s.data.medicationEvents.filter((e) => e.medicationId === 'med-lev').length;
    expect(n).toBeGreaterThan(0);
    s = reducer(s, { type: 'delete', collection: 'medications', id: 'med-lev' });
    expect(s.data.medications.find((m) => m.id === 'med-lev')).toBeUndefined();
    expect(s.data.medicationEvents.some((e) => e.medicationId === 'med-lev')).toBe(false);
    s = reducer(s, { type: 'resetSynthetic' });
    expect(s.data.medications.find((m) => m.id === 'med-lev')).toBeDefined();
  });
});

describe('validation', () => {
  it('rejects future dates, bad times and out-of-range values', () => {
    expect(validateSeizure(sz('2027-01-01'), TODAY).date).toBeDefined();
    expect(validateSeizure(sz('2026-10-01', { time: '25:00' }), TODAY).time).toBeDefined();
    expect(validateSeizure(sz('2026-10-01', { durationSeconds: 0 }), TODAY).durationSeconds).toBeDefined();
    expect(validateObservation(obs('2026-10-01', { sleepHours: 25 }), [], TODAY).sleepHours).toBeDefined();
    expect(validateObservation(obs('2026-10-01', { stressLevel: 11 }), [], TODAY).stressLevel).toBeDefined();
    expect(validateObservation(obs('2026-10-01', { sleepQuality: 2.5 }), [], TODAY).sleepQuality).toBeDefined();
  });
  it('allows "not recorded" values', () => {
    expect(validateObservation(obs('2026-10-01', { sleepHours: null, stressLevel: null, sleepQuality: null }), [], TODAY)).toEqual({});
  });
  it('blocks duplicate check-in dates and inconsistent ranges', () => {
    const existing = [obs('2026-10-01')];
    expect(validateObservation({ ...obs('2026-10-01'), id: 'other' }, existing, TODAY).date).toMatch(/already exists/);
    expect(validateObservation(existing[0], existing, TODAY)).toEqual({});
    const m = { id: 'm', periodStart: '2026-10-05', periodEnd: '2026-10-01', startCertainty: 'exact' as const, notes: '', isSynthetic: false };
    expect(validateMenstrual(m, [], TODAY).periodEnd).toBeDefined();
    expect(validateMedication({ id: 'x', name: '', indication: '', kind: 'prescription', startDate: '2026-01-01', endDate: '2025-01-01', initialDose: '', frequency: '', source: 'patient-reported', notes: '', isSynthetic: false }, TODAY)).toMatchObject({
      name: expect.any(String),
      initialDose: expect.any(String),
      endDate: expect.any(String),
    });
    expect(validateTask({ id: 't', title: '', reason: '', kind: 'other', insightId: null, dueDate: null, appointmentDate: null, status: 'open', createdOn: TODAY, isSynthetic: false })).toMatchObject({ title: expect.any(String), reason: expect.any(String) });
  });
});
