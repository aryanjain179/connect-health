/** localStorage persistence with shape validation. */
import type { HealthData } from '../models/types';
import { DEFAULT_SETTINGS } from '../models/types';
import { isValidISODate } from '../analysis/dates';
import { initialState, type AppState } from './reducer';

export const STORAGE_KEY = 'healthconnect:data:v1';
const VERSION = 1;

interface Stored {
  version: number;
  savedAt: string;
  state: AppState;
}

const COLLECTIONS: Array<[keyof HealthData, string | null]> = [
  ['seizures', 'date'],
  ['observations', 'date'],
  ['menstrual', 'periodStart'],
  ['medications', 'startDate'],
  ['medicationEvents', 'date'],
  ['history', null],
  ['tasks', null],
];

/** Light structural validation used for both localStorage and JSON import. */
export function isHealthData(value: unknown): value is HealthData {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  const p = d.profile as Record<string, unknown> | undefined;
  if (!p || typeof p.displayName !== 'string' || typeof p.age !== 'number') return false;
  for (const [key, dateField] of COLLECTIONS) {
    const list = d[key];
    if (!Array.isArray(list)) return false;
    for (const r of list) {
      if (!r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string') return false;
      if (dateField && !isValidISODate((r as Record<string, unknown>)[dateField])) return false;
    }
  }
  return true;
}

export type LoadResult = { state: AppState; source: 'stored' | 'seed' | 'invalid' };

export function loadState(storage: Storage = localStorage): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: initialState(), source: 'seed' };
  }
  if (!raw) return { state: initialState(), source: 'seed' };
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.version !== VERSION || !isHealthData(parsed.state?.data)) return { state: initialState(), source: 'invalid' };
    return {
      state: {
        data: parsed.state.data,
        settings: { ...DEFAULT_SETTINGS, ...parsed.state.settings },
        period: ['30', '60', '90', 'all'].includes(parsed.state.period) ? parsed.state.period : '90',
      },
      source: 'stored',
    };
  } catch {
    return { state: initialState(), source: 'invalid' };
  }
}

export function saveState(state: AppState, storage: Storage = localStorage): void {
  const payload: Stored = { version: VERSION, savedAt: new Date().toISOString(), state };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable (e.g. private mode). The app keeps working in memory.
  }
}

export function exportJson(data: HealthData): string {
  return JSON.stringify({ format: 'healthconnect-export', version: VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseImport(text: string): HealthData {
  const parsed = JSON.parse(text) as { format?: string; data?: unknown };
  const data = parsed.format === 'healthconnect-export' ? parsed.data : parsed;
  if (!isHealthData(data)) throw new Error('File is not a valid HealthConnect export.');
  return data;
}
