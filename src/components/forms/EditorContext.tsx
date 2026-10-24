/**
 * Global record editor: any page can open an add/edit form for any record type.
 * Saving dispatches to the store, which persists and triggers recalculation everywhere.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CareTask, DailyObservation, HistoryRecord, ISODate, Medication, MedicationEvent, MenstrualRecord, SeizureEvent } from '../../models/types';
import { useHealthData } from '../../store/HealthDataContext';
import { newId, type AnyRecord, type CollectionKey } from '../../store/reducer';
import { dataDates } from '../../analysis/context';
import { localToday, maxDate } from '../../analysis/dates';
import { ConfirmDialog, Modal } from '../ui';
import { HistoryForm, MedicationEventForm, MedicationForm, MenstrualForm, ObservationForm, SeizureForm, TaskForm } from './RecordForms';

export type EditorKind = 'seizure' | 'observation' | 'menstrual' | 'medication' | 'medicationEvent' | 'history' | 'task';

interface EditorRequest {
  kind: EditorKind;
  /** Existing record to edit; omit to create. */
  record?: AnyRecord;
  /** Defaults for a new record. */
  defaults?: Record<string, unknown>;
  /** For tasks created from an insight. */
  insightTitle?: string;
}

const COLLECTION: Record<EditorKind, CollectionKey> = {
  seizure: 'seizures',
  observation: 'observations',
  menstrual: 'menstrual',
  medication: 'medications',
  medicationEvent: 'medicationEvents',
  history: 'history',
  task: 'tasks',
};

const TITLES: Record<EditorKind, string> = {
  seizure: 'seizure event',
  observation: 'daily check-in',
  menstrual: 'period record',
  medication: 'medication',
  medicationEvent: 'medication event',
  history: 'symptom / history record',
  task: 'care task',
};

interface EditorCtx {
  openEditor: (req: EditorRequest) => void;
  requestDelete: (kind: EditorKind, id: string, label: string) => void;
}

const Ctx = createContext<EditorCtx | null>(null);

export function blankRecord(kind: EditorKind, date: ISODate): AnyRecord {
  switch (kind) {
    case 'seizure':
      return { id: newId('sz'), date, time: null, type: 'unknown', durationSeconds: null, severity: null, preSymptoms: [], postSymptoms: [], recoveryMinutes: null, notes: '', isSynthetic: false } satisfies SeizureEvent;
    case 'observation':
      return { id: newId('obs'), date, sleepHours: null, sleepQuality: null, stressLevel: null, illness: null, headache: null, dizziness: null, attentionDifficulty: null, otherSymptoms: [], notes: '', isSynthetic: false } satisfies DailyObservation;
    case 'menstrual':
      return { id: newId('cyc'), periodStart: date, periodEnd: null, startCertainty: 'exact', notes: '', isSynthetic: false } satisfies MenstrualRecord;
    case 'medication':
      return { id: newId('med'), name: '', indication: '', kind: 'prescription', startDate: date, endDate: null, initialDose: '', frequency: '', source: 'patient-reported', notes: '', isSynthetic: false } satisfies Medication;
    case 'medicationEvent':
      return { id: newId('mev'), medicationId: '', date, kind: 'missed-dose', newDose: null, description: '', source: 'patient-reported', isSynthetic: false } satisfies MedicationEvent;
    case 'history':
      return { id: newId('hx'), kind: 'symptom', label: '', status: 'patient-reported', source: 'patient-reported', date, tags: [], notes: '', isSynthetic: false } satisfies HistoryRecord;
    case 'task':
      return { id: newId('task'), title: '', reason: '', kind: 'discuss-pattern', insightId: null, dueDate: null, appointmentDate: null, status: 'open', createdOn: date, isSynthetic: false } satisfies CareTask;
  }
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useHealthData();
  const [req, setReq] = useState<EditorRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: EditorKind; id: string; label: string } | null>(null);

  // Allow entries up to today, or the latest data date if the device clock is earlier than the synthetic data.
  const maxEntry = maxDate([localToday(), ...dataDates(state.data)]) ?? localToday();

  const openEditor = useCallback((r: EditorRequest) => setReq(r), []);
  const requestDelete = useCallback((kind: EditorKind, id: string, label: string) => setPendingDelete({ kind, id, label }), []);
  const close = () => setReq(null);

  const save = (record: AnyRecord) => {
    if (!req) return;
    dispatch({ type: 'upsert', collection: COLLECTION[req.kind], record });
    close();
  };

  let form: ReactNode = null;
  if (req) {
    const list = state.data[COLLECTION[req.kind]] as AnyRecord[];
    const existing = req.record ? list.find((r) => r.id === req.record!.id) ?? req.record : null;
    const initial = existing ?? { ...blankRecord(req.kind, localToday() > maxEntry ? maxEntry : localToday()), ...(req.defaults ?? {}) };
    const onDelete = existing ? () => setPendingDelete({ kind: req.kind, id: existing.id, label: TITLES[req.kind] }) : undefined;
    const common = { maxDate: maxEntry, onSave: save, onCancel: close, onDelete };
    switch (req.kind) {
      case 'seizure':
        form = <SeizureForm initial={initial as SeizureEvent} {...common} />;
        break;
      case 'observation':
        form = <ObservationForm initial={initial as DailyObservation} existing={state.data.observations} {...common} />;
        break;
      case 'menstrual':
        form = <MenstrualForm initial={initial as MenstrualRecord} existing={state.data.menstrual} {...common} />;
        break;
      case 'medication':
        form = <MedicationForm initial={initial as Medication} {...common} />;
        break;
      case 'medicationEvent':
        form = <MedicationEventForm initial={initial as MedicationEvent} medications={state.data.medications} {...common} />;
        break;
      case 'history':
        form = <HistoryForm initial={initial as HistoryRecord} {...common} />;
        break;
      case 'task':
        form = <TaskForm initial={initial as CareTask} insightTitle={req.insightTitle} {...common} />;
        break;
    }
  }

  const value = useMemo(() => ({ openEditor, requestDelete }), [openEditor, requestDelete]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={!!req} title={req ? `${req.record ? 'Edit' : 'Add'} ${TITLES[req.kind]}` : ''} onClose={close} wide>
        {/* key forces a fresh form state per request */}
        <div key={req ? `${req.kind}-${req.record?.id ?? 'new'}` : 'none'}>{form}</div>
      </Modal>
      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.label ?? 'record'}?`}
        message={
          <>
            This permanently removes the record from this browser. Patterns, connections and the summary will be recalculated.
            {pendingDelete?.kind === 'medication' && ' Dose changes, missed doses and side effects linked to this medication are also removed.'}
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) dispatch({ type: 'delete', collection: COLLECTION[pendingDelete.kind], id: pendingDelete.id });
          setPendingDelete(null);
          close();
        }}
      />
    </Ctx.Provider>
  );
}

export function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEditor must be used inside EditorProvider');
  return c;
}
