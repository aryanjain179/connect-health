/** Tests for Ask My Health Data and the Voice Journal extraction / approval flow. */
import { describe, expect, it } from 'vitest';
import { answerQuestion, matchIntent, SUGGESTED_QUESTIONS, type AssistantContext } from './assistant/answer';
import { computeBundle } from './store/HealthDataContext';
import { initialState, reducer } from './store/reducer';
import { findUnsafeLanguage } from './clinical/safety';
import { clauses, extractProposals, parseNumber } from './journal/extract';
import { applyProposals, undoJournal } from './journal/apply';
import { emptyData, obs } from './test/fixtures';
import type { Medication } from './models/types';

function ctxFor(state = initialState()): AssistantContext {
  const b = computeBundle(state);
  return { data: state.data, window: b.window, findingsByOutcome: b.findingsByOutcome, flags: b.flags, insufficient: b.insufficient, connections: b.connections, completeness: b.completeness, seizures: b.seizures, sleepThreshold: state.settings.sleepThresholdHours };
}

describe('Ask My Health Data (rule-based prototype)', () => {
  const ctx = ctxFor();
  it('maps every suggested question to a supported intent', () => {
    expect(SUGGESTED_QUESTIONS.map(matchIntent)).toEqual(['patterns', 'medication', 'appointment', 'sleep', 'discuss', 'tasks']);
  });
  it('answers from actual records with sources', () => {
    const a = answerQuestion('Can you summarize the relationship between my sleep and recorded events?', ctx);
    expect(a.text).toContain('80 nights');
    expect(a.bullets.join(' ')).toContain('9 of 24 days');
    expect(a.sources.length).toBeGreaterThan(0);
    const m = answerQuestion('Have my symptoms changed since my medication was adjusted?', ctx);
    expect(m.bullets.join(' ')).toMatch(/26 observed days before/);
    expect(m.text).toMatch(/timing associations only/);
    const t = answerQuestion('What follow-up tasks have I not completed?', ctx);
    expect(t.bullets).toHaveLength(2);
  });
  it('says when the data cannot answer, and does not fabricate', () => {
    const a = answerQuestion('What is the weather tomorrow?', ctx);
    expect(a.kind).toBe('unsupported');
    expect(a.text).toMatch(/can’t answer that from your stored data/);
    const empty = answerQuestion('Have my symptoms changed since my medication was adjusted?', ctxFor({ ...initialState(), data: emptyData() }));
    expect(empty.text).toMatch(/No medication starts, stops or dose changes/);
  });
  it('declines diagnosis/prescribing and gives emergency guidance', () => {
    expect(answerQuestion('Do I have ADHD?', ctx).kind).toBe('safety');
    expect(answerQuestion('Should I stop taking levetiracetam?', ctx).kind).toBe('safety');
    expect(answerQuestion('Could this be cancer?', ctx).kind).toBe('safety');
    const e = answerQuestion('My seizure won’t stop', ctx);
    expect(e.kind).toBe('emergency');
    expect(e.text).toContain('911');
  });
  it('produces no unsafe language for any suggested question', () => {
    for (const q of SUGGESTED_QUESTIONS) {
      const a = answerQuestion(q, ctx);
      for (const t of [a.text, ...a.bullets, ...a.questions]) expect(findUnsafeLanguage(t), t).toEqual([]);
    }
  });
});

const med = (id: string, name: string): Medication => ({ id, name, indication: '', kind: 'prescription', startDate: '2025-01-01', endDate: null, initialDose: '10 mg', frequency: 'daily', source: 'patient-reported', notes: '', isSynthetic: false });
const TODAY = '2026-10-24';

describe('voice journal extraction', () => {
  it('extracts the illustrative example without inventing severity', () => {
    const ps = extractProposals('I slept about five hours last night, felt unusually anxious this morning, and had a headache after lunch.', { today: TODAY, medications: [] });
    expect(ps.map((p) => p.kind)).toEqual(['sleepHours', 'stress', 'headache']);
    expect(ps[0]).toMatchObject({ value: 5, date: TODAY, note: 'You said this was approximate.' });
    expect(ps[1].value).toBeNull(); // no rating invented
    expect(ps[1].clarification).toMatch(/will not be guessed/);
    expect(ps[2]).toMatchObject({ value: true, note: 'after lunch' });
  });
  it('handles numbers, negation and explicit ratings', () => {
    expect(parseNumber('seven')).toBe(7);
    const ps = extractProposals('Slept 6 and a half hours. No headache today. Stress was 8 out of 10. I didn’t have a seizure.', { today: TODAY, medications: [] });
    expect(ps.find((p) => p.kind === 'sleepHours')!.value).toBe(6.5);
    expect(ps.find((p) => p.kind === 'headache')!.value).toBe(false);
    expect(ps.find((p) => p.kind === 'stress')!.value).toBe(8);
    expect(ps.some((p) => p.kind === 'seizure')).toBe(false);
  });
  it('proposes a seizure with only the stated details and asks about the rest', () => {
    const [p] = extractProposals('Yesterday I had a seizure at 3pm that lasted about two minutes', { today: TODAY, medications: [] });
    expect(p).toMatchObject({ kind: 'seizure', date: '2026-10-23', seizureTime: '15:00', seizureDurationSeconds: 120 });
    expect(p.clarification).toMatch(/Type/);
  });
  it('matches named medications and asks when ambiguous', () => {
    const meds = [med('m1', 'Sertraline'), med('m2', 'Metformin')];
    const a = extractProposals('I forgot to take my metformin this morning', { today: TODAY, medications: meds });
    expect(a[0]).toMatchObject({ kind: 'missedDose', medicationId: 'm2', clarification: null });
    const b = extractProposals('I missed my evening dose', { today: TODAY, medications: meds });
    expect(b[0]).toMatchObject({ medicationId: null });
    expect(b[0].clarification).toMatch(/Which medication/);
  });
  it('splits into short clauses for evidence quotes', () => {
    expect(clauses('Slept badly, and then I had a headache. Felt dizzy')).toEqual(['Slept badly', 'I had a headache', 'Felt dizzy']);
  });
});

describe('voice journal approval and undo', () => {
  let n = 0;
  const opts = { transcript: 't', saveTranscript: false, source: 'typed' as const, now: '2026-10-24T09:00:00Z', today: TODAY, newId: (p: string) => `${p}-${++n}`, rejectedCount: 1 };

  it('writes only approved proposals, merges into an existing check-in and can be undone', () => {
    let state = { ...initialState(), data: emptyData({ observations: [obs(TODAY, { sleepHours: null, headache: null })] }) };
    const ps = extractProposals('I slept 5 hours and had a headache after lunch', { today: TODAY, medications: [] });
    const approved = ps.filter((p) => p.kind === 'sleepHours'); // headache rejected
    const { actions, entry } = applyProposals(approved, state.data, opts);
    state = reducer(state, { type: 'batch', actions });
    const o = state.data.observations[0];
    expect(o.sleepHours).toBe(5);
    expect(o.headache).toBeNull(); // rejected proposal not written
    expect(state.data.journal).toHaveLength(1);
    expect(entry.transcript).toBeNull(); // not saved unless chosen
    state = reducer(state, { type: 'batch', actions: undoJournal(entry, state.data, true) });
    expect(state.data.observations[0].sleepHours).toBeNull();
    expect(state.data.journal).toHaveLength(0);
  });

  it('creates new records (and removes them on undo) and recalculates analyses', () => {
    let state = { ...initialState(), data: emptyData({ medications: [med('m1', 'Lamotrigine')], profile: { ...emptyData().profile, trackers: { seizures: true, menstrual: false } } }) };
    const ps = extractProposals('Had a seizure this morning. I missed my lamotrigine dose.', { today: TODAY, medications: state.data.medications });
    const { actions, entry } = applyProposals(ps, state.data, { ...opts, saveTranscript: true, transcript: 'x' });
    state = reducer(state, { type: 'batch', actions });
    expect(state.data.seizures).toHaveLength(1);
    expect(state.data.seizures[0].type).toBe('unknown');
    expect(state.data.medicationEvents[0]).toMatchObject({ kind: 'missed-dose', medicationId: 'm1' });
    expect(computeBundle(state).seizures.totalEvents).toBe(1);
    expect(entry.transcript).toBe('x');
    state = reducer(state, { type: 'batch', actions: undoJournal(entry, state.data, true) });
    expect(state.data.seizures).toHaveLength(0);
    expect(state.data.medicationEvents).toHaveLength(0);
  });
});
