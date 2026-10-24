import { describe, expect, it } from 'vitest';
import { initialRoot, initialState, normalizeData, reducer, rootReducer } from './reducer';
import { exportJson, LEGACY_STORAGE_KEY, loadRoot, parseImport, saveRoot, STORAGE_KEY } from './storage';
import { validateMedication, validateMenstrual, validateObservation, validateSeizure, validateTask } from './validation';
import { obs, sz } from '../test/fixtures';
import { createUserState, emptyDraft } from '../onboarding/profileDraft';

const TODAY = '2026-10-24';

function userState() {
  const d = emptyDraft();
  d.about = { ...d.about, fullName: 'Test User', age: '40', sex: 'unspecified' };
  d.conditions = [{ id: 'migraine', label: 'Migraine', status: 'diagnosed' }];
  return createUserState(d, TODAY);
}

describe('persistence (v2 root with separate profiles)', () => {
  it('round-trips both profiles through localStorage (survives a refresh)', () => {
    let root = rootReducer(initialRoot(), { type: 'enterDemo' });
    root = rootReducer(root, { type: 'profile', action: { type: 'upsert', collection: 'seizures', record: sz('2026-10-21', { id: 'new-1' }) } });
    root = rootReducer(root, { type: 'createUserProfile', state: userState() });
    root = rootReducer(root, { type: 'profile', action: { type: 'setSettings', settings: { sleepThresholdHours: 7 } } });
    saveRoot(root);
    const loaded = loadRoot();
    expect(loaded.source).toBe('stored');
    expect(loaded.root).toEqual(root);
    expect(loaded.root.profiles.demo.data.seizures).toHaveLength(16);
    expect(loaded.root.profiles.user!.data.seizures).toHaveLength(0);
    expect(loaded.root.profiles.user!.settings.sleepThresholdHours).toBe(7);
    expect(loaded.root.profiles.demo.settings.sleepThresholdHours).toBe(6);
  });

  it('migrates v1 data into the demo profile', () => {
    const v1 = initialState();
    v1.data.seizures = v1.data.seizures.slice(0, 3);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ version: 1, state: v1 }));
    const r = loadRoot();
    expect(r.source).toBe('migrated');
    expect(r.root.active).toBeNull();
    expect(r.root.profiles.demo.data.seizures).toHaveLength(3);
    expect(r.root.profiles.demo.data.journal).toEqual([]);
    expect(r.root.profiles.user).toBeNull();
  });

  it('seeds when nothing is stored and recovers from corrupt data', () => {
    expect(loadRoot().source).toBe('seed');
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadRoot().source).toBe('invalid');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, root: { profiles: { demo: { data: { profile: {} } } } } }));
    const r = loadRoot();
    expect(r.source).toBe('invalid');
    expect(r.root.profiles.demo.data.seizures).toHaveLength(15);
  });

  it('exports and re-imports data (including legacy format); rejects invalid files', () => {
    const data = initialState().data;
    expect(parseImport(exportJson(data))).toEqual(data);
    expect(parseImport(JSON.stringify({ format: 'healthconnect-export', data }))).toEqual(data);
    expect(() => parseImport('{"format":"connecthealth-export","data":{"seizures":[]}}')).toThrow();
  });

  it('normalizes older records with defaults for new fields', () => {
    const d = initialState().data as unknown as Record<string, unknown>;
    delete d.journal;
    delete d.navigator;
    const n = normalizeData(d as never);
    expect(n.journal).toEqual([]);
    expect(n.navigator.contacts).toEqual([]);
    expect(n.tasks[0].links).toEqual([]);
  });
});

describe('root reducer', () => {
  it('keeps the demo patient separate from the user profile', () => {
    let root = rootReducer(initialRoot(), { type: 'createUserProfile', state: userState() });
    expect(root.active).toBe('user');
    root = rootReducer(root, { type: 'profile', action: { type: 'upsert', collection: 'observations', record: obs('2026-10-20') } });
    expect(root.profiles.user!.data.observations).toHaveLength(1);
    expect(root.profiles.demo.data.observations).toHaveLength(83);
    root = rootReducer(root, { type: 'switchProfile', slot: 'demo' });
    expect(root.active).toBe('demo');
    root = rootReducer(root, { type: 'deleteUserProfile' });
    expect(root.profiles.user).toBeNull();
    expect(rootReducer(root, { type: 'switchProfile', slot: 'user' }).active).toBe('demo');
    expect(rootReducer(root, { type: 'signOut' }).active).toBeNull();
  });

  it('profile actions are ignored when no profile is active', () => {
    const root = initialRoot();
    expect(rootReducer(root, { type: 'profile', action: { type: 'resetSynthetic' } })).toBe(root);
  });
});

describe('profile reducer', () => {
  it('upserts, deletes and cascades medication deletion to its events', () => {
    let s = initialState();
    expect(s.data.medicationEvents.some((e) => e.medicationId === 'med-lev')).toBe(true);
    s = reducer(s, { type: 'delete', collection: 'medications', id: 'med-lev' });
    expect(s.data.medications.find((m) => m.id === 'med-lev')).toBeUndefined();
    expect(s.data.medicationEvents.some((e) => e.medicationId === 'med-lev')).toBe(false);
    s = reducer(s, { type: 'resetSynthetic' });
    expect(s.data.medications.find((m) => m.id === 'med-lev')).toBeDefined();
  });
  it('toggles review-flag exclusion and batches actions', () => {
    let s = reducer(initialState(), { type: 'toggleReviewExcluded', id: 'flag:x' });
    expect(s.data.reviewExcluded).toEqual(['flag:x']);
    s = reducer(s, { type: 'batch', actions: [{ type: 'toggleReviewExcluded', id: 'flag:x' }, { type: 'patchObservation', id: 'obs-2026-07-23', patch: { sleepHours: 3 } }] });
    expect(s.data.reviewExcluded).toEqual([]);
    expect(s.data.observations.find((o) => o.id === 'obs-2026-07-23')!.sleepHours).toBe(3);
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
