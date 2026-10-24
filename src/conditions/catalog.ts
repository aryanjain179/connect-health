/**
 * Starter condition library for onboarding. Not an exhaustive medical taxonomy.
 * `tags` connect conditions to clinical-connection rules (e.g. `epilepsy`, `adhd`); `specialties` feed the Care
 * Navigator's "may be worth discussing" suggestions – they are never referrals.
 */
import type { GoalId, HistoryRecord, ISODate } from '../models/types';

export type SpecialtyId =
  | 'primary-care'
  | 'neurology'
  | 'sleep-medicine'
  | 'endocrinology'
  | 'cardiology'
  | 'gynecology'
  | 'reproductive-endocrinology'
  | 'psychiatry'
  | 'psychology'
  | 'physical-therapy'
  | 'occupational-therapy'
  | 'genetic-counseling'
  | 'gastroenterology'
  | 'rheumatology'
  | 'nephrology'
  | 'urology'
  | 'pulmonology'
  | 'allergy-immunology'
  | 'oncology'
  | 'pain-medicine';

export const SPECIALTY_LABELS: Record<SpecialtyId, string> = {
  'primary-care': 'Primary care',
  neurology: 'Neurology',
  'sleep-medicine': 'Sleep medicine',
  endocrinology: 'Endocrinology',
  cardiology: 'Cardiology',
  gynecology: 'Gynecology',
  'reproductive-endocrinology': 'Reproductive endocrinology',
  psychiatry: 'Psychiatry',
  psychology: 'Psychology',
  'physical-therapy': 'Physical therapy',
  'occupational-therapy': 'Occupational therapy',
  'genetic-counseling': 'Genetic counseling',
  gastroenterology: 'Gastroenterology',
  rheumatology: 'Rheumatology',
  nephrology: 'Nephrology',
  urology: 'Urology',
  pulmonology: 'Pulmonology',
  'allergy-immunology': 'Allergy & immunology',
  oncology: 'Oncology (existing care)',
  'pain-medicine': 'Pain medicine',
};

export interface CatalogCondition {
  id: string;
  label: string;
  category: string;
  tags: string[];
  specialties: SpecialtyId[];
  /** Suggests enabling an optional tracker (the user still decides). */
  suggestsTracker?: 'seizures' | 'menstrual';
}

const c = (id: string, label: string, category: string, specialties: SpecialtyId[], extraTags: string[] = [], suggestsTracker?: CatalogCondition['suggestsTracker']): CatalogCondition => ({
  id,
  label,
  category,
  tags: [id, ...extraTags],
  specialties,
  suggestsTracker,
});

export const CATEGORIES = [
  'Neurological',
  'Mental and behavioral health',
  'Cardiovascular',
  'Endocrine and metabolic',
  'Reproductive and gynecologic',
  'Respiratory and immune',
  'Gastrointestinal',
  'Musculoskeletal and pain',
  'Renal and urinary',
  'Other',
] as const;

export const CONDITIONS: CatalogCondition[] = [
  c('epilepsy', 'Epilepsy', 'Neurological', ['neurology'], [], 'seizures'),
  c('migraine', 'Migraine', 'Neurological', ['neurology', 'primary-care'], ['headache']),
  c('chronic-headache', 'Chronic headache', 'Neurological', ['neurology', 'primary-care'], ['headache']),
  c('multiple-sclerosis', 'Multiple sclerosis', 'Neurological', ['neurology', 'physical-therapy']),
  c('parkinsons', 'Parkinson’s disease', 'Neurological', ['neurology', 'physical-therapy', 'occupational-therapy']),
  c('stroke-history', 'Stroke history', 'Neurological', ['neurology', 'physical-therapy', 'occupational-therapy']),
  c('neuropathy', 'Neuropathy', 'Neurological', ['neurology', 'pain-medicine']),
  c('adhd', 'ADHD', 'Mental and behavioral health', ['psychiatry', 'psychology'], ['attention']),
  c('anxiety', 'Anxiety', 'Mental and behavioral health', ['psychology', 'psychiatry']),
  c('depression', 'Depression', 'Mental and behavioral health', ['psychology', 'psychiatry'], ['mood']),
  c('ptsd', 'PTSD', 'Mental and behavioral health', ['psychology', 'psychiatry']),
  c('sleep-behavioral', 'Sleep-related behavioral concerns', 'Mental and behavioral health', ['sleep-medicine', 'psychology'], ['insomnia']),
  c('hypertension', 'Hypertension', 'Cardiovascular', ['primary-care', 'cardiology']),
  c('heart-failure', 'Heart failure', 'Cardiovascular', ['cardiology']),
  c('arrhythmia', 'Arrhythmia', 'Cardiovascular', ['cardiology']),
  c('coronary-artery-disease', 'Coronary artery disease', 'Cardiovascular', ['cardiology']),
  c('diabetes', 'Diabetes', 'Endocrine and metabolic', ['endocrinology', 'primary-care']),
  c('thyroid', 'Thyroid disorders', 'Endocrine and metabolic', ['endocrinology']),
  c('pcos', 'PCOS', 'Endocrine and metabolic', ['endocrinology', 'gynecology'], [], 'menstrual'),
  c('obesity', 'Obesity', 'Endocrine and metabolic', ['primary-care', 'endocrinology']),
  c('endometriosis', 'Endometriosis', 'Reproductive and gynecologic', ['gynecology', 'pain-medicine'], [], 'menstrual'),
  c('infertility', 'Infertility', 'Reproductive and gynecologic', ['reproductive-endocrinology'], [], 'menstrual'),
  c('menstrual-disorders', 'Menstrual disorders', 'Reproductive and gynecologic', ['gynecology'], [], 'menstrual'),
  c('menopause', 'Menopause-related concerns', 'Reproductive and gynecologic', ['gynecology', 'primary-care']),
  c('asthma', 'Asthma', 'Respiratory and immune', ['pulmonology', 'allergy-immunology']),
  c('allergies', 'Allergies', 'Respiratory and immune', ['allergy-immunology']),
  c('autoimmune', 'Autoimmune conditions', 'Respiratory and immune', ['rheumatology']),
  c('sleep-apnea', 'Sleep apnea', 'Respiratory and immune', ['sleep-medicine'], ['osa']),
  c('ibs', 'IBS', 'Gastrointestinal', ['gastroenterology']),
  c('ibd', 'Inflammatory bowel disease', 'Gastrointestinal', ['gastroenterology']),
  c('celiac', 'Celiac disease', 'Gastrointestinal', ['gastroenterology']),
  c('gerd', 'GERD', 'Gastrointestinal', ['gastroenterology', 'primary-care']),
  c('arthritis', 'Arthritis', 'Musculoskeletal and pain', ['rheumatology', 'physical-therapy']),
  c('chronic-pain', 'Chronic pain', 'Musculoskeletal and pain', ['pain-medicine', 'physical-therapy']),
  c('fibromyalgia', 'Fibromyalgia', 'Musculoskeletal and pain', ['rheumatology', 'pain-medicine']),
  c('ckd', 'Chronic kidney disease', 'Renal and urinary', ['nephrology']),
  c('urinary', 'Recurrent urinary concerns', 'Renal and urinary', ['urology', 'primary-care']),
  c('cancer-history', 'Cancer history', 'Other', ['oncology', 'primary-care']),
  c('genetic', 'Genetic conditions', 'Other', ['genetic-counseling']),
  c('rare-disease', 'Rare diseases', 'Other', ['genetic-counseling', 'primary-care']),
];

export const CONDITION_BY_ID = new Map(CONDITIONS.map((x) => [x.id, x]));

export type ConditionStatus = 'diagnosed' | 'suspected' | 'symptom';

export interface ConditionSelection {
  /** Catalog id, or `custom:<slug>` for user-added conditions. */
  id: string;
  label: string;
  status: ConditionStatus;
}

export const STATUS_LABELS: Record<ConditionStatus, string> = {
  diagnosed: 'Diagnosed',
  suspected: 'Suspected',
  symptom: 'Symptom only',
};

export function searchConditions(query: string): CatalogCondition[] {
  const q = query.trim().toLowerCase();
  if (!q) return CONDITIONS;
  return CONDITIONS.filter((x) => x.label.toLowerCase().includes(q) || x.category.toLowerCase().includes(q) || x.tags.some((t) => t.includes(q)));
}

/**
 * Converts onboarding selections into history records. A selection is never upgraded: a symptom stays a symptom,
 * a suspected condition stays suspected. Diagnoses entered by the user are marked as patient-reported.
 */
export function selectionsToHistory(selections: ConditionSelection[], today: ISODate, idFor: (s: ConditionSelection) => string): HistoryRecord[] {
  return selections.map((s) => {
    const cat = CONDITION_BY_ID.get(s.id);
    // `condition:<id>` drives condition-specific check-in questions for every status; it never triggers
    // diagnosis-based connection rules (those look for the bare diagnosis tag, which symptoms do not get).
    const condTag = cat ? [`condition:${cat.id}`] : [];
    const tags = cat ? [...cat.tags, ...condTag] : ['custom'];
    const base = { id: idFor(s), label: s.label, source: 'patient-reported' as const, date: today, notes: 'Added during onboarding.', isSynthetic: false };
    if (s.status === 'diagnosed') return { ...base, kind: 'diagnosis' as const, status: 'confirmed' as const, tags, notes: 'Diagnosis reported by the user during onboarding (not clinician-verified in this app).' };
    if (s.status === 'suspected') return { ...base, kind: 'diagnosis' as const, status: 'suspected' as const, tags };
    // Symptom: keep descriptive tags but never the diagnosis tag, so no diagnosis-based rule fires from a symptom.
    return { ...base, kind: 'symptom' as const, status: 'patient-reported' as const, tags: cat ? [...cat.tags.filter((t) => t !== cat.id), ...condTag] : ['custom'] };
  });
}

export const GOALS: Array<{ id: GoalId; label: string }> = [
  { id: 'understand-patterns', label: 'Understand patterns in my symptoms' },
  { id: 'prepare-appointments', label: 'Prepare for medical appointments' },
  { id: 'organize-medications', label: 'Organize medications and health history' },
  { id: 'explore-connections', label: 'Explore potential connections between my conditions' },
  { id: 'find-specialists', label: 'Find the right specialists' },
  { id: 'insurance-referrals', label: 'Understand insurance and referral next steps' },
  { id: 'track-factors', label: 'Track sleep, stress, menstrual cycles, or other personal factors' },
  { id: 'share-caregiver', label: 'Share selected information with a caregiver or family member' },
];
