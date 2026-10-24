/** Pure state reducers: a profile-level reducer (records/settings) and a root reducer (demo vs user profile). */
import type {
  AllergyRecord,
  AnalysisSettings,
  CareTask,
  DailyObservation,
  HealthData,
  HistoryRecord,
  JournalEntry,
  Medication,
  MedicationEvent,
  MenstrualRecord,
  NavigatorState,
  PatientProfile,
  SeizureEvent,
  SharedPerson,
} from '../models/types';
import { DEFAULT_SETTINGS, emptyNavigator } from '../models/types';
import type { PeriodPreset } from '../analysis/context';
import { createSyntheticDataset } from '../data/syntheticDataset';

export type CollectionKey = 'seizures' | 'observations' | 'menstrual' | 'medications' | 'medicationEvents' | 'history' | 'allergies' | 'tasks' | 'journal' | 'sharing';
export type RecordOf<K extends CollectionKey> = HealthData[K][number];
export type AnyRecord = AllergyRecord | SeizureEvent | DailyObservation | MenstrualRecord | Medication | MedicationEvent | HistoryRecord | CareTask | JournalEntry | SharedPerson;

export interface AppState {
  data: HealthData;
  settings: AnalysisSettings;
  period: PeriodPreset;
}

export type Action =
  | { type: 'upsert'; collection: CollectionKey; record: AnyRecord }
  | { type: 'delete'; collection: CollectionKey; id: string }
  | { type: 'patchObservation'; id: string; patch: Partial<DailyObservation> }
  | { type: 'batch'; actions: Action[] }
  | { type: 'replaceData'; data: HealthData }
  | { type: 'resetSynthetic' }
  | { type: 'updateProfile'; profile: Partial<PatientProfile> }
  | { type: 'setNavigator'; navigator: NavigatorState }
  | { type: 'toggleReviewExcluded'; id: string }
  | { type: 'setSettings'; settings: Partial<AnalysisSettings> }
  | { type: 'setPeriod'; period: PeriodPreset };

export function initialState(): AppState {
  return { data: createSyntheticDataset(), settings: { ...DEFAULT_SETTINGS }, period: '90' };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'upsert': {
      const list = state.data[action.collection] as Array<{ id: string }>;
      const idx = list.findIndex((r) => r.id === action.record.id);
      const next = idx === -1 ? [...list, action.record] : list.map((r, i) => (i === idx ? action.record : r));
      return { ...state, data: { ...state.data, [action.collection]: next } };
    }
    case 'delete': {
      const list = state.data[action.collection] as Array<{ id: string }>;
      const data = { ...state.data, [action.collection]: list.filter((r) => r.id !== action.id) } as HealthData;
      // Deleting a medication removes its dose changes, missed doses and side-effect reports.
      if (action.collection === 'medications') data.medicationEvents = data.medicationEvents.filter((e) => e.medicationId !== action.id);
      return { ...state, data };
    }
    case 'patchObservation':
      return { ...state, data: { ...state.data, observations: state.data.observations.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)) } };
    case 'batch':
      return action.actions.reduce(reducer, state);
    case 'replaceData':
      return { ...state, data: normalizeData(action.data) };
    case 'resetSynthetic':
      return { ...state, data: createSyntheticDataset() };
    case 'updateProfile':
      return { ...state, data: { ...state.data, profile: { ...state.data.profile, ...action.profile } } };
    case 'setNavigator':
      return { ...state, data: { ...state.data, navigator: action.navigator } };
    case 'toggleReviewExcluded': {
      const ex = state.data.reviewExcluded;
      return { ...state, data: { ...state.data, reviewExcluded: ex.includes(action.id) ? ex.filter((x) => x !== action.id) : [...ex, action.id] } };
    }
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'setPeriod':
      return { ...state, period: action.period };
  }
}

/** Fill defaults for fields added after v1 so older saved data and imports keep working. */
export function normalizeData(d: HealthData): HealthData {
  const raw = d as Partial<HealthData> & Pick<HealthData, 'profile'>;
  const seizures = raw.seizures ?? [];
  const menstrual = raw.menstrual ?? [];
  return {
    profile: {
      ...raw.profile,
      goals: raw.profile.goals ?? [],
      trackers: raw.profile.trackers ?? { seizures: seizures.length > 0, menstrual: menstrual.length > 0 },
      careTeam: raw.profile.careTeam ?? [],
    },
    seizures,
    observations: raw.observations ?? [],
    menstrual,
    medications: raw.medications ?? [],
    medicationEvents: raw.medicationEvents ?? [],
    history: raw.history ?? [],
    allergies: raw.allergies ?? [],
    tasks: (raw.tasks ?? []).map((t) => ({ contactedWho: '', contactedOn: null, followUpDate: null, notes: '', links: [], ...t })),
    journal: raw.journal ?? [],
    sharing: raw.sharing ?? [],
    navigator: { ...emptyNavigator(), ...(raw.navigator ?? {}) },
    reviewExcluded: raw.reviewExcluded ?? [],
  };
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Root state: separate demo and user profiles.

export type ProfileSlot = 'demo' | 'user';

export interface RootState {
  active: ProfileSlot | null;
  profiles: { demo: AppState; user: AppState | null };
}

export type RootAction =
  | { type: 'enterDemo' }
  | { type: 'createUserProfile'; state: AppState }
  | { type: 'switchProfile'; slot: ProfileSlot }
  | { type: 'signOut' }
  | { type: 'deleteUserProfile' }
  | { type: 'profile'; action: Action };

export function initialRoot(): RootState {
  return { active: null, profiles: { demo: initialState(), user: null } };
}

export function rootReducer(root: RootState, action: RootAction): RootState {
  switch (action.type) {
    case 'enterDemo':
      return { ...root, active: 'demo' };
    case 'createUserProfile':
      return { active: 'user', profiles: { ...root.profiles, user: action.state } };
    case 'switchProfile':
      if (action.slot === 'user' && !root.profiles.user) return root;
      return { ...root, active: action.slot };
    case 'signOut':
      return { ...root, active: null };
    case 'deleteUserProfile':
      return { active: root.active === 'user' ? null : root.active, profiles: { ...root.profiles, user: null } };
    case 'profile': {
      if (!root.active) return root;
      const current = root.profiles[root.active];
      if (!current) return root;
      return { ...root, profiles: { ...root.profiles, [root.active]: reducer(current, action.action) } };
    }
  }
}
