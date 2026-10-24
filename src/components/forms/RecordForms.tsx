/** Add / edit forms for every record type. Each form validates before saving. */
import { useState, type ReactNode } from 'react';
import type {
  CareTask,
  HistoryRecord,
  ISODate,
  Medication,
  MedicationEvent,
  MenstrualRecord,
  SeizureEvent,
} from '../../models/types';
import { ALLERGY_CATEGORY_LABELS, SEIZURE_TYPE_LABELS, type AllergyRecord } from '../../models/types';
import { allergyMatchesMedication, SEVERITY_LABELS } from '../../conditions/allergies';
import type { Errors } from '../../store/validation';
import {
  validateAllergy,
  validateHistory,
  validateMedication,
  validateMedicationEvent,
  validateMenstrual,
  validateSeizure,
  validateTask,
} from '../../store/validation';
import { cleanList, ListInput, NumberInput, SelectInput, TextArea, TextInput } from './fields';
import { Button, Notice } from '../ui';
import { AlertTriangle } from 'lucide-react';

export interface FormProps<T> {
  initial: T;
  maxDate: ISODate;
  onSave: (record: T) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Footer({ onCancel, onDelete, hasErrors }: { onCancel: () => void; onDelete?: () => void; hasErrors: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
      <div>
        {onDelete && (
          <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={onDelete}>
            Delete record
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasErrors && <span className="text-xs font-medium text-rose-700">Fix the highlighted fields.</span>}
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">
          Save
        </Button>
      </div>
    </div>
  );
}

function useForm<T>(initial: T, validate: (r: T) => Errors, onSave: (r: T) => void, clean: (r: T) => T = (r) => r) {
  const [draft, setDraft] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = clean(draft);
    const errs = validate(cleaned);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(cleaned);
  };
  return { draft, set, errors, submit };
}

// ---------------------------------------------------------------------------------------------------------------

export function SeizureForm({ initial, maxDate, onSave, onCancel, onDelete }: FormProps<SeizureEvent>) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateSeizure(r, maxDate), onSave, (r) => ({
    ...r,
    time: r.time?.trim() ? r.time : null,
    preSymptoms: cleanList(r.preSymptoms),
    postSymptoms: cleanList(r.postSymptoms),
  }));
  const prolonged = (draft.durationSeconds ?? 0) >= 300;
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set('date', v)} error={errors.date} />
        <TextInput label="Time (optional)" type="time" value={draft.time ?? ''} onChange={(v) => set('time', v || null)} error={errors.time} />
        <SelectInput
          label="Seizure type"
          value={draft.type}
          onChange={(v) => set('type', v)}
          options={Object.entries(SEIZURE_TYPE_LABELS).map(([value, label]) => ({ value: value as SeizureEvent['type'], label }))}
          error={errors.type}
          hint="Choose “Unknown / not sure” if unsure."
        />
        <SelectInput
          label="Severity"
          value={draft.severity ?? 'unknown'}
          onChange={(v) => set('severity', v === 'unknown' ? null : v)}
          options={[
            { value: 'unknown', label: 'Not recorded' },
            { value: 'mild', label: 'Mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'severe', label: 'Severe' },
          ]}
        />
        <NumberInput label="Duration (seconds)" value={draft.durationSeconds} onChange={(v) => set('durationSeconds', v)} error={errors.durationSeconds} step="1" min={1} />
        <NumberInput label="Recovery time (minutes)" value={draft.recoveryMinutes} onChange={(v) => set('recoveryMinutes', v)} error={errors.recoveryMinutes} step="1" min={0} />
        <ListInput label="Symptoms before" value={draft.preSymptoms} onChange={(v) => set('preSymptoms', v)} />
        <ListInput label="Symptoms after" value={draft.postSymptoms} onChange={(v) => set('postSymptoms', v)} />
      </Grid>
      {prolonged && (
        <div className="mt-4">
          <Notice tone="rose" icon={<AlertTriangle size={16} />}>
            A seizure lasting 5 minutes or longer is a medical emergency – follow the seizure action plan and call 911 if it happens. Please also tell the treating clinician about this event.
          </Notice>
        </div>
      )}
      <div className="mt-4">
        <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      </div>
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

export function MenstrualForm({ initial, maxDate, onSave, onCancel, onDelete, existing }: FormProps<MenstrualRecord> & { existing: MenstrualRecord[] }) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateMenstrual(r, existing, maxDate), onSave);
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <TextInput label="Period start" type="date" value={draft.periodStart} onChange={(v) => set('periodStart', v)} error={errors.periodStart} />
        <TextInput label="Period end (optional)" type="date" value={draft.periodEnd ?? ''} onChange={(v) => set('periodEnd', v || null)} error={errors.periodEnd} />
        <SelectInput
          label="Start date certainty"
          value={draft.startCertainty}
          onChange={(v) => set('startCertainty', v)}
          options={[
            { value: 'exact', label: 'Exact' },
            { value: 'approximate', label: 'Approximate' },
          ]}
        />
      </Grid>
      <div className="mt-4">
        <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      </div>
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

export function AllergyForm({ initial, maxDate, onSave, onCancel, onDelete, existing }: FormProps<AllergyRecord> & { existing: AllergyRecord[] }) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateAllergy(r, existing, maxDate), onSave, (r) => ({ ...r, substance: r.substance.trim(), reaction: r.reaction.trim() }));
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <TextInput label="Allergic to" value={draft.substance} onChange={(v) => set('substance', v)} error={errors.substance} placeholder="e.g. penicillin, peanuts, latex" />
        <SelectInput label="Type" value={draft.category} onChange={(v) => set('category', v)} options={(Object.keys(ALLERGY_CATEGORY_LABELS) as AllergyRecord['category'][]).map((c) => ({ value: c, label: ALLERGY_CATEGORY_LABELS[c] }))} />
        <TextInput label="Reaction (optional)" value={draft.reaction} onChange={(v) => set('reaction', v)} placeholder="e.g. hives, swelling, rash" />
        <SelectInput label="Severity" value={draft.severity} onChange={(v) => set('severity', v)} options={(Object.keys(SEVERITY_LABELS) as AllergyRecord['severity'][]).map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))} />
        <SelectInput
          label="Status"
          value={draft.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'patient-reported', label: 'Patient-reported' },
            { value: 'confirmed', label: 'Confirmed (clinician-documented)' },
            { value: 'suspected', label: 'Suspected' },
            { value: 'resolved', label: 'Resolved / outgrown' },
          ]}
        />
        <SelectInput
          label="Source"
          value={draft.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'patient-reported', label: 'Patient-reported' },
            { value: 'clinician-documented', label: 'Clinician-documented' },
            { value: 'external-record', label: 'External record' },
          ]}
        />
        <TextInput label="Date noted (optional)" type="date" value={draft.notedOn ?? ''} onChange={(v) => set('notedOn', v || null)} error={errors.notedOn} />
      </Grid>
      <div className="mt-4">
        <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      </div>
      {draft.severity === 'severe' && (
        <div className="mt-4">
          <Notice tone="rose" icon={<AlertTriangle size={16} />}>
            For severe reactions, make sure your clinicians and pharmacist know, and follow any emergency plan you have been given. In an emergency, call 911.
          </Notice>
        </div>
      )}
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

export function MedicationForm({ initial, maxDate, onSave, onCancel, onDelete, allergies = [] }: FormProps<Medication> & { allergies?: AllergyRecord[] }) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateMedication(r, maxDate), onSave);
  const allergyHits = allergyMatchesMedication(allergies, draft.name);
  return (
    <form onSubmit={submit} noValidate>
      <Notice tone="slate">Record medications as prescribed. ConnectHealth never suggests starting, stopping or changing a medication.</Notice>
      {allergyHits.length > 0 && (
        <div className="mt-3">
          <Notice tone="amber" icon={<AlertTriangle size={16} />}>
            You have recorded an allergy that may relate to this medication: {allergyHits.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join('; ')}. This is a simple name match, not a safety check – please confirm with your prescriber or pharmacist.
          </Notice>
        </div>
      )}
      <div className="mt-4">
        <Grid>
          <TextInput label="Medication name" value={draft.name} onChange={(v) => set('name', v)} error={errors.name} />
          <TextInput label="Indication / purpose" value={draft.indication} onChange={(v) => set('indication', v)} />
          <TextInput label="Prescribed dose" value={draft.initialDose} onChange={(v) => set('initialDose', v)} error={errors.initialDose} placeholder="e.g. 500 mg" />
          <TextInput label="Frequency" value={draft.frequency} onChange={(v) => set('frequency', v)} placeholder="e.g. twice daily" />
          <TextInput label="Start date" type="date" value={draft.startDate} onChange={(v) => set('startDate', v)} error={errors.startDate} />
          <TextInput label="End date (optional)" type="date" value={draft.endDate ?? ''} onChange={(v) => set('endDate', v || null)} error={errors.endDate} />
          <SelectInput
            label="Kind"
            value={draft.kind}
            onChange={(v) => set('kind', v)}
            options={[
              { value: 'prescription', label: 'Prescription' },
              { value: 'rescue', label: 'Rescue medication' },
              { value: 'otc-supplement', label: 'Over-the-counter / supplement' },
            ]}
          />
          <SelectInput
            label="Source"
            value={draft.source}
            onChange={(v) => set('source', v)}
            options={[
              { value: 'patient-reported', label: 'Patient-reported' },
              { value: 'clinician-documented', label: 'Clinician-documented' },
              { value: 'external-record', label: 'External record' },
            ]}
          />
        </Grid>
      </div>
      <div className="mt-4">
        <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      </div>
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

export function MedicationEventForm({ initial, maxDate, onSave, onCancel, onDelete, medications }: FormProps<MedicationEvent> & { medications: Medication[] }) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateMedicationEvent(r, medications, maxDate), onSave, (r) => ({ ...r, newDose: r.kind === 'dose-change' ? r.newDose : null }));
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <SelectInput
          label="Medication"
          value={draft.medicationId}
          onChange={(v) => set('medicationId', v)}
          options={[{ value: '', label: 'Choose…' }, ...medications.map((m) => ({ value: m.id, label: m.name }))]}
          error={errors.medicationId}
        />
        <SelectInput
          label="Event"
          value={draft.kind}
          onChange={(v) => set('kind', v)}
          options={[
            { value: 'dose-change', label: 'Prescribed dose change' },
            { value: 'missed-dose', label: 'Missed dose' },
            { value: 'side-effect', label: 'Side effect' },
          ]}
        />
        <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set('date', v)} error={errors.date} />
        {draft.kind === 'dose-change' && <TextInput label="New prescribed dose" value={draft.newDose ?? ''} onChange={(v) => set('newDose', v)} error={errors.newDose} placeholder="e.g. 750 mg" />}
        <SelectInput
          label="Source"
          value={draft.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'patient-reported', label: 'Patient-reported' },
            { value: 'clinician-documented', label: 'Clinician-documented' },
            { value: 'external-record', label: 'External record' },
          ]}
        />
      </Grid>
      <div className="mt-4">
        <TextArea label="Description" value={draft.description} onChange={(v) => set('description', v)} error={errors.description} />
      </div>
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

const TAG_SUGGESTIONS = 'attention, concentration, attention-childhood, snoring, witnessed-apnea, daytime-sleepiness, insomnia, mood, epilepsy, adhd, sleep-apnea, sleep-referral';

export function HistoryForm({ initial, maxDate, onSave, onCancel, onDelete }: FormProps<HistoryRecord>) {
  const { draft, set, errors, submit } = useForm(initial, (r) => validateHistory(r, maxDate), onSave, (r) => ({ ...r, tags: cleanList(r.tags).map((t) => t.toLowerCase()) }));
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <SelectInput
          label="Record kind"
          value={draft.kind}
          onChange={(v) => set('kind', v)}
          options={[
            { value: 'symptom', label: 'Patient-reported symptom' },
            { value: 'history', label: 'Medical history' },
            { value: 'diagnosis', label: 'Diagnosis' },
            { value: 'referral', label: 'Referral' },
          ]}
        />
        <SelectInput
          label="Status"
          value={draft.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'patient-reported', label: 'Patient-reported' },
            { value: 'confirmed', label: 'Confirmed (clinician-documented)' },
            { value: 'suspected', label: 'Suspected' },
            { value: 'pending', label: 'Pending' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'ruled-out', label: 'Ruled out' },
          ]}
          hint="Only mark “Confirmed” if a clinician has documented it."
        />
        <SelectInput
          label="Source"
          value={draft.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'patient-reported', label: 'Patient-reported' },
            { value: 'clinician-documented', label: 'Clinician-documented' },
            { value: 'external-record', label: 'External record' },
          ]}
        />
        <TextInput label="Date (optional)" type="date" value={draft.date ?? ''} onChange={(v) => set('date', v || null)} error={errors.date} />
      </Grid>
      <div className="mt-4 grid gap-4">
        <TextInput label="Description" value={draft.label} onChange={(v) => set('label', v)} error={errors.label} />
        <ListInput label="Tags (used to match clinical evidence)" value={draft.tags} onChange={(v) => set('tags', v)} hint={`Comma-separated, e.g. ${TAG_SUGGESTIONS}.`} />
        <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      </div>
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}

export function TaskForm({ initial, onSave, onCancel, onDelete, insightTitle }: FormProps<CareTask> & { insightTitle?: string }) {
  const { draft, set, errors, submit } = useForm(initial, validateTask, onSave);
  return (
    <form onSubmit={submit} noValidate>
      <Notice tone="slate">Tasks are personal reminders. ConnectHealth does not contact providers, order tests or make referrals – record contacts here only after you make them.</Notice>
      {insightTitle && <p className="mt-3 text-sm text-slate-600">Linked insight: <span className="font-medium text-slate-800">{insightTitle}</span></p>}
      <div className="mt-4 grid gap-4">
        <TextInput label="Title" value={draft.title} onChange={(v) => set('title', v)} error={errors.title} />
        <TextArea label="Reason" value={draft.reason} onChange={(v) => set('reason', v)} error={errors.reason} />
      </div>
      <div className="mt-4">
        <Grid>
          <SelectInput
            label="Kind"
            value={draft.kind}
            onChange={(v) => set('kind', v)}
            options={[
              { value: 'discuss-pattern', label: 'Discuss a pattern at an appointment' },
              { value: 'ask-assessment', label: 'Ask about further assessment' },
              { value: 'referral-follow-up', label: 'Follow up on a referral' },
              { value: 'record-appointment', label: 'Record an appointment date' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <SelectInput
            label="Status"
            value={draft.status}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'open', label: 'Not started' },
              { value: 'in-progress', label: 'Started' },
              { value: 'waiting', label: 'Waiting' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'done', label: 'Completed' },
            ]}
          />
          <TextInput label="Due date (optional)" type="date" value={draft.dueDate ?? ''} onChange={(v) => set('dueDate', v || null)} error={errors.dueDate} />
          <TextInput label="Appointment date (optional)" type="date" value={draft.appointmentDate ?? ''} onChange={(v) => set('appointmentDate', v || null)} error={errors.appointmentDate} />
          <TextInput label="Who you contacted (optional)" value={draft.contactedWho ?? ''} onChange={(v) => set('contactedWho', v)} placeholder="e.g. insurer member services" />
          <TextInput label="Date contacted (optional)" type="date" value={draft.contactedOn ?? ''} onChange={(v) => set('contactedOn', v || null)} />
          <TextInput label="Follow-up date (optional)" type="date" value={draft.followUpDate ?? ''} onChange={(v) => set('followUpDate', v || null)} />
        </Grid>
      </div>
      <div className="mt-4">
        <TextArea label="Notes (optional)" value={draft.notes ?? ''} onChange={(v) => set('notes', v)} />
      </div>
      {(draft.links?.length ?? 0) > 0 && <p className="mt-2 text-xs text-slate-500">Linked to: {draft.links!.map((l) => l.label).join('; ')}</p>}
      <Footer onCancel={onCancel} onDelete={onDelete} hasErrors={Object.keys(errors).length > 0} />
    </form>
  );
}
