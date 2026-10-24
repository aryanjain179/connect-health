/** Data-completeness and descriptive seizure statistics. */
import type { DailyObservation, HealthData, ISODate, SeizureEvent, SeizureType } from '../models/types';
import type { DateWindow } from '../models/analysis';
import { buildContext, compareSeizures } from './context';

export const OBSERVATION_FIELDS = [
  { key: 'sleepHours', label: 'Sleep duration' },
  { key: 'sleepQuality', label: 'Sleep quality' },
  { key: 'stressLevel', label: 'Stress level' },
  { key: 'illness', label: 'Illness' },
  { key: 'headache', label: 'Headache' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'attentionDifficulty', label: 'Attention / concentration' },
] as const satisfies ReadonlyArray<{ key: keyof DailyObservation; label: string }>;

export type ObservationFieldKey = (typeof OBSERVATION_FIELDS)[number]['key'];

/** Share (0–1) of the 7 core fields that are recorded in an observation. */
export function observationCompleteness(o: DailyObservation): number {
  const recorded = OBSERVATION_FIELDS.filter((f) => o[f.key] !== null && o[f.key] !== undefined).length;
  return recorded / OBSERVATION_FIELDS.length;
}

export interface FieldCompleteness {
  key: ObservationFieldKey;
  label: string;
  recordedDays: number;
  calendarDays: number;
}

export interface CompletenessReport {
  window: DateWindow;
  calendarDays: number;
  checkInDays: number;
  missingDays: ISODate[];
  partialCheckIns: number;
  fields: FieldCompleteness[];
}

export function computeCompleteness(data: HealthData, window: DateWindow): CompletenessReport {
  const ctx = buildContext(data, window);
  const obs = [...ctx.obsByDate.values()];
  return {
    window,
    calendarDays: ctx.calendarDays,
    checkInDays: ctx.observedDays.length,
    missingDays: ctx.unobservedDays,
    partialCheckIns: obs.filter((o) => observationCompleteness(o) < 1).length,
    fields: OBSERVATION_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      recordedDays: obs.filter((o) => o[f.key] !== null && o[f.key] !== undefined).length,
      calendarDays: ctx.calendarDays,
    })),
  };
}

export interface SeizureSummary {
  window: DateWindow;
  totalEvents: number;
  seizureDays: number;
  eventsOnObservedDays: number;
  eventsOnDaysWithoutCheckIn: number;
  observedDays: number;
  /** Events per 30 observed days (null when no observed days). */
  eventsPer30ObservedDays: number | null;
  byType: Array<{ type: SeizureType; count: number }>;
  mostRecentInWindow: SeizureEvent | null;
  mostRecentOverall: SeizureEvent | null;
  longestDurationSeconds: number | null;
  prolonged: SeizureEvent[];
}

export const PROLONGED_SECONDS = 300;

export interface SleepSummary {
  recordedNights: number;
  meanHours: number | null;
  nightsBelow: number;
  threshold: number;
}

/** Mean of recorded nights only – missing nights are never treated as 0 h. */
export function summarizeSleep(data: HealthData, window: DateWindow, threshold: number): SleepSummary {
  const ctx = buildContext(data, window);
  const hours = [...ctx.obsByDate.values()].map((o) => o.sleepHours).filter((h): h is number => h !== null);
  return {
    recordedNights: hours.length,
    meanHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    nightsBelow: hours.filter((h) => h < threshold).length,
    threshold,
  };
}

export function summarizeSeizures(data: HealthData, window: DateWindow): SeizureSummary {
  const ctx = buildContext(data, window);
  const inWin = ctx.seizuresInWindow;
  const observed = new Set(ctx.observedDays);
  const onObserved = inWin.filter((s) => observed.has(s.date)).length;
  const counts = new Map<SeizureType, number>();
  for (const s of inWin) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  const all = [...data.seizures].sort(compareSeizures);
  const durations = inWin.map((s) => s.durationSeconds).filter((d): d is number => d !== null);
  return {
    window,
    totalEvents: inWin.length,
    seizureDays: ctx.seizuresByDate.size,
    eventsOnObservedDays: onObserved,
    eventsOnDaysWithoutCheckIn: inWin.length - onObserved,
    observedDays: ctx.observedDays.length,
    eventsPer30ObservedDays: ctx.observedDays.length ? (onObserved / ctx.observedDays.length) * 30 : null,
    byType: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1)),
    mostRecentInWindow: inWin.length ? inWin[inWin.length - 1] : null,
    mostRecentOverall: all.length ? all[all.length - 1] : null,
    longestDurationSeconds: durations.length ? Math.max(...durations) : null,
    prolonged: inWin.filter((s) => (s.durationSeconds ?? 0) >= PROLONGED_SECONDS),
  };
}
