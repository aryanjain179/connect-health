/** Onboarding draft model, validation and conversion to a new user profile (pure functions). */
import type { GoalId, ISODate, Sex, Trackers } from '../models/types';
import { DEFAULT_SETTINGS, emptyNavigator } from '../models/types';
import { CONDITION_BY_ID, selectionsToHistory, type ConditionSelection } from '../conditions/catalog';
import { isValidISODate } from '../analysis/dates';
import { draftsToAllergies, type AllergyDraft } from '../conditions/allergies';
import type { AllergyCategory } from '../models/types';
import type { AppState } from '../store/reducer';

export interface AboutDraft {
  fullName: string;
  preferredName: string;
  ageMode: 'age' | 'dob';
  age: string;
  dateOfBirth: string;
  sex: Sex | '';
  genderIdentity: string;
  pronouns: string;
}

export interface OnboardingDraft {
  step: number;
  about: AboutDraft;
  conditions: ConditionSelection[];
  noKnownConditions: boolean;
  conditionsSkipped: boolean;
  allergies: AllergyDraft[];
  /** Explicit "no known allergies" – distinct from skipping (unknown). */
  noKnownAllergies: boolean;
  allergiesSkipped: boolean;
  goals: GoalId[];
  trackers: Trackers;
}

export function emptyDraft(): OnboardingDraft {
  return {
    step: 0,
    about: { fullName: '', preferredName: '', ageMode: 'age', age: '', dateOfBirth: '', sex: '', genderIdentity: '', pronouns: '' },
    conditions: [],
    noKnownConditions: false,
    conditionsSkipped: false,
    allergies: [],
    noKnownAllergies: false,
    allergiesSkipped: false,
    goals: [],
    trackers: { seizures: false, menstrual: false },
  };
}

export function ageFromDob(dob: ISODate, today: ISODate): number {
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function validateAbout(a: AboutDraft, today: ISODate): Record<string, string> {
  const e: Record<string, string> = {};
  const name = a.fullName.trim();
  if (!name) e.fullName = 'Please enter your name (it is stored only in this browser).';
  else if (name.length > 80) e.fullName = 'Please use 80 characters or fewer.';
  if (a.ageMode === 'age') {
    const n = Number(a.age);
    if (a.age.trim() === '') e.age = 'Enter your age, or switch to date of birth.';
    else if (!Number.isInteger(n) || n < 0 || n > 120) e.age = 'Enter a whole number between 0 and 120.';
  } else if (!isValidISODate(a.dateOfBirth)) e.dateOfBirth = 'Enter a valid date of birth.';
  else if (a.dateOfBirth > today) e.dateOfBirth = 'Date of birth cannot be in the future.';
  else if (ageFromDob(a.dateOfBirth, today) > 120) e.dateOfBirth = 'Please check the year.';
  if (!a.sex) e.sex = 'Choose an option (you can choose “Prefer not to say”).';
  return e;
}

/** Selecting "No known diagnosed conditions" removes diagnosed selections; symptoms and suspected stay. */
export function setNoKnownConditions(d: OnboardingDraft, value: boolean): OnboardingDraft {
  return { ...d, noKnownConditions: value, conditions: value ? d.conditions.filter((c) => c.status !== 'diagnosed') : d.conditions };
}

export function toggleCondition(d: OnboardingDraft, id: string, label: string): OnboardingDraft {
  if (d.conditions.some((c) => c.id === id)) return { ...d, conditions: d.conditions.filter((c) => c.id !== id) };
  return { ...d, conditions: [...d.conditions, { id, label, status: d.noKnownConditions ? 'symptom' : 'diagnosed' }], conditionsSkipped: false };
}

export function setConditionStatus(d: OnboardingDraft, id: string, status: ConditionSelection['status']): OnboardingDraft {
  // Choosing "Diagnosed" turns off the mutually exclusive "No known diagnosed conditions" option.
  return {
    ...d,
    noKnownConditions: status === 'diagnosed' ? false : d.noKnownConditions,
    conditions: d.conditions.map((c) => (c.id === id ? { ...c, status } : c)),
  };
}

export function addCustomCondition(d: OnboardingDraft, label: string): OnboardingDraft {
  const clean = label.trim().slice(0, 80);
  if (!clean) return d;
  const id = `custom:${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (d.conditions.some((c) => c.id === id)) return d;
  return { ...d, conditions: [...d.conditions, { id, label: clean, status: d.noKnownConditions ? 'symptom' : 'diagnosed' }] };
}

let allergySeq = 0;

/** Add an allergy (deduplicated by substance). Adding one clears "no known allergies". */
export function addAllergy(d: OnboardingDraft, substance: string, category: AllergyCategory = 'other'): OnboardingDraft {
  const clean = substance.trim().slice(0, 80);
  if (!clean || d.allergies.some((a) => a.substance.toLowerCase() === clean.toLowerCase())) return d;
  return { ...d, noKnownAllergies: false, allergiesSkipped: false, allergies: [...d.allergies, { id: `ad-${++allergySeq}-${clean.toLowerCase()}`, substance: clean, category, reaction: '', severity: 'unknown' }] };
}

export function toggleAllergen(d: OnboardingDraft, substance: string, category: AllergyCategory): OnboardingDraft {
  const existing = d.allergies.find((a) => a.substance.toLowerCase() === substance.toLowerCase());
  return existing ? { ...d, allergies: d.allergies.filter((a) => a !== existing) } : addAllergy(d, substance, category);
}

export function updateAllergy(d: OnboardingDraft, id: string, patch: Partial<AllergyDraft>): OnboardingDraft {
  return { ...d, allergies: d.allergies.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

/** "No known allergies" is mutually exclusive with listed allergies. */
export function setNoKnownAllergies(d: OnboardingDraft, value: boolean): OnboardingDraft {
  return { ...d, noKnownAllergies: value, allergiesSkipped: false, allergies: value ? [] : d.allergies };
}

/** Trackers suggested by selected conditions (the user still decides). */
export function suggestedTrackers(d: OnboardingDraft): Trackers {
  const s = { seizures: false, menstrual: false };
  for (const c of d.conditions) {
    const t = CONDITION_BY_ID.get(c.id)?.suggestsTracker;
    if (t) s[t] = true;
  }
  return s;
}

export function createUserState(d: OnboardingDraft, today: ISODate): AppState {
  const a = d.about;
  const age = a.ageMode === 'dob' ? ageFromDob(a.dateOfBirth, today) : Number(a.age);
  let n = 0;
  const history = selectionsToHistory(d.conditions, today, () => `hx-user-${++n}`);
  const diagnosed = d.conditions.filter((c) => c.status === 'diagnosed').map((c) => c.label);
  return {
    data: {
      profile: {
        id: 'patient-user',
        displayName: a.fullName.trim(),
        preferredName: a.preferredName.trim() || undefined,
        age,
        dateOfBirth: a.ageMode === 'dob' ? a.dateOfBirth : null,
        sex: a.sex || 'unspecified',
        genderIdentity: a.genderIdentity.trim() || undefined,
        pronouns: a.pronouns.trim() || undefined,
        conditionFocus: diagnosed.join(', ') || 'Not specified',
        goals: d.goals,
        // The seizure log is part of the daily check-in only when epilepsy is selected (any status).
        trackers: { seizures: d.conditions.some((c) => c.id === 'epilepsy'), menstrual: d.trackers.menstrual },
        noKnownConditions: d.noKnownConditions,
        noKnownAllergies: d.noKnownAllergies && !d.allergies.length,
        careTeam: [],
        isSynthetic: false,
      },
      seizures: [],
      observations: [],
      menstrual: [],
      medications: [],
      medicationEvents: [],
      history,
      tasks: [],
      allergies: draftsToAllergies(d.allergies, today),
      journal: [],
      sharing: [],
      navigator: emptyNavigator(),
      reviewExcluded: [],
    },
    settings: { ...DEFAULT_SETTINGS, outcome: d.conditions.some((c) => c.id === 'epilepsy') ? 'seizures' : 'headache' },
    period: '30',
  };
}
