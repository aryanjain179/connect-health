/**
 * Deterministic synthetic dataset for ConnectHealth.
 *
 * ALL DATA ARE FICTIONAL. "Maya R." is not a real person, and no record is derived from a real patient.
 *
 * Design (see docs/DATASET.md for the full specification and expected analysis outputs):
 * - 90 days, 2026-07-23 → 2026-10-20.
 * - A seeded PRNG generates baseline noise that never crosses an analysis threshold
 *   (baseline sleep 6.3–8.4 h, baseline stress 2–6). Every value that matters to an analysis is an explicit override.
 */
import { emptyNavigator } from '../models/types';
import type {
  CareTask,
  DailyObservation,
  HealthData,
  HistoryRecord,
  Medication,
  MedicationEvent,
  MenstrualRecord,
  SeizureEvent,
} from '../models/types';
import { addDays, eachDay } from '../analysis/dates';

export const SYNTHETIC_START = '2026-07-23';
export const SYNTHETIC_END = '2026-10-20';
const SEED = 20260723;

/** mulberry32 – small deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Days with no check-in at all. */
export const MISSING_CHECKIN_DAYS = [
  '2026-08-19',
  '2026-08-20',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-10-09',
  '2026-10-11',
];

/** Check-ins where only a headache answer was recorded (sleep, stress, attention etc. not recorded). */
const PARTIAL_CHECKIN_DAYS = ['2026-08-27', '2026-10-12'];
/** Check-in recorded but sleep not entered. */
const SLEEP_NOT_RECORDED = ['2026-09-23'];
/** Check-in recorded but stress not entered. */
const STRESS_NOT_RECORDED = ['2026-09-05'];

/** Nights < 6 h (night ending on the morning of the date). */
const SHORT_SLEEP: Record<string, number> = {
  // nights before seizure days
  '2026-07-26': 5.2,
  '2026-08-02': 5.0,
  '2026-08-09': 5.4,
  '2026-08-24': 4.8,
  '2026-08-29': 5.6,
  '2026-09-06': 5.3,
  '2026-09-27': 5.1,
  '2026-10-05': 5.5,
  '2026-10-14': 4.6,
  // short nights without a seizure
  '2026-07-29': 5.7,
  '2026-07-31': 5.5,
  '2026-08-06': 5.2,
  '2026-08-14': 5.8,
  '2026-08-16': 5.4,
  '2026-08-22': 5.6,
  '2026-09-03': 5.0,
  '2026-09-11': 5.7,
  '2026-09-13': 5.5,
  '2026-09-20': 5.3,
  '2026-09-25': 5.8,
  '2026-10-01': 5.1,
  '2026-10-03': 5.6,
  '2026-10-10': 5.4,
  '2026-10-16': 5.7,
};

/** Adequate-sleep nights before seizure days (explicit for transparency). */
const SEIZURE_DAY_ADEQUATE_SLEEP: Record<string, number> = {
  '2026-08-12': 6.8,
  '2026-09-09': 7.1,
  '2026-10-18': 6.9,
};

/** Stress ratings ≥ 7. */
const HIGH_STRESS: Record<string, number> = {
  '2026-08-02': 7,
  '2026-09-27': 8,
  '2026-07-30': 7,
  '2026-08-05': 8,
  '2026-08-06': 7,
  '2026-08-15': 7,
  '2026-08-16': 8,
  '2026-09-02': 7,
  '2026-09-03': 8,
  '2026-09-12': 7,
  '2026-09-21': 7,
  '2026-09-30': 8,
  '2026-10-01': 7,
  '2026-10-15': 7,
};

const ILLNESS_DAYS = ['2026-09-18', '2026-09-19'];

function buildObservations(): DailyObservation[] {
  const rand = mulberry32(SEED);
  const out: DailyObservation[] = [];
  for (const date of eachDay(SYNTHETIC_START, SYNTHETIC_END)) {
    // Always draw the same number of random values per day so overrides never shift the sequence.
    const rSleep = rand();
    const rQuality = rand();
    const rStress = rand();
    const rAttention = rand();
    const rHeadache = rand();
    const rDizzy = rand();
    const rFatigue = rand();

    if (MISSING_CHECKIN_DAYS.includes(date)) continue;

    if (PARTIAL_CHECKIN_DAYS.includes(date)) {
      out.push({
        id: `obs-${date}`,
        date,
        sleepHours: null,
        sleepQuality: null,
        stressLevel: null,
        illness: null,
        headache: rHeadache < 0.5,
        dizziness: null,
        attentionDifficulty: null,
        otherSymptoms: [],
        notes: 'Quick check-in – only headache answered.',
        isSynthetic: true,
      });
      continue;
    }

    const short = SHORT_SLEEP[date];
    const sleepHours = SLEEP_NOT_RECORDED.includes(date)
      ? null
      : (short ?? SEIZURE_DAY_ADEQUATE_SLEEP[date] ?? round1(6.3 + rSleep * 2.1));
    const sleepQuality = sleepHours === null ? null : short !== undefined ? 2 : rQuality < 0.5 ? 3 : 4;
    const stressLevel = STRESS_NOT_RECORDED.includes(date)
      ? null
      : (HIGH_STRESS[date] ?? 2 + Math.floor(rStress * 5)); // baseline 2–6
    const attentionDifficulty = short !== undefined ? true : rAttention < 0.25;
    const afterDoseChange = date >= '2026-09-01';
    const otherSymptoms: string[] = [];
    if (rFatigue < 0.2 || short !== undefined) otherSymptoms.push('fatigue');
    if (afterDoseChange && rFatigue > 0.85) otherSymptoms.push('irritability');

    out.push({
      id: `obs-${date}`,
      date,
      sleepHours,
      sleepQuality,
      stressLevel,
      illness: ILLNESS_DAYS.includes(date),
      headache: rHeadache < 0.12,
      dizziness: rDizzy < (afterDoseChange ? 0.1 : 0.04),
      attentionDifficulty,
      otherSymptoms,
      notes: ILLNESS_DAYS.includes(date) ? 'Head cold.' : '',
      isSynthetic: true,
    });
  }
  return out;
}

type SeizureSeed = Omit<SeizureEvent, 'id' | 'isSynthetic' | 'preSymptoms' | 'postSymptoms' | 'notes'> &
  Partial<Pick<SeizureEvent, 'preSymptoms' | 'postSymptoms' | 'notes'>>;

const SEIZURE_SEEDS: SeizureSeed[] = [
  { date: '2026-07-26', time: '14:20', type: 'focal-impaired-awareness', durationSeconds: 90, severity: 'moderate', recoveryMinutes: 30, preSymptoms: ['rising stomach sensation'], postSymptoms: ['confusion', 'fatigue'] },
  { date: '2026-08-02', time: '09:10', type: 'focal-impaired-awareness', durationSeconds: 75, severity: 'moderate', recoveryMinutes: 25, preSymptoms: ['déjà vu'], postSymptoms: ['confusion'] },
  { date: '2026-08-09', time: '07:40', type: 'focal-impaired-awareness', durationSeconds: 120, severity: 'moderate', recoveryMinutes: 40, preSymptoms: ['rising stomach sensation'], postSymptoms: ['confusion', 'headache'] },
  { date: '2026-08-09', time: '18:05', type: 'focal-aware', durationSeconds: 40, severity: 'mild', recoveryMinutes: 5, preSymptoms: [], postSymptoms: ['fatigue'], notes: 'Second event the same day.' },
  { date: '2026-08-12', time: '11:30', type: 'focal-impaired-awareness', durationSeconds: 100, severity: 'moderate', recoveryMinutes: 30, preSymptoms: ['déjà vu'], postSymptoms: ['confusion'] },
  { date: '2026-08-19', time: '16:00', type: 'focal-aware', durationSeconds: 30, severity: 'mild', recoveryMinutes: 5, preSymptoms: ['tingling in right hand'], postSymptoms: [], notes: 'Logged later; no daily check-in that day.' },
  { date: '2026-08-24', time: '03:15', type: 'focal-impaired-awareness', durationSeconds: 110, severity: 'moderate', recoveryMinutes: 45, preSymptoms: [], postSymptoms: ['confusion', 'fatigue'], notes: 'Partner noticed during the night.' },
  { date: '2026-08-29', time: '13:00', type: 'focal-impaired-awareness', durationSeconds: 80, severity: 'moderate', recoveryMinutes: 20, preSymptoms: ['rising stomach sensation'], postSymptoms: ['fatigue'] },
  { date: '2026-09-06', time: '10:20', type: 'focal-impaired-awareness', durationSeconds: 95, severity: 'moderate', recoveryMinutes: 30, preSymptoms: ['déjà vu'], postSymptoms: ['confusion'] },
  { date: '2026-09-09', time: '08:45', type: 'focal-aware', durationSeconds: 35, severity: 'mild', recoveryMinutes: 5, preSymptoms: [], postSymptoms: [] },
  { date: '2026-09-27', time: '15:30', type: 'focal-impaired-awareness', durationSeconds: 85, severity: 'moderate', recoveryMinutes: 25, preSymptoms: ['rising stomach sensation'], postSymptoms: ['confusion'] },
  { date: '2026-10-05', time: '06:50', type: 'focal-impaired-awareness', durationSeconds: 100, severity: 'moderate', recoveryMinutes: 35, preSymptoms: ['déjà vu'], postSymptoms: ['confusion', 'headache'] },
  { date: '2026-10-05', time: '12:10', type: 'focal-aware', durationSeconds: 25, severity: 'mild', recoveryMinutes: 5, preSymptoms: [], postSymptoms: ['fatigue'], notes: 'Second event the same day.' },
  { date: '2026-10-14', time: '02:40', type: 'focal-to-bilateral-tonic-clonic', durationSeconds: 180, severity: 'severe', recoveryMinutes: 90, preSymptoms: [], postSymptoms: ['confusion', 'muscle soreness', 'bitten tongue', 'headache'], notes: 'Partner woke to stiffening and jerking; first event like this they remember.' },
  { date: '2026-10-18', time: '09:30', type: 'focal-impaired-awareness', durationSeconds: 70, severity: 'moderate', recoveryMinutes: 20, preSymptoms: ['rising stomach sensation'], postSymptoms: ['confusion'] },
];

function buildSeizures(): SeizureEvent[] {
  return SEIZURE_SEEDS.map((s, i) => ({
    id: `sz-${String(i + 1).padStart(3, '0')}`,
    preSymptoms: [],
    postSymptoms: [],
    notes: '',
    ...s,
    isSynthetic: true,
  }));
}

function buildMenstrual(): MenstrualRecord[] {
  const rows: Array<[string, string, MenstrualRecord['startCertainty'], string]> = [
    ['2026-07-14', '2026-07-18', 'exact', ''],
    ['2026-08-11', '2026-08-15', 'exact', ''],
    ['2026-09-08', '2026-09-12', 'approximate', 'Not sure whether it started on the 7th or 8th.'],
    ['2026-10-07', '2026-10-11', 'exact', ''],
  ];
  return rows.map(([periodStart, periodEnd, startCertainty, notes], i) => ({
    id: `cyc-${i + 1}`,
    periodStart,
    periodEnd,
    startCertainty,
    notes,
    isSynthetic: true,
  }));
}

function buildMedications(): Medication[] {
  return [
    {
      id: 'med-lev',
      name: 'Levetiracetam',
      indication: 'Focal epilepsy (maintenance)',
      kind: 'prescription',
      startDate: '2019-04-02',
      endDate: null,
      initialDose: '500 mg',
      frequency: 'twice daily',
      source: 'clinician-documented',
      notes: '',
      isSynthetic: true,
    },
    {
      id: 'med-ltg',
      name: 'Lamotrigine',
      indication: 'Focal epilepsy (initial therapy)',
      kind: 'prescription',
      startDate: '2019-01-15',
      endDate: '2019-03-30',
      initialDose: '25 mg',
      frequency: 'once daily (titration)',
      source: 'clinician-documented',
      notes: 'Stopped during titration because of a rash (fictional history).',
      isSynthetic: true,
    },
    {
      id: 'med-mdz',
      name: 'Midazolam nasal spray',
      indication: 'Rescue medication per seizure action plan',
      kind: 'rescue',
      startDate: '2024-06-10',
      endDate: null,
      initialDose: '5 mg',
      frequency: 'as directed in seizure action plan',
      source: 'clinician-documented',
      notes: 'Not used during the observation period.',
      isSynthetic: true,
    },
    {
      id: 'med-mel',
      name: 'Melatonin',
      indication: 'Self-started to help with sleep',
      kind: 'otc-supplement',
      startDate: '2026-10-10',
      endDate: null,
      initialDose: '3 mg',
      frequency: 'nightly',
      source: 'patient-reported',
      notes: 'Over-the-counter; not yet discussed with the care team.',
      isSynthetic: true,
    },
  ];
}

function buildMedicationEvents(): MedicationEvent[] {
  const rows: Array<Omit<MedicationEvent, 'isSynthetic'>> = [
    { id: 'mev-1', medicationId: 'med-lev', date: '2026-09-01', kind: 'dose-change', newDose: '750 mg', description: 'Dose increased by treating neurologist after diary review (fictional).', source: 'clinician-documented' },
    { id: 'mev-2', medicationId: 'med-lev', date: '2026-08-23', kind: 'missed-dose', newDose: null, description: 'Missed evening dose.', source: 'patient-reported' },
    { id: 'mev-3', medicationId: 'med-lev', date: '2026-08-28', kind: 'missed-dose', newDose: null, description: 'Missed morning dose.', source: 'patient-reported' },
    { id: 'mev-4', medicationId: 'med-lev', date: '2026-10-13', kind: 'missed-dose', newDose: null, description: 'Missed evening dose while travelling.', source: 'patient-reported' },
    { id: 'mev-5', medicationId: 'med-lev', date: '2026-09-10', kind: 'side-effect', newDose: null, description: 'Irritability and low mood since the dose increase.', source: 'patient-reported' },
    { id: 'mev-6', medicationId: 'med-lev', date: '2026-09-19', kind: 'side-effect', newDose: null, description: 'More tired in the afternoons.', source: 'patient-reported' },
  ];
  return rows.map((r) => ({ ...r, isSynthetic: true }));
}

function buildHistory(): HistoryRecord[] {
  const rows: Array<Omit<HistoryRecord, 'isSynthetic'>> = [
    { id: 'hx-epi', kind: 'diagnosis', label: 'Focal epilepsy', status: 'confirmed', source: 'clinician-documented', date: '2019-01-08', tags: ['epilepsy', 'focal-epilepsy', 'seizure-type:focal-aware', 'seizure-type:focal-impaired-awareness'], notes: 'Focal aware and focal impaired awareness seizures documented (fictional).' },
    { id: 'hx-mig', kind: 'diagnosis', label: 'Migraine without aura', status: 'confirmed', source: 'clinician-documented', date: '2016-05-01', tags: ['migraine', 'headache'], notes: '' },
    { id: 'hx-iron', kind: 'history', label: 'Iron-deficiency anaemia (treated)', status: 'resolved', source: 'external-record', date: '2022-03-01', tags: ['anaemia'], notes: '' },
    { id: 'hx-att', kind: 'symptom', label: 'Trouble keeping focus at work; loses track of tasks and conversations', status: 'patient-reported', source: 'patient-reported', date: '2026-08-18', tags: ['attention', 'concentration'], notes: '' },
    { id: 'hx-child', kind: 'history', label: 'Teachers noted difficulty sitting still and focusing in primary school (never formally evaluated)', status: 'patient-reported', source: 'patient-reported', date: null, tags: ['attention-childhood'], notes: '' },
    { id: 'hx-snore', kind: 'symptom', label: 'Partner reports loud snoring most nights', status: 'patient-reported', source: 'patient-reported', date: '2026-09-14', tags: ['snoring'], notes: '' },
    { id: 'hx-sleepy', kind: 'symptom', label: 'Nodding off at desk in the afternoons', status: 'patient-reported', source: 'patient-reported', date: '2026-09-29', tags: ['daytime-sleepiness'], notes: '' },
    { id: 'hx-mood', kind: 'symptom', label: 'Low mood and irritability since dose increase', status: 'patient-reported', source: 'patient-reported', date: '2026-09-12', tags: ['mood'], notes: '' },
    { id: 'hx-ref', kind: 'referral', label: 'Sleep medicine referral discussed at 2025 visit – appointment not yet scheduled', status: 'pending', source: 'patient-reported', date: '2025-11-20', tags: ['sleep-referral'], notes: '' },
  ];
  return rows.map((r) => ({ ...r, isSynthetic: true }));
}

function buildTasks(): CareTask[] {
  return [
    {
      id: 'task-seed-1',
      title: 'Record date of next neurology appointment',
      reason: 'Keep the appointment date with the diary so the clinician summary can be prepared beforehand.',
      kind: 'record-appointment',
      insightId: null,
      dueDate: addDays(SYNTHETIC_END, 7),
      appointmentDate: '2026-11-12',
      status: 'open',
      createdOn: SYNTHETIC_END,
      contactedWho: '',
      contactedOn: null,
      followUpDate: null,
      notes: '',
      links: [],
      isSynthetic: true,
    },
    {
      id: 'task-seed-2',
      title: 'Follow up on the pending sleep medicine referral',
      reason: 'Referral was discussed in 2025 but no appointment has been scheduled (patient-reported).',
      kind: 'referral-follow-up',
      insightId: null,
      dueDate: null,
      appointmentDate: null,
      status: 'in-progress',
      createdOn: SYNTHETIC_END,
      contactedWho: '',
      contactedOn: null,
      followUpDate: null,
      notes: '',
      links: [],
      isSynthetic: true,
    },
  ];
}

/** Returns a fresh copy of the full synthetic dataset. Pure and deterministic. */
export function createSyntheticDataset(): HealthData {
  return {
    profile: {
      id: 'patient-synthetic-001',
      displayName: 'Maya R. (synthetic)',
      age: 29,
      sex: 'female',
      pronouns: 'she/her',
      conditionFocus: 'epilepsy',
      careTeamNote: 'Fictional neurology clinic – not a real provider.',
      preferredName: 'Maya',
      goals: ['understand-patterns', 'prepare-appointments', 'explore-connections', 'find-specialists', 'insurance-referrals', 'track-factors'],
      trackers: { seizures: true, menstrual: true },
      careTeam: [
        { id: 'ct-neuro', specialty: 'neurology', name: 'Fictional neurology clinic', notes: 'Treating neurologist (fictional).' },
        { id: 'ct-pcp', specialty: 'primary-care', name: 'Fictional primary care practice', notes: '' },
      ],
      isSynthetic: true,
    },
    seizures: buildSeizures(),
    observations: buildObservations(),
    menstrual: buildMenstrual(),
    medications: buildMedications(),
    medicationEvents: buildMedicationEvents(),
    history: buildHistory(),
    tasks: buildTasks(),
    allergies: [
      { id: 'al-ltg', substance: 'Lamotrigine', category: 'medication', reaction: 'Rash during titration (2019)', severity: 'moderate', status: 'confirmed', source: 'clinician-documented', notedOn: '2019-03-30', notes: 'Fictional record.', isSynthetic: true },
      { id: 'al-pollen', substance: 'Tree pollen', category: 'environmental', reaction: 'Sneezing, itchy eyes in spring', severity: 'mild', status: 'patient-reported', source: 'patient-reported', notedOn: null, notes: '', isSynthetic: true },
    ],
    journal: [],
    sharing: [],
    navigator: emptyNavigator(),
    reviewExcluded: [],
  };
}
