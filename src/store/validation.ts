/** Input validation for user-entered records. Returns a map of field → message; empty map = valid. */
import type {
  CareTask,
  DailyObservation,
  HistoryRecord,
  ISODate,
  Medication,
  MedicationEvent,
  MenstrualRecord,
  SeizureEvent,
} from '../models/types';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { diffDays, isValidISODate } from '../analysis/dates';

export type Errors = Record<string, string>;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkDate(errors: Errors, field: string, value: ISODate | null | undefined, today: ISODate, required = true) {
  if (value === null || value === undefined || value === '') {
    if (required) errors[field] = 'Date is required.';
    return;
  }
  if (!isValidISODate(value)) errors[field] = 'Enter a valid date (YYYY-MM-DD).';
  else if (value > today) errors[field] = 'Date cannot be in the future.';
}

function checkRange(errors: Errors, field: string, value: number | null, min: number, max: number, integer = false) {
  if (value === null) return;
  if (!Number.isFinite(value)) errors[field] = 'Enter a number.';
  else if (value < min || value > max) errors[field] = `Must be between ${min} and ${max}.`;
  else if (integer && !Number.isInteger(value)) errors[field] = 'Must be a whole number.';
}

export function validateSeizure(s: SeizureEvent, today: ISODate): Errors {
  const e: Errors = {};
  checkDate(e, 'date', s.date, today);
  if (s.time && !TIME_RE.test(s.time)) e.time = 'Use 24-hour HH:MM.';
  if (!(s.type in SEIZURE_TYPE_LABELS)) e.type = 'Choose a seizure type (or “Unknown”).';
  checkRange(e, 'durationSeconds', s.durationSeconds, 1, 86_400, true);
  checkRange(e, 'recoveryMinutes', s.recoveryMinutes, 0, 10_080, true);
  return e;
}

export function validateObservation(o: DailyObservation, existing: DailyObservation[], today: ISODate): Errors {
  const e: Errors = {};
  checkDate(e, 'date', o.date, today);
  if (!e.date && existing.some((x) => x.date === o.date && x.id !== o.id)) e.date = 'A check-in already exists for this date – edit that one instead.';
  checkRange(e, 'sleepHours', o.sleepHours, 0, 24);
  checkRange(e, 'sleepQuality', o.sleepQuality, 1, 5, true);
  checkRange(e, 'stressLevel', o.stressLevel, 0, 10, true);
  return e;
}

export function validateMenstrual(m: MenstrualRecord, existing: MenstrualRecord[], today: ISODate): Errors {
  const e: Errors = {};
  checkDate(e, 'periodStart', m.periodStart, today);
  if (!e.periodStart && existing.some((x) => x.periodStart === m.periodStart && x.id !== m.id)) e.periodStart = 'A period starting on this date is already recorded.';
  if (m.periodEnd) {
    checkDate(e, 'periodEnd', m.periodEnd, today);
    if (!e.periodEnd && !e.periodStart) {
      const len = diffDays(m.periodStart, m.periodEnd);
      if (len < 0) e.periodEnd = 'End date must be on or after the start date.';
      else if (len > 14) e.periodEnd = 'Bleeding longer than 15 days – please check the dates.';
    }
  }
  return e;
}

export function validateMedication(m: Medication, today: ISODate): Errors {
  const e: Errors = {};
  if (!m.name.trim()) e.name = 'Medication name is required.';
  if (!m.initialDose.trim()) e.initialDose = 'Dose is required (e.g. “500 mg”).';
  checkDate(e, 'startDate', m.startDate, today);
  if (m.endDate) {
    checkDate(e, 'endDate', m.endDate, today);
    if (!e.endDate && !e.startDate && m.endDate < m.startDate) e.endDate = 'End date must be on or after the start date.';
  }
  return e;
}

export function validateMedicationEvent(ev: MedicationEvent, meds: Medication[], today: ISODate): Errors {
  const e: Errors = {};
  const med = meds.find((m) => m.id === ev.medicationId);
  if (!med) e.medicationId = 'Choose a medication.';
  checkDate(e, 'date', ev.date, today);
  if (!e.date && med && ev.date < med.startDate) e.date = `Date is before ${med.name} was started (${med.startDate}).`;
  if (ev.kind === 'dose-change' && !ev.newDose?.trim()) e.newDose = 'Enter the new prescribed dose.';
  if (ev.kind === 'side-effect' && !ev.description.trim()) e.description = 'Describe the side effect.';
  return e;
}

export function validateHistory(h: HistoryRecord, today: ISODate): Errors {
  const e: Errors = {};
  if (!h.label.trim()) e.label = 'Description is required.';
  checkDate(e, 'date', h.date, today, false);
  return e;
}

export function validateTask(t: CareTask): Errors {
  const e: Errors = {};
  if (!t.title.trim()) e.title = 'Title is required.';
  if (!t.reason.trim()) e.reason = 'Reason is required.';
  if (t.dueDate && !isValidISODate(t.dueDate)) e.dueDate = 'Enter a valid date.';
  if (t.appointmentDate && !isValidISODate(t.appointmentDate)) e.appointmentDate = 'Enter a valid date.';
  return e;
}
