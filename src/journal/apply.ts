/**
 * Turn APPROVED proposals into reducer actions, and build the undo information stored on the journal entry.
 * Unapproved proposals are never written.
 */
import type { DailyObservation, HealthData, JournalEntry, MedicationEvent, MenstrualRecord, SeizureEvent } from '../models/types';
import type { Action } from '../store/reducer';
import type { Proposal } from './extract';
import { BLEEDING_KEY, reconcileBleeding } from '../conditions/menstrualBleeding';

export interface ApplyOptions {
  transcript: string;
  saveTranscript: boolean;
  source: 'speech' | 'typed';
  now: string;
  today: string;
  newId: (prefix: string) => string;
  rejectedCount: number;
}

type ObsField = 'sleepHours' | 'stressLevel' | 'headache' | 'dizziness' | 'illness' | 'attentionDifficulty' | 'otherSymptoms' | 'notes' | 'measures';

export function applyProposals(approved: Proposal[], data: HealthData, o: ApplyOptions): { actions: Action[]; entry: JournalEntry; skipped: string[] } {
  const actions: Action[] = [];
  const skipped: string[] = [];
  const entry: JournalEntry = {
    id: o.newId('journal'),
    createdAt: o.now,
    date: o.today,
    transcript: o.saveTranscript ? o.transcript : null,
    source: o.source,
    createdRecords: [],
    updatedFields: [],
    approvedCount: 0,
    rejectedCount: o.rejectedCount,
  };

  // Menstrual records as they evolve while proposals are applied (several bleeding days in one entry).
  let menstrual: MenstrualRecord[] = data.menstrual;

  // Group observation-field proposals by date.
  const byDate = new Map<string, Partial<Pick<DailyObservation, ObsField>>>();
  const patch = (date: string) => byDate.get(date) ?? (byDate.set(date, {}), byDate.get(date)!);
  for (const p of approved) {
    switch (p.kind) {
      case 'sleepHours':
        if (typeof p.value === 'number') patch(p.date).sleepHours = p.value;
        else skipped.push(`${p.label}: no value entered`);
        break;
      case 'stress': {
        const ps = patch(p.date);
        if (typeof p.value === 'number') ps.stressLevel = p.value;
        if (p.note) ps.otherSymptoms = [...(ps.otherSymptoms ?? []), p.note.startsWith('described') ? `stress/anxiety (${p.note})` : p.note];
        break;
      }
      case 'headache':
      case 'dizziness':
      case 'illness':
      case 'attentionDifficulty':
        patch(p.date)[p.kind] = p.value === true;
        if (p.note && p.value === true) {
          const ps = patch(p.date);
          ps.notes = [ps.notes, `${p.label}: ${p.note}`].filter(Boolean).join('; ');
        }
        break;
      case 'otherSymptom':
        if (typeof p.value === 'string' && p.value.trim()) patch(p.date).otherSymptoms = [...(patch(p.date).otherSymptoms ?? []), p.value.trim()];
        break;
      case 'seizure': {
        const s: SeizureEvent = {
          id: o.newId('sz'),
          date: p.date,
          time: p.seizureTime,
          type: 'unknown',
          durationSeconds: p.seizureDurationSeconds,
          severity: null,
          preSymptoms: [],
          postSymptoms: [],
          recoveryMinutes: null,
          notes: `From voice journal: “${p.evidence}”`,
          isSynthetic: false,
        };
        actions.push({ type: 'upsert', collection: 'seizures', record: s });
        entry.createdRecords.push({ collection: 'seizures', id: s.id });
        break;
      }
      case 'missedDose':
      case 'sideEffect': {
        if (!p.medicationId || !data.medications.some((m) => m.id === p.medicationId)) {
          skipped.push(`${p.label}: no medication selected`);
          break;
        }
        const e: MedicationEvent = {
          id: o.newId('mev'),
          medicationId: p.medicationId,
          date: p.date,
          kind: p.kind === 'missedDose' ? 'missed-dose' : 'side-effect',
          newDose: null,
          description: p.kind === 'missedDose' ? `Missed ${p.note || 'dose'} (voice journal).` : String(p.value ?? p.evidence),
          source: 'patient-reported',
          isSynthetic: false,
        };
        actions.push({ type: 'upsert', collection: 'medicationEvents', record: e });
        entry.createdRecords.push({ collection: 'medicationEvents', id: e.id });
        break;
      }
      case 'menstrualBleeding': {
        if (typeof p.value !== 'boolean') break;
        const ps = patch(p.date);
        ps.measures = { ...(ps.measures ?? {}), [BLEEDING_KEY]: p.value };
        const changes = reconcileBleeding(menstrual, p.date, p.value, () => o.newId('cyc'));
        actions.push(...changes.actions);
        for (const id of changes.createdIds) entry.createdRecords.push({ collection: 'menstrual', id });
        entry.previousMenstrual = [...(entry.previousMenstrual ?? []), ...changes.previous.filter((r) => !entry.previousMenstrual?.some((x) => x.id === r.id))];
        menstrual = applyMenstrual(menstrual, changes.actions);
        break;
      }
    }
  }

  for (const [date, fields] of byDate) {
    if (!Object.keys(fields).length) continue;
    const existing = data.observations.find((x) => x.date === date);
    if (existing) {
      const merged: Partial<DailyObservation> = { ...fields };
      if (fields.otherSymptoms) merged.otherSymptoms = [...new Set([...existing.otherSymptoms, ...fields.otherSymptoms])];
      if (fields.notes) merged.notes = [existing.notes, fields.notes].filter(Boolean).join('; ');
      if (fields.measures) merged.measures = { ...(existing.measures ?? {}), ...fields.measures };
      for (const k of Object.keys(merged) as ObsField[]) entry.updatedFields.push({ observationId: existing.id, field: k, previous: existing[k] });
      actions.push({ type: 'patchObservation', id: existing.id, patch: merged });
    } else {
      const obs: DailyObservation = {
        id: o.newId('obs'),
        date,
        sleepHours: null,
        sleepQuality: null,
        stressLevel: null,
        illness: null,
        headache: null,
        dizziness: null,
        attentionDifficulty: null,
        otherSymptoms: [],
        notes: 'Created from voice journal.',
        isSynthetic: false,
        ...fields,
      };
      if (fields.notes) obs.notes = `Created from voice journal. ${fields.notes}`;
      actions.push({ type: 'upsert', collection: 'observations', record: obs });
      entry.createdRecords.push({ collection: 'observations', id: obs.id });
    }
  }

  entry.approvedCount = approved.length - skipped.length;
  actions.push({ type: 'upsert', collection: 'journal', record: entry });
  return { actions, entry, skipped };
}

function applyMenstrual(records: MenstrualRecord[], actions: Action[]): MenstrualRecord[] {
  let out = records;
  for (const a of actions) {
    if (a.type === 'upsert' && a.collection === 'menstrual') {
      const r = a.record as MenstrualRecord;
      out = out.some((x) => x.id === r.id) ? out.map((x) => (x.id === r.id ? r : x)) : [...out, r];
    } else if (a.type === 'delete' && a.collection === 'menstrual') out = out.filter((x) => x.id !== a.id);
  }
  return out;
}

/** Delete a journal entry; optionally also remove the records it created and restore fields it changed. */
export function undoJournal(entry: JournalEntry, data: HealthData, removeRecords: boolean): Action[] {
  const actions: Action[] = [];
  if (removeRecords) {
    for (const r of entry.createdRecords) actions.push({ type: 'delete', collection: r.collection, id: r.id });
    const byObs = new Map<string, Record<string, unknown>>();
    for (const u of entry.updatedFields) {
      if (!data.observations.some((x) => x.id === u.observationId)) continue;
      byObs.set(u.observationId, { ...(byObs.get(u.observationId) ?? {}), [u.field]: u.previous });
    }
    for (const [id, p] of byObs) actions.push({ type: 'patchObservation', id, patch: p as Partial<DailyObservation> });
    // Restore period records that bleeding answers extended, trimmed or removed.
    for (const r of entry.previousMenstrual ?? []) actions.push({ type: 'upsert', collection: 'menstrual', record: r });
  }
  actions.push({ type: 'delete', collection: 'journal', id: entry.id });
  return actions;
}
