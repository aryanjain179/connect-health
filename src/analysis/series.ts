/** Day-by-day aligned series used by the timeline and charts (pure, descriptive). */
import type { DateWindow } from '../models/analysis';
import type { DailyObservation, HealthData, ISODate, MedicationEvent, OutcomeKey, SeizureEvent } from '../models/types';
import { buildContext } from './context';
import { MEASURE_BY_ID } from '../conditions/checkin';
import type { CycleDayInfo } from './cycle';
import { diffDays } from './dates';

export interface MedicationMarker {
  date: ISODate;
  label: string;
  kind: 'start' | 'stop' | 'dose-change' | 'missed-dose' | 'side-effect';
  medicationId: string;
  eventId: string | null;
}

export interface DayPoint {
  date: ISODate;
  checkIn: DailyObservation | null;
  sleepHours: number | null;
  /** 7-day mean of recorded nights; null when fewer than 4 recorded nights in the 7-day span. */
  sleepRolling: number | null;
  stressLevel: number | null;
  seizures: SeizureEvent[];
  cycle: CycleDayInfo | null;
  meds: MedicationMarker[];
  symptoms: string[];
}

export function medicationMarkers(data: HealthData, window: DateWindow): MedicationMarker[] {
  const out: MedicationMarker[] = [];
  const name = (id: string) => data.medications.find((m) => m.id === id)?.name ?? 'Medication';
  for (const m of data.medications) {
    if (m.startDate >= window.start && m.startDate <= window.end) out.push({ date: m.startDate, label: `${m.name} started (${m.initialDose})`, kind: 'start', medicationId: m.id, eventId: null });
    if (m.endDate && m.endDate >= window.start && m.endDate <= window.end) out.push({ date: m.endDate, label: `${m.name} stopped`, kind: 'stop', medicationId: m.id, eventId: null });
  }
  for (const e of data.medicationEvents as MedicationEvent[]) {
    if (e.date < window.start || e.date > window.end) continue;
    const label =
      e.kind === 'dose-change' ? `${name(e.medicationId)} dose → ${e.newDose ?? '?'}` : e.kind === 'missed-dose' ? `${name(e.medicationId)} missed dose` : `${name(e.medicationId)} side effect: ${e.description}`;
    out.push({ date: e.date, label, kind: e.kind, medicationId: e.medicationId, eventId: e.id });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.label < b.label ? -1 : 1));
}

export function symptomsOf(o: DailyObservation | null): string[] {
  if (!o) return [];
  const s: string[] = [];
  if (o.headache) s.push('headache');
  if (o.dizziness) s.push('dizziness');
  if (o.illness) s.push('illness');
  if (o.attentionDifficulty) s.push('attention difficulty');
  for (const [id, v] of Object.entries(o.measures ?? {})) {
    const def = MEASURE_BY_ID.get(id);
    if (v === true && def?.noun) s.push(def.noun);
    else if (typeof v === 'number' && def) s.push(`${def.label.replace(/\s*\(.*\)$/, '').toLowerCase()} ${v}`);
  }
  return [...s, ...o.otherSymptoms];
}

export function buildDailySeries(data: HealthData, window: DateWindow, outcome: OutcomeKey = 'seizures'): DayPoint[] {
  const ctx = buildContext(data, window, outcome);
  const meds = medicationMarkers(data, window);
  const points: DayPoint[] = ctx.days.map((date) => {
    const o = ctx.obsByDate.get(date) ?? null;
    return {
      date,
      checkIn: o,
      sleepHours: o?.sleepHours ?? null,
      sleepRolling: null,
      stressLevel: o?.stressLevel ?? null,
      seizures: ctx.seizuresByDate.get(date) ?? [],
      cycle: ctx.cycle.get(date) ?? null,
      meds: meds.filter((m) => m.date === date),
      symptoms: symptomsOf(o),
    };
  });
  for (let i = 0; i < points.length; i++) {
    const span = points.slice(Math.max(0, i - 6), i + 1).filter((p) => diffDays(p.date, points[i].date) <= 6);
    const vals = span.map((p) => p.sleepHours).filter((v): v is number => v !== null);
    points[i].sleepRolling = vals.length >= 4 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }
  return points;
}
