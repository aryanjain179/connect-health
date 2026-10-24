/**
 * localStorage persistence with shape validation and v1 → v2 migration.
 * NOTE: localStorage is NOT secure storage for real protected health information. Prototype use only.
 */
import type { HealthData } from '../models/types';
import { DEFAULT_SETTINGS } from '../models/types';
import { isValidISODate } from '../analysis/dates';
import { initialRoot, initialState, normalizeData, type AppState, type RootState } from './reducer';

export const STORAGE_KEY = 'connecthealth:root:v2';
export const LEGACY_STORAGE_KEY = 'healthconnect:data:v1';
export const DRAFT_KEY = 'connecthealth:onboarding-draft';
const VERSION = 2;

const COLLECTIONS: Array<[keyof HealthData, string | null]> = [
  ['seizures', 'date'],
  ['observations', 'date'],
  ['menstrual', 'periodStart'],
  ['medications', 'startDate'],
  ['medicationEvents', 'date'],
  ['history', null],
  ['tasks', null],
];

/** Light structural validation used for localStorage and JSON import. New optional collections may be absent. */
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
  for (const key of ['journal', 'sharing', 'allergies'] as const) if (d[key] !== undefined && !Array.isArray(d[key])) return false;
  return true;
}

function normalizeApp(s: Partial<AppState> & { data: HealthData }): AppState {
  return {
    data: normalizeData(s.data),
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    period: s.period && ['30', '60', '90', 'all'].includes(s.period) ? s.period : '90',
  };
}

export type LoadResult = { root: RootState; source: 'stored' | 'migrated' | 'seed' | 'invalid' };

export function loadRoot(storage: Storage = localStorage): LoadResult {
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    legacy = storage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return { root: initialRoot(), source: 'seed' };
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { version: number; root: RootState };
      const r = parsed.root;
      if (parsed.version !== VERSION || !r || !isHealthData(r.profiles?.demo?.data)) throw new Error('bad');
      const user = r.profiles.user && isHealthData(r.profiles.user.data) ? normalizeApp(r.profiles.user) : null;
      const active = r.active === 'user' && !user ? null : r.active === 'demo' || r.active === 'user' ? r.active : null;
      return { root: { active, profiles: { demo: normalizeApp(r.profiles.demo), user } }, source: 'stored' };
    } catch {
      return { root: initialRoot(), source: 'invalid' };
    }
  }
  if (legacy) {
    // Migrate the v1 single-profile state into the demo profile so earlier edits are kept.
    try {
      const parsed = JSON.parse(legacy) as { version: number; state: AppState };
      if (parsed.version === 1 && isHealthData(parsed.state?.data)) {
        return { root: { active: null, profiles: { demo: normalizeApp(parsed.state), user: null } }, source: 'migrated' };
      }
    } catch {
      /* fall through */
    }
  }
  return { root: initialRoot(), source: 'seed' };
}

export function saveRoot(root: RootState, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, savedAt: new Date().toISOString(), root }));
  } catch {
    // Storage full or unavailable (e.g. private mode). The app keeps working in memory.
  }
}

export function exportJson(data: HealthData): string {
  return JSON.stringify({ format: 'connecthealth-export', version: VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseImport(text: string): HealthData {
  const parsed = JSON.parse(text) as { format?: string; data?: unknown };
  const data = parsed.format === 'connecthealth-export' || parsed.format === 'healthconnect-export' ? parsed.data : parsed;
  if (!isHealthData(data)) throw new Error('File is not a valid ConnectHealth export.');
  return normalizeData(data);
}

export { initialState };
