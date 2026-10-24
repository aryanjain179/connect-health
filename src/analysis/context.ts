/**
 * Shared, pre-computed context for one analysis run. Everything is sorted and keyed by date so results do not
 * depend on the order of input records.
 */
import type { DailyObservation, HealthData, ISODate, SeizureEvent } from '../models/types';
import type { ComparisonGroup, DateWindow } from '../models/analysis';
import { addDays, eachDay, inWindow, maxDate, minDate } from './dates';
import { mapCycleDays, type CycleDayInfo } from './cycle';

export interface AnalysisContext {
  window: DateWindow;
  days: ISODate[];
  calendarDays: number;
  obsByDate: Map<ISODate, DailyObservation>;
  /** Seizures in the window grouped by date (each list sorted by time, then id). */
  seizuresByDate: Map<ISODate, SeizureEvent[]>;
  seizuresInWindow: SeizureEvent[];
  /** Days in the window with a check-in. */
  observedDays: ISODate[];
  unobservedDays: ISODate[];
  cycle: Map<ISODate, CycleDayInfo>;
  missedDoseDates: Set<ISODate>;
  hasMenstrualRecords: boolean;
}

export function compareSeizures(a: SeizureEvent, b: SeizureEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.time ?? '99:99';
  const tb = b.time ?? '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildContext(data: HealthData, window: DateWindow): AnalysisContext {
  const days = eachDay(window.start, window.end);

  const obsByDate = new Map<ISODate, DailyObservation>();
  for (const o of data.observations) {
    if (!inWindow(o.date, window)) continue;
    const existing = obsByDate.get(o.date);
    // Duplicate dates are blocked by validation; if imported data contain them, keep the lowest id deterministically.
    if (!existing || o.id < existing.id) obsByDate.set(o.date, o);
  }

  const seizuresInWindow = data.seizures.filter((s) => inWindow(s.date, window)).sort(compareSeizures);
  const seizuresByDate = new Map<ISODate, SeizureEvent[]>();
  for (const s of seizuresInWindow) {
    const list = seizuresByDate.get(s.date) ?? [];
    list.push(s);
    seizuresByDate.set(s.date, list);
  }

  const observedDays = days.filter((d) => obsByDate.has(d));
  const unobservedDays = days.filter((d) => !obsByDate.has(d));

  return {
    window,
    days,
    calendarDays: days.length,
    obsByDate,
    seizuresByDate,
    seizuresInWindow,
    observedDays,
    unobservedDays,
    cycle: mapCycleDays(data.menstrual, days),
    missedDoseDates: new Set(data.medicationEvents.filter((e) => e.kind === 'missed-dose').map((e) => e.date)),
    hasMenstrualRecords: data.menstrual.length > 0,
  };
}

export function eventsOn(ctx: AnalysisContext, date: ISODate): number {
  return ctx.seizuresByDate.get(date)?.length ?? 0;
}

export function groupFor(ctx: AnalysisContext, label: string, days: ISODate[]): ComparisonGroup {
  let seizureDays = 0;
  let events = 0;
  for (const d of days) {
    const n = eventsOn(ctx, d);
    if (n > 0) seizureDays++;
    events += n;
  }
  const eligibleDays = days.length;
  return {
    label,
    eligibleDays,
    seizureDays,
    events,
    seizureDayRate: eligibleDays ? seizureDays / eligibleDays : null,
    eventRate: eligibleDays ? events / eligibleDays : null,
  };
}

export function eventsOnDays(ctx: AnalysisContext, days: ISODate[]): number {
  return days.reduce((n, d) => n + eventsOn(ctx, d), 0);
}

/** A missed dose was logged on the day or either of the two preceding days. */
export function missedDoseWithin48h(ctx: AnalysisContext, date: ISODate): boolean {
  return [0, 1, 2].some((k) => ctx.missedDoseDates.has(addDays(date, -k)));
}

/** Deterministic ordering for dated records (date, then id) so outputs never depend on input order. */
export function sortByDateId<T extends { date: ISODate; id: string }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** All dates that carry data, used to anchor period presets. */
export function dataDates(data: HealthData): ISODate[] {
  return [
    ...data.seizures.map((s) => s.date),
    ...data.observations.map((o) => o.date),
    ...data.menstrual.map((m) => m.periodStart),
    ...data.medicationEvents.map((e) => e.date),
  ];
}

export type PeriodPreset = '30' | '60' | '90' | 'all';

export function resolveWindow(data: HealthData, preset: PeriodPreset, fallbackEnd: ISODate): DateWindow {
  const dates = dataDates(data);
  const end = maxDate(dates) ?? fallbackEnd;
  if (preset === 'all') return { start: minDate(dates) ?? end, end };
  return { start: addDays(end, -(Number(preset) - 1)), end };
}
