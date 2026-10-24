/** Pure state reducer for HealthConnect. */
import type { AnalysisSettings, CareTask, DailyObservation, HealthData, HistoryRecord, Medication, MedicationEvent, MenstrualRecord, SeizureEvent } from '../models/types';
import { DEFAULT_SETTINGS } from '../models/types';
import type { PeriodPreset } from '../analysis/context';
import { createSyntheticDataset } from '../data/syntheticDataset';

export type CollectionKey = 'seizures' | 'observations' | 'menstrual' | 'medications' | 'medicationEvents' | 'history' | 'tasks';
export type RecordOf<K extends CollectionKey> = HealthData[K][number];
export type AnyRecord = SeizureEvent | DailyObservation | MenstrualRecord | Medication | MedicationEvent | HistoryRecord | CareTask;

export interface AppState {
  data: HealthData;
  settings: AnalysisSettings;
  period: PeriodPreset;
}

export type Action =
  | { type: 'upsert'; collection: CollectionKey; record: AnyRecord }
  | { type: 'delete'; collection: CollectionKey; id: string }
  | { type: 'replaceData'; data: HealthData }
  | { type: 'resetSynthetic' }
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
    case 'replaceData':
      return { ...state, data: action.data };
    case 'resetSynthetic':
      return { ...state, data: createSyntheticDataset() };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'setPeriod':
      return { ...state, period: action.period };
  }
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
