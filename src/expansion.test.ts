/** Tests for the ConnectHealth expansion modules: onboarding, outcomes, review flags, PDF, navigator, sharing. */
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { addCustomCondition, createUserState, emptyDraft, setConditionStatus, setNoKnownConditions, suggestedTrackers, toggleCondition, validateAbout } from './onboarding/profileDraft';
import { searchConditions, selectionsToHistory } from './conditions/catalog';
import { createSyntheticDataset, SYNTHETIC_END, SYNTHETIC_START } from './data/syntheticDataset';
import { allOutcomeFindings, runAllOutcomes, runPatternAnalysis } from './analysis';
import { outcomeAvailability } from './analysis/outcomes';
import { buildReviewFlags, PATIENT_FLAG_MESSAGE } from './review/flags';
import { buildClinicianSummary } from './summary/clinicianSummary';
import { evaluateConnections } from './clinical/connections';
import { findUnsafeLanguage } from './clinical/safety';
import { DEFAULT_SETTINGS } from './models/types';
import { pdfSafe, renderReport } from './report/pdf';
import { buildDailySeries } from './analysis/series';
import { fillTemplate, referralNote, suggestSpecialties, TEMPLATES } from './navigator/navigator';
import { allPermissions, filterDataForPermissions, hasAccess, noPermissions } from './sharing/permissions';
import { computeBundle } from './store/HealthDataContext';
import { initialState } from './store/reducer';
import { emptyData, obs, sz } from './test/fixtures';
import { eachDay } from './analysis/dates';

const TODAY = '2026-10-24';
const W = { start: SYNTHETIC_START, end: SYNTHETIC_END };

describe('onboarding', () => {
  it('validates required fields with readable errors', () => {
    const d = emptyDraft();
    expect(Object.keys(validateAbout(d.about, TODAY)).sort()).toEqual(['age', 'fullName', 'sex']);
    expect(validateAbout({ ...d.about, fullName: 'A', age: '200', sex: 'female' }, TODAY).age).toMatch(/between 0 and 120/);
    expect(validateAbout({ ...d.about, fullName: 'A', ageMode: 'dob', dateOfBirth: '2030-01-01', sex: 'male' }, TODAY).dateOfBirth).toMatch(/future/);
    expect(validateAbout({ ...d.about, fullName: 'A', age: '30', sex: 'unspecified' }, TODAY)).toEqual({});
  });

  it('"No known diagnosed conditions" is mutually exclusive with diagnosed selections but allows symptoms', () => {
    let d = toggleCondition(emptyDraft(), 'asthma', 'Asthma');
    d = toggleCondition(d, 'adhd', 'ADHD');
    d = setConditionStatus(d, 'adhd', 'symptom');
    d = setNoKnownConditions(d, true);
    expect(d.conditions.map((c) => [c.id, c.status])).toEqual([['adhd', 'symptom']]);
    d = toggleCondition(d, 'migraine', 'Migraine');
    expect(d.conditions.find((c) => c.id === 'migraine')!.status).toBe('symptom');
    d = setConditionStatus(d, 'migraine', 'diagnosed');
    expect(d.noKnownConditions).toBe(false);
  });

  it('symptoms never become diagnoses and never carry the diagnosis tag', () => {
    const h = selectionsToHistory([{ id: 'epilepsy', label: 'Epilepsy', status: 'symptom' }, { id: 'adhd', label: 'ADHD', status: 'suspected' }], TODAY, (s) => s.id);
    expect(h[0]).toMatchObject({ kind: 'symptom', status: 'patient-reported' });
    expect(h[0].tags).not.toContain('epilepsy');
    expect(h[1]).toMatchObject({ kind: 'diagnosis', status: 'suspected' });
  });

  it('creates a separate, empty, personalised user profile', () => {
    let d = emptyDraft();
    d.about = { ...d.about, fullName: 'Sam Rivera', preferredName: 'Sam', age: '34', sex: 'intersex', genderIdentity: 'non-binary', pronouns: 'they/them' };
    d = addCustomCondition(toggleCondition(d, 'migraine', 'Migraine'), 'Ehlers-Danlos syndrome');
    d.goals = ['find-specialists'];
    const s = createUserState(d, TODAY);
    expect(s.data.profile).toMatchObject({ displayName: 'Sam Rivera', preferredName: 'Sam', sex: 'intersex', genderIdentity: 'non-binary', isSynthetic: false, trackers: { seizures: false, menstrual: false } });
    expect(s.data.history.map((x) => x.label)).toEqual(['Migraine', 'Ehlers-Danlos syndrome']);
    expect(s.data.seizures).toEqual([]);
    expect(s.settings.outcome).toBe('headache');
    expect(suggestedTrackers(toggleCondition(emptyDraft(), 'epilepsy', 'Epilepsy')).seizures).toBe(true);
    expect(searchConditions('apnea').map((c) => c.id)).toContain('sleep-apnea');
  });
});

describe('multi-outcome analysis', () => {
  it('symptom outcomes use only days where the symptom was answered', () => {
    const days = eachDay('2026-01-01', '2026-01-30');
    const data = emptyData({ observations: days.map((d, i) => obs(d, { sleepHours: i < 12 ? 5 : 7.5, headache: i % 5 === 0 ? null : i < 12 ? i % 2 === 0 : i % 6 === 0 })) });
    const f = runPatternAnalysis(data, { start: days[0], end: days[29] }, DEFAULT_SETTINGS, 'headache').find((x) => x.factor === 'sleep')!;
    expect(f.id).toBe('pattern-sleep~headache');
    // 6 unanswered days are excluded, not counted as "no headache".
    expect(f.groups[0].eligibleDays + f.groups[1].eligibleDays).toBe(24);
    expect(f.title).not.toMatch(/seizure/i);
    expect(f.evidenceIds).toEqual([]);
  });

  it('only outcomes with data are available; seizures are not assumed', () => {
    const empty = emptyData();
    expect(outcomeAvailability(empty).every((o) => !o.available)).toBe(true);
    expect(Object.keys(runAllOutcomes(createSyntheticDataset(), W, DEFAULT_SETTINGS)).sort()).toEqual(['attentionDifficulty', 'dizziness', 'headache', 'seizures']);
    const bundle = computeBundle({ data: emptyData(), settings: DEFAULT_SETTINGS, period: '30' });
    expect(bundle.findings).toEqual([]);
    expect(bundle.flags).toEqual([]);
  });
});

describe('clinician review flags', () => {
  const data = createSyntheticDataset();
  const byOutcome = runAllOutcomes(data, W, DEFAULT_SETTINGS);
  const { flags, insufficient } = buildReviewFlags(data, byOutcome, W);

  it('flags the synthetic sleep, menstrual and new-type findings amber, with no red flag', () => {
    const seizureFlags = flags.filter((f) => f.outcome === 'seizures').map((f) => f.findingId);
    expect(seizureFlags).toEqual(expect.arrayContaining(['pattern-sleep', 'pattern-menstrual', 'pattern-trend-type']));
    expect(flags.every((f) => f.level === 'amber')).toBe(true);
    expect(flags.map((f) => f.findingId)).toEqual(['pattern-sleep', 'pattern-menstrual', 'pattern-trend-type', 'pattern-sleep~attentionDifficulty']);
    expect(insufficient).toHaveLength(7);
    const sleep = flags.find((f) => f.findingId === 'pattern-sleep')!;
    expect(sleep.involvedDates).toHaveLength(9);
    expect(sleep.rule.basis).toBe('prototype-analytic-rule');
    expect(sleep.patientMessage).toBe(PATIENT_FLAG_MESSAGE);
  });

  it('never flags insufficient data – it is listed instead', () => {
    expect(insufficient.some((i) => i.findingId.startsWith('pattern-medication-med-mel'))).toBe(true);
    expect(flags.some((f) => f.findingId?.startsWith('pattern-medication-med-mel'))).toBe(false);
  });

  it('red is reserved for the documented ≥ 5-minute seizure rule', () => {
    const d2 = { ...data, seizures: [...data.seizures, sz('2026-10-19', { durationSeconds: 330, id: 'long-1' })] };
    const r = buildReviewFlags(d2, runAllOutcomes(d2, W, DEFAULT_SETTINGS), W);
    const red = r.flags.filter((f) => f.level === 'red');
    expect(red).toHaveLength(1);
    expect(red[0].rule.basis).toBe('clinically-reviewed-guidance');
    expect(red[0].rule.evidenceIds).toEqual(['cdc-seizure-first-aid', 'trinka-2015-status-epilepticus']);
    expect(r.flags[0].level).toBe('red');
  });

  it('flag text never names or predicts a disease', () => {
    for (const f of flags) for (const t of [f.title, f.observation, f.patientMessage, ...f.questions, f.rule.description]) expect(findUnsafeLanguage(t), t).toEqual([]);
  });

  it('the clinician report respects "leave out of report"', () => {
    const findings = byOutcome.seizures!;
    const conns = evaluateConnections(data, allOutcomeFindings(byOutcome), W);
    const all = buildClinicianSummary(data, findings, conns, W, DEFAULT_SETTINGS, { flags, insufficient });
    const without = buildClinicianSummary({ ...data, reviewExcluded: [flags[0].id] }, findings, conns, W, DEFAULT_SETTINGS, { flags, insufficient });
    const count = (r: typeof all) => r.sections.find((s) => s.id === 'review')!.items.filter((i) => i.label === 'Review flag').length;
    expect(count(all)).toBe(flags.length);
    expect(count(without)).toBe(flags.length - 1);
  });
});

describe('PDF report', () => {
  it('renders a text-based, multi-page PDF from current data', () => {
    const data = createSyntheticDataset();
    const byOutcome = runAllOutcomes(data, W, DEFAULT_SETTINGS);
    const { flags, insufficient } = buildReviewFlags(data, byOutcome, W);
    const report = buildClinicianSummary(data, byOutcome.seizures!, evaluateConnections(data, allOutcomeFindings(byOutcome), W), W, DEFAULT_SETTINGS, { flags, insufficient, generatedAt: '2026-10-24T10:00:00.000Z' });
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
    renderReport(doc, report, { title: 'Sleep and seizures', points: buildDailySeries(data, W), threshold: 6, flags, eventLabel: 'Seizure' });
    const out = doc.output();
    expect(out.startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    for (const s of ['ConnectHealth clinician report', 'Patient: Maya R.', 'FINDINGS MARKED FOR CLINICIAN REVIEW', 'not a diagnosis', 'Jul 23, 2026']) expect(out).toContain(s);
  });
  it('maps characters outside the PDF base font', () => {
    expect(pdfSafe('≥ 5 min – ok · “quoted” → x')).toBe('>= 5 min - ok | "quoted" -> x');
  });
});

describe('care navigator', () => {
  it('suggests specialties from flags, connections and conditions without claiming necessity', () => {
    const data = createSyntheticDataset();
    const byOutcome = runAllOutcomes(data, W, DEFAULT_SETTINGS);
    const { flags } = buildReviewFlags(data, byOutcome, W);
    const s = suggestSpecialties(data, flags, evaluateConnections(data, allOutcomeFindings(byOutcome), W));
    const ids = s.map((x) => x.specialty);
    expect(ids).toEqual(expect.arrayContaining(['neurology', 'sleep-medicine', 'psychiatry', 'primary-care']));
    expect(s.find((x) => x.specialty === 'neurology')!.inCareTeam).toBe('Fictional neurology clinic');
    for (const x of s) for (const t of [x.why, x.uncertainty, x.question, x.referralNote]) {
      expect(t).not.toMatch(/medically necessary|you need to see|is covered|will be covered/i);
      expect(findUnsafeLanguage(t)).toEqual([]);
    }
  });
  it('a profile with no recorded information only gets primary care (generic)', () => {
    const s = suggestSpecialties(emptyData(), [], []);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ specialty: 'primary-care', sources: [] });
  });
  it('referral notes depend on the recorded plan type and always defer to the insurer', () => {
    const nav = createSyntheticDataset().navigator;
    expect(referralNote(nav, 'neurology')).toMatch(/depends on your plan/);
    expect(referralNote({ ...nav, insurance: { ...nav.insurance, planType: 'HMO' } }, 'neurology')).toMatch(/confirm with your insurer/);
  });
  it('fills placeholders and leaves unknown ones visible', () => {
    const t = fillTemplate(TEMPLATES[0].body, { specialty: 'Sleep medicine', 'your name': '' });
    expect(t).toContain('Sleep medicine provider');
    expect(t).toContain('[your name]');
    expect(t).toContain('[member ID]');
  });
});

describe('sharing permissions', () => {
  const data = createSyntheticDataset();
  it('sharing is off by default and requires confirmation', () => {
    const p = { id: 'x', name: 'A', relationship: '', contact: '', role: 'caregiver' as const, status: 'pending' as const, permissions: noPermissions(), createdOn: TODAY, confirmedOn: null, revokedOn: null };
    expect(hasAccess(p)).toBe(false);
    expect(hasAccess({ ...p, status: 'active', permissions: { ...noPermissions(), sleep: true } })).toBe(true);
    expect(hasAccess({ ...p, status: 'revoked', permissions: allPermissions() })).toBe(false);
  });
  it('removes restricted data entirely, including from derived insights', () => {
    const f = filterDataForPermissions(data, { ...noPermissions(), sleep: true, insights: true });
    expect(f.seizures).toEqual([]);
    expect(f.medications).toEqual([]);
    expect(f.menstrual).toEqual([]);
    expect(f.history).toEqual([]);
    expect(f.journal).toEqual([]);
    expect(f.profile.displayName).toBe('Name not shared');
    expect(f.observations.every((o) => o.headache === null && o.stressLevel === null && o.otherSymptoms.length === 0)).toBe(true);
    expect(f.observations.some((o) => o.sleepHours !== null)).toBe(true);
    const b = computeBundle({ ...initialState(), data: f });
    expect(b.findings).toEqual([]); // no outcome is shared, so nothing about seizures can be inferred
    expect(b.flags).toEqual([]);
    expect(JSON.stringify(f)).not.toContain('Levetiracetam');
  });
  it('select-all shares everything except journal transcripts and sharing settings', () => {
    const f = filterDataForPermissions({ ...data, sharing: [{} as never] }, allPermissions());
    expect(f.seizures).toHaveLength(15);
    expect(f.sharing).toEqual([]);
    expect(f.journal).toEqual([]);
  });
});

import { activeConditionIds, checkinPlan, planForConditions, seizureModuleOn, validateMeasures } from './conditions/checkin';

describe('condition-driven daily check-in', () => {
  const profileWith = (selections: Array<{ id: string; label: string; status: 'diagnosed' | 'suspected' | 'symptom' }>) =>
    emptyData({ history: selectionsToHistory(selections, TODAY, (s) => `h-${s.id}`) });

  it('includes the seizure log only when epilepsy is selected (any status)', () => {
    expect(seizureModuleOn(profileWith([{ id: 'migraine', label: 'Migraine', status: 'diagnosed' }]))).toBe(false);
    expect(seizureModuleOn(profileWith([{ id: 'epilepsy', label: 'Epilepsy', status: 'suspected' }]))).toBe(true);
    expect(seizureModuleOn(profileWith([{ id: 'epilepsy', label: 'Epilepsy', status: 'symptom' }]))).toBe(true);
    // Existing seizure records keep the log visible so data are never hidden.
    expect(seizureModuleOn(emptyData({ seizures: [sz('2026-10-01')] }))).toBe(true);
    expect(createUserState({ ...emptyDraft(), conditions: [{ id: 'epilepsy', label: 'Epilepsy', status: 'diagnosed' }] }, TODAY).data.profile.trackers?.seizures).toBe(true);
  });

  it('a symptom selection drives questions but never the diagnosis-based rules', () => {
    const d = profileWith([{ id: 'epilepsy', label: 'Epilepsy', status: 'symptom' }]);
    expect(activeConditionIds(d).has('epilepsy')).toBe(true);
    expect(evaluateConnections(d, [], W).find((c) => c.id === 'conn-adhd')!.rationale).toMatch(/No confirmed epilepsy diagnosis/);
  });

  it('chooses questions from the selected conditions', () => {
    expect(planForConditions(['fibromyalgia']).map((p) => p.label)).toEqual(['Pain level (0–10)', 'Fatigue']);
    expect(planForConditions(['hypertension']).map((p) => p.label)).toEqual(['Dizziness', 'Blood pressure – systolic (mmHg, if measured)', 'Blood pressure – diastolic (mmHg, if measured)']);
    expect(planForConditions([])).toEqual([]);
    const plan = checkinPlan(createSyntheticDataset());
    expect(plan.seizures?.reasons).toEqual(['Epilepsy']);
    expect(plan.builtin.map((b) => [b.key, b.reasons[0]])).toEqual([
      ['headache', 'Migraine'],
      ['dizziness', 'Migraine'],
      ['attentionDifficulty', 'Epilepsy'],
    ]);
    expect(plan.menstrual).not.toBeNull();
    expect(checkinPlan(emptyData())).toMatchObject({ seizures: null, menstrual: null, builtin: [], measures: [] });
  });

  it('validates measure ranges', () => {
    expect(validateMeasures({ 'pain-level': 11 })['measure:pain-level']).toMatch(/between 0 and 10/);
    expect(validateMeasures({ 'pain-level': 4, fatigue: true, glucose: null })).toEqual({});
  });

  it('yes/no measures can be analysed as outcomes, excluding unanswered days', () => {
    const days = eachDay('2026-01-01', '2026-01-30');
    const data = emptyData({ observations: days.map((d, i) => obs(d, { sleepHours: i < 12 ? 5 : 7.5, measures: i % 6 === 0 ? {} : { 'gi-symptoms': i < 12 ? i % 2 === 0 : i % 7 === 0 } })) });
    expect(outcomeAvailability(data).find((o) => o.key === 'measure:gi-symptoms')!.available).toBe(true);
    const f = runPatternAnalysis(data, { start: days[0], end: days[29] }, DEFAULT_SETTINGS, 'measure:gi-symptoms').find((x) => x.factor === 'sleep')!;
    expect(f.id).toBe('pattern-sleep~measure:gi-symptoms');
    expect(f.groups[0].eligibleDays + f.groups[1].eligibleDays).toBe(25);
    expect(f.explanation).toMatch(/digestive/i);
    expect(f.explanation).not.toMatch(/seizure/i);
  });

  it('measures are shared only with the symptoms permission', () => {
    const d = emptyData({ observations: [obs('2026-01-01', { measures: { 'pain-level': 7 } })] });
    expect(filterDataForPermissions(d, { ...noPermissions(), sleep: true }).observations[0].measures).toBeUndefined();
    expect(filterDataForPermissions(d, { ...noPermissions(), symptoms: true }).observations[0].measures).toEqual({ 'pain-level': 7 });
  });
});

import { reconcileBleeding } from './conditions/menstrualBleeding';
import { extractProposals } from './journal/extract';
import { applyProposals, undoJournal } from './journal/apply';
import { reducer as profileReducer } from './store/reducer';
import type { MenstrualRecord } from './models/types';

describe('daily menstrual bleeding → period records', () => {
  const rec = (id: string, start: string, end: string): MenstrualRecord => ({ id, periodStart: start, periodEnd: end, startCertainty: 'exact', notes: '', isSynthetic: false });
  let n = 0;
  const id = () => `c${++n}`;
  const apply = (records: MenstrualRecord[], date: string, bleeding: boolean | null) => {
    const state = profileReducer({ ...initialState(), data: emptyData({ menstrual: records }) }, { type: 'batch', actions: reconcileBleeding(records, date, bleeding, id).actions });
    return state.data.menstrual.map((r) => [r.periodStart, r.periodEnd]);
  };

  it('yes starts a new period, then consecutive (or near) yes days extend it', () => {
    expect(apply([], '2026-11-01', true)).toEqual([['2026-11-01', '2026-11-01']]);
    expect(apply([rec('a', '2026-11-01', '2026-11-01')], '2026-11-02', true)).toEqual([['2026-11-01', '2026-11-02']]);
    expect(apply([rec('a', '2026-11-01', '2026-11-02')], '2026-11-04', true)).toEqual([['2026-11-01', '2026-11-04']]); // 1 unanswered day in between
    expect(apply([rec('a', '2026-11-03', '2026-11-05')], '2026-11-01', true)).toEqual([['2026-11-01', '2026-11-05']]);
    expect(apply([rec('a', '2026-11-01', '2026-11-02')], '2026-11-10', true)).toEqual([['2026-11-01', '2026-11-02'], ['2026-11-10', '2026-11-10']]);
  });

  it('no trims the edge of a period or removes a one-day period, but never splits a period', () => {
    expect(apply([rec('a', '2026-11-01', '2026-11-01')], '2026-11-01', false)).toEqual([]);
    expect(apply([rec('a', '2026-11-01', '2026-11-05')], '2026-11-05', false)).toEqual([['2026-11-01', '2026-11-04']]);
    expect(apply([rec('a', '2026-11-01', '2026-11-05')], '2026-11-01', false)).toEqual([['2026-11-02', '2026-11-05']]);
    expect(apply([rec('a', '2026-11-01', '2026-11-05')], '2026-11-03', false)).toEqual([['2026-11-01', '2026-11-05']]);
  });

  it('"not recorded" and a yes inside an existing period change nothing', () => {
    expect(reconcileBleeding([rec('a', '2026-11-01', '2026-11-05')], '2026-11-03', null, id).actions).toEqual([]);
    expect(reconcileBleeding([rec('a', '2026-11-01', '2026-11-05')], '2026-11-03', true, id).actions).toEqual([]);
  });

  it('voice journal proposes bleeding yes/no and can be undone, restoring period records', () => {
    const ps = extractProposals("I'm on my period today and slept 7 hours", { today: TODAY, medications: [] });
    expect(ps.find((p) => p.kind === 'menstrualBleeding')).toMatchObject({ value: true });
    expect(extractProposals('No bleeding today', { today: TODAY, medications: [] })[0]).toMatchObject({ kind: 'menstrualBleeding', value: false });
    let state = { ...initialState(), data: emptyData({ menstrual: [rec('a', '2026-10-22', '2026-10-23')] }) };
    const { actions, entry } = applyProposals(ps, state.data, { transcript: '', saveTranscript: false, source: 'typed', now: '2026-10-24T08:00:00Z', today: TODAY, newId: (p) => `${p}-x`, rejectedCount: 0 });
    state = profileReducer(state, { type: 'batch', actions });
    expect(state.data.menstrual.map((r) => [r.periodStart, r.periodEnd])).toEqual([['2026-10-22', TODAY]]);
    expect(state.data.observations[0].measures).toEqual({ 'menstrual-bleeding': true });
    state = profileReducer(state, { type: 'batch', actions: undoJournal(entry, state.data, true) });
    expect(state.data.menstrual.map((r) => [r.periodStart, r.periodEnd])).toEqual([['2026-10-22', '2026-10-23']]);
    expect(state.data.observations).toHaveLength(0);
  });

  it('bleeding answers are shared only with the menstrual-cycle permission', () => {
    const d = emptyData({ observations: [obs('2026-01-01', { measures: { 'menstrual-bleeding': true, 'pain-level': 4 } })] });
    expect(filterDataForPermissions(d, { ...noPermissions(), symptoms: true }).observations[0].measures).toEqual({ 'pain-level': 4 });
    expect(filterDataForPermissions(d, { ...noPermissions(), menstrual: true }).observations[0]).toMatchObject({ measures: { 'menstrual-bleeding': true }, sleepHours: null, headache: null });
  });
});

import { addAllergy, setNoKnownAllergies, toggleAllergen } from './onboarding/profileDraft';
import { allergyMatchesMedication } from './conditions/allergies';
import { answerQuestion as askQ } from './assistant/answer';

describe('allergies', () => {
  it('onboarding: "no known allergies" is exclusive, duplicates are ignored, and skipping stays "not recorded"', () => {
    let d = toggleAllergen(emptyDraft(), 'Peanuts', 'food');
    d = addAllergy(d, 'peanuts');
    expect(d.allergies).toHaveLength(1);
    d = setNoKnownAllergies(d, true);
    expect(d.allergies).toEqual([]);
    d = addAllergy(d, 'Latex', 'latex');
    expect(d.noKnownAllergies).toBe(false);
    const base = { ...emptyDraft(), about: { ...emptyDraft().about, fullName: 'A', age: '30', sex: 'female' as const } };
    expect(createUserState(base, TODAY).data.profile.noKnownAllergies).toBe(false);
    expect(createUserState(setNoKnownAllergies(base, true), TODAY).data.profile.noKnownAllergies).toBe(true);
    expect(createUserState(d, TODAY).data.allergies[0]).toMatchObject({ substance: 'Latex', category: 'latex', status: 'patient-reported' });
  });

  it('matches medication allergies by name only, and ignores resolved or non-medication allergies', () => {
    const al = createSyntheticDataset().allergies;
    expect(allergyMatchesMedication(al, 'Lamotrigine XR').map((a) => a.substance)).toEqual(['Lamotrigine']);
    expect(allergyMatchesMedication(al, 'Pollenex')).toEqual([]);
    expect(allergyMatchesMedication(al.map((a) => ({ ...a, status: 'resolved' as const })), 'Lamotrigine')).toEqual([]);
  });

  it('appear in the clinician report, and absence is "not recorded" unless the person said none', () => {
    const data = createSyntheticDataset();
    const sec = (d: typeof data) => buildClinicianSummary(d, [], [], W, DEFAULT_SETTINGS).sections.find((s) => s.id === 'allergies')!.items.map((i) => i.text);
    expect(sec(data)).toEqual(['Lamotrigine (medication) – reaction: Rash during titration (2019); severity moderate.', 'Tree pollen (environmental) – reaction: Sneezing, itchy eyes in spring; severity mild.']);
    expect(sec({ ...data, allergies: [] })).toEqual(['Allergies not recorded.']);
    expect(sec({ ...data, allergies: [], profile: { ...data.profile, noKnownAllergies: true } })).toEqual(['No known allergies (patient-reported).']);
  });

  it('are shared only with the health-profile permission, and the assistant lists them', () => {
    const data = createSyntheticDataset();
    expect(filterDataForPermissions(data, { ...noPermissions(), symptoms: true }).allergies).toEqual([]);
    expect(filterDataForPermissions(data, { ...noPermissions(), profile: true }).allergies).toHaveLength(2);
    const b = computeBundle(initialState());
    const ctx = { data, window: b.window, findingsByOutcome: b.findingsByOutcome, flags: b.flags, insufficient: b.insufficient, connections: b.connections, completeness: b.completeness, seizures: b.seizures, sleepThreshold: 6 };
    expect(askQ('What am I allergic to?', ctx).bullets.join(' ')).toContain('Lamotrigine');
    expect(askQ('My throat is swelling after a bee sting', ctx).kind).toBe('emergency');
  });
});
