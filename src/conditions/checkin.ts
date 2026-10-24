/**
 * Condition-driven daily check-in.
 *
 * Every check-in asks the core questions (sleep, sleep quality, stress, illness, other symptoms, notes). Extra
 * questions appear only when they are relevant to the conditions the person selected – for example the seizure log
 * appears only for epilepsy, a pain scale for chronic pain or fibromyalgia, blood pressure for hypertension.
 * A question that already has recorded answers stays visible so existing data are never hidden.
 *
 * Measures are optional self-reports. Nothing is inferred from them, and they are not diagnostic.
 */
import type { DailyObservation, HealthData } from '../models/types';
import { CONDITION_BY_ID } from './catalog';

export type BuiltinField = 'headache' | 'dizziness' | 'attentionDifficulty';

export interface BuiltinFieldDef {
  key: BuiltinField;
  label: string;
  conditions: string[];
}

export interface MeasureDef {
  id: string;
  label: string;
  kind: 'boolean' | 'scale' | 'number';
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  conditions: string[];
  /** Wording used when a yes/no measure is analysed as a pattern outcome. */
  noun?: string;
  plural?: string;
}

export const BUILTIN_FIELDS: BuiltinFieldDef[] = [
  { key: 'headache', label: 'Headache', conditions: ['migraine', 'chronic-headache'] },
  { key: 'dizziness', label: 'Dizziness', conditions: ['migraine', 'multiple-sclerosis', 'stroke-history', 'neuropathy', 'parkinsons', 'arrhythmia', 'heart-failure', 'hypertension'] },
  { key: 'attentionDifficulty', label: 'Attention / concentration difficulty', conditions: ['adhd', 'epilepsy'] },
];

const BP = ['hypertension', 'heart-failure', 'coronary-artery-disease', 'ckd'];

export const MEASURES: MeasureDef[] = [
  { id: 'pain-level', label: 'Pain level (0–10)', kind: 'scale', min: 0, max: 10, step: 1, hint: '0 = no pain, 10 = worst imaginable.', conditions: ['chronic-pain', 'fibromyalgia', 'arthritis', 'endometriosis', 'neuropathy'] },
  { id: 'low-mood', label: 'Low mood', kind: 'boolean', conditions: ['depression', 'ptsd'], noun: 'low mood', plural: 'low-mood days' },
  { id: 'anxiety', label: 'Anxiety', kind: 'boolean', conditions: ['anxiety', 'ptsd'], noun: 'anxiety', plural: 'anxiety days' },
  { id: 'fatigue', label: 'Fatigue', kind: 'boolean', conditions: ['multiple-sclerosis', 'fibromyalgia', 'thyroid', 'autoimmune', 'heart-failure', 'ckd', 'sleep-apnea', 'parkinsons', 'depression'], noun: 'fatigue', plural: 'fatigue days' },
  { id: 'gi-symptoms', label: 'Digestive symptoms (pain, bloating, diarrhoea, reflux)', kind: 'boolean', conditions: ['ibs', 'ibd', 'celiac', 'gerd'], noun: 'digestive symptoms', plural: 'digestive-symptom days' },
  { id: 'breathing-symptoms', label: 'Breathing symptoms (wheeze, cough, chest tightness)', kind: 'boolean', conditions: ['asthma', 'allergies'], noun: 'breathing symptoms', plural: 'breathing-symptom days' },
  { id: 'rescue-inhaler', label: 'Rescue inhaler uses', kind: 'number', min: 0, max: 50, step: 1, conditions: ['asthma'] },
  { id: 'glucose', label: 'Blood glucose (mg/dL, if you measured it)', kind: 'number', min: 20, max: 600, step: 1, conditions: ['diabetes'] },
  { id: 'bp-systolic', label: 'Blood pressure – systolic (mmHg, if measured)', kind: 'number', min: 60, max: 260, step: 1, conditions: BP },
  { id: 'bp-diastolic', label: 'Blood pressure – diastolic (mmHg, if measured)', kind: 'number', min: 30, max: 160, step: 1, conditions: BP },
  { id: 'palpitations', label: 'Palpitations', kind: 'boolean', conditions: ['arrhythmia', 'heart-failure', 'thyroid'], noun: 'palpitations', plural: 'palpitation days' },
  { id: 'tremor-stiffness', label: 'Tremor or stiffness worse than usual', kind: 'boolean', conditions: ['parkinsons', 'multiple-sclerosis'], noun: 'worse tremor or stiffness', plural: 'worse tremor/stiffness days' },
  { id: 'cpap-used', label: 'Used CPAP / sleep-apnoea device last night', kind: 'boolean', conditions: ['sleep-apnea'] },
  { id: 'urinary-symptoms', label: 'Urinary symptoms', kind: 'boolean', conditions: ['urinary', 'ckd'], noun: 'urinary symptoms', plural: 'urinary-symptom days' },
  { id: 'hot-flashes', label: 'Hot flashes or night sweats', kind: 'boolean', conditions: ['menopause'], noun: 'hot flashes', plural: 'hot-flash days' },
];

export const MEASURE_BY_ID = new Map(MEASURES.map((m) => [m.id, m]));

/** Yes/no measures that can be analysed as a pattern outcome (CPAP use is a behaviour, not a symptom). */
export const OUTCOME_MEASURES = MEASURES.filter((m) => m.kind === 'boolean' && m.noun);

/** Catalog condition ids the person currently has recorded (diagnosed, suspected or as symptoms). */
export function activeConditionIds(data: HealthData): Set<string> {
  const out = new Set<string>();
  for (const h of data.history) {
    if (h.status === 'resolved' || h.status === 'ruled-out') continue;
    if (h.kind !== 'diagnosis' && h.kind !== 'symptom') continue;
    for (const t of h.tags) {
      if (t.startsWith('condition:')) out.add(t.slice('condition:'.length));
      else if (h.kind === 'diagnosis' && CONDITION_BY_ID.has(t)) out.add(t);
    }
  }
  return out;
}

/** The seizure log appears only when epilepsy is selected – or when seizures are already recorded. */
export function seizureModuleOn(data: HealthData): boolean {
  return activeConditionIds(data).has('epilepsy') || data.seizures.length > 0;
}

export function menstrualModuleOn(data: HealthData): boolean {
  return !!data.profile.trackers?.menstrual || data.menstrual.length > 0;
}

export interface PlanItem {
  key: string;
  label: string;
  /** Why the question is shown, e.g. ["Migraine"] or ["previously recorded"]. */
  reasons: string[];
}

export interface CheckinPlan {
  seizures: PlanItem | null;
  menstrual: PlanItem | null;
  builtin: Array<PlanItem & { key: BuiltinField }>;
  measures: Array<PlanItem & { def: MeasureDef }>;
}

const labelOf = (id: string) => CONDITION_BY_ID.get(id)?.label ?? id;

/** Which condition-specific questions a check-in shows. `current` keeps fields with an existing answer visible. */
export function checkinPlan(data: HealthData, current?: DailyObservation | null, showAll = false): CheckinPlan {
  const conds = activeConditionIds(data);
  const reasonsFor = (conditions: string[], hasData: boolean) => {
    const r = conditions.filter((c) => conds.has(c)).map(labelOf);
    if (!r.length && hasData) r.push('previously recorded');
    if (!r.length && showAll) r.push('shown because “all questions” is on');
    return r;
  };
  const builtin = BUILTIN_FIELDS.map((f) => {
    const hasData = data.observations.some((o) => o[f.key] !== null && o[f.key] !== undefined) || (current?.[f.key] ?? null) !== null;
    return { key: f.key, label: f.label, reasons: reasonsFor(f.conditions, hasData) };
  }).filter((x) => x.reasons.length);
  const measures = MEASURES.map((m) => {
    const hasData = data.observations.some((o) => o.measures?.[m.id] !== undefined && o.measures?.[m.id] !== null) || (current?.measures?.[m.id] ?? null) !== null;
    return { key: m.id, label: m.label, def: m, reasons: reasonsFor(m.conditions, hasData) };
  }).filter((x) => x.reasons.length);
  const seizureReasons = conds.has('epilepsy') ? ['Epilepsy'] : data.seizures.length ? ['previously recorded'] : [];
  return {
    seizures: seizureReasons.length ? { key: 'seizures', label: 'Seizure log', reasons: seizureReasons } : null,
    menstrual: menstrualModuleOn(data) ? { key: 'menstrual', label: 'Menstrual bleeding', reasons: ['menstrual-cycle tracking is on'] } : null,
    builtin,
    measures,
  };
}

/** Check-in plan preview for onboarding (before any data exist). */
export function planForConditions(conditionIds: string[]): Array<{ label: string; reasons: string[] }> {
  const ids = new Set(conditionIds);
  const out: Array<{ label: string; reasons: string[] }> = [];
  if (ids.has('epilepsy')) out.push({ label: 'Seizure log', reasons: ['Epilepsy'] });
  for (const f of BUILTIN_FIELDS) {
    const r = f.conditions.filter((c) => ids.has(c)).map(labelOf);
    if (r.length) out.push({ label: f.label, reasons: r });
  }
  for (const m of MEASURES) {
    const r = m.conditions.filter((c) => ids.has(c)).map(labelOf);
    if (r.length) out.push({ label: m.label, reasons: r });
  }
  return out;
}

export function validateMeasures(measures: DailyObservation['measures']): Record<string, string> {
  const e: Record<string, string> = {};
  for (const [id, v] of Object.entries(measures ?? {})) {
    const def = MEASURE_BY_ID.get(id);
    if (!def || v === null || typeof v === 'boolean') continue;
    if (!Number.isFinite(v)) e[`measure:${id}`] = 'Enter a number.';
    else if ((def.min !== undefined && v < def.min) || (def.max !== undefined && v > def.max)) e[`measure:${id}`] = `Must be between ${def.min} and ${def.max}.`;
    else if (def.step === 1 && !Number.isInteger(v)) e[`measure:${id}`] = 'Must be a whole number.';
  }
  return e;
}

/** Human-readable list of recorded measures for display. */
export function describeMeasures(o: DailyObservation): string[] {
  return Object.entries(o.measures ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([id, v]) => {
      const def = MEASURE_BY_ID.get(id);
      const label = id === 'menstrual-bleeding' ? 'Menstrual bleeding' : (def?.label.replace(/\s*\(.*\)$/, '') ?? id);
      return typeof v === 'boolean' ? `${label}: ${v ? 'yes' : 'no'}` : `${label}: ${v}`;
    });
}
