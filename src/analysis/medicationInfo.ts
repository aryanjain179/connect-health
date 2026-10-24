/** Descriptive medication helpers (no analysis, no recommendations). */
import type { HealthData, ISODate, Medication, MedicationEvent } from '../models/types';

export function isActiveOn(m: Medication, date: ISODate): boolean {
  return m.startDate <= date && (m.endDate === null || m.endDate >= date);
}

/** Dose in effect on `date`: latest dose-change on or before the date, else the initial dose. */
export function doseOn(m: Medication, events: MedicationEvent[], date: ISODate): string {
  const changes = events
    .filter((e) => e.medicationId === m.id && e.kind === 'dose-change' && e.date <= date && e.newDose)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  return changes.length ? changes[changes.length - 1].newDose! : m.initialDose;
}

export function currentMedications(data: HealthData, asOf: ISODate): Medication[] {
  return data.medications.filter((m) => isActiveOn(m, asOf)).sort((a, b) => a.name.localeCompare(b.name));
}

export function pastMedications(data: HealthData, asOf: ISODate): Medication[] {
  return data.medications.filter((m) => !isActiveOn(m, asOf)).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}
