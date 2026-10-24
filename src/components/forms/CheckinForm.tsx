/**
 * Daily check-in. Core questions for everyone, plus questions driven by the person's conditions:
 * the seizure log (epilepsy only), condition symptoms/measures, and "menstrual bleeding" when cycle tracking is on.
 */
import { useState } from 'react';
import { AlertTriangle, Mic, Plus, Trash2 } from 'lucide-react';
import type { DailyObservation, HealthData, ISODate, SeizureEvent } from '../../models/types';
import { SEIZURE_TYPE_LABELS } from '../../models/types';
import { validateObservation, validateSeizure, type Errors } from '../../store/validation';
import { checkinPlan, validateMeasures } from '../../conditions/checkin';
import { BLEEDING_KEY, periodCovering } from '../../conditions/menstrualBleeding';
import { observationCompleteness } from '../../analysis/completeness';
import { duration } from '../../analysis/format';
import { cleanList, ListInput, NumberInput, SelectInput, TextArea, TextInput, TriState } from './fields';
import { Button, Notice, cx } from '../ui';

export interface CheckinBundle {
  /** null when only events were logged and no check-in question was answered. */
  observation: DailyObservation | null;
  seizures: SeizureEvent[];
  /** Menstrual bleeding answer for the day (also stored on the observation); null = not recorded. */
  bleeding: boolean | null;
}

interface Props {
  initial: DailyObservation;
  isNew: boolean;
  data: HealthData;
  maxDate: ISODate;
  startWithSeizure?: boolean;
  newSeizureId: () => string;
  onSave: (b: CheckinBundle) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function blankSeizure(id: string, date: ISODate): SeizureEvent {
  return { id, date, time: null, type: 'unknown', durationSeconds: null, severity: null, preSymptoms: [], postSymptoms: [], recoveryMinutes: null, notes: '', isSynthetic: false };
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">{title}</legend>
      {sub && <p className="mb-3 text-xs text-slate-500">{sub}</p>}
      {children}
    </fieldset>
  );
}

export function CheckinForm({ initial, isNew, data, maxDate, startWithSeizure, newSeizureId, onSave, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<DailyObservation>({ ...initial, measures: { ...(initial.measures ?? {}) } });
  const [showAll, setShowAll] = useState(false);
  const plan = checkinPlan(data, initial, showAll);
  const [newSeizures, setNewSeizures] = useState<SeizureEvent[]>(() => (startWithSeizure && plan.seizures ? [blankSeizure(newSeizureId(), initial.date)] : []));
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof DailyObservation>(key: K, value: DailyObservation[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setMeasure = (id: string, value: number | boolean | null) => setDraft((d) => ({ ...d, measures: { ...(d.measures ?? {}), [id]: value } }));
  const existingSeizures = data.seizures.filter((s) => s.date === draft.date).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  const bleeding = (draft.measures?.[BLEEDING_KEY] ?? null) as boolean | null;
  const coveringPeriod = periodCovering(data.menstrual, draft.date);
  const updateSeizure = (id: string, patch: Partial<SeizureEvent>) => setNewSeizures((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const measures = Object.fromEntries(Object.entries(draft.measures ?? {}).filter(([, v]) => v !== null && v !== undefined));
    const obs: DailyObservation = { ...draft, otherSymptoms: cleanList(draft.otherSymptoms), measures };
    const errs: Errors = { ...validateObservation(obs, data.observations, maxDate), ...validateMeasures(obs.measures) };
    newSeizures.forEach((s, i) => {
      for (const [k, v] of Object.entries(validateSeizure({ ...s, date: obs.date }, maxDate))) if (k !== 'date') errs[`sz-${i}-${k}`] = v;
    });
    const answered = observationCompleteness(obs) > 0 || obs.otherSymptoms.length > 0 || Object.keys(measures).length > 0 || obs.notes.trim().length > 0;
    if (!answered && !newSeizures.length && isNew) errs.form = 'Answer at least one question or log a seizure.';
    // Logging only a seizure does not create an otherwise empty check-in (that would bias rate denominators),
    // so a duplicate check-in date is irrelevant in that case.
    if (!answered && isNew && errs.date?.includes('already exists')) delete errs.date;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      observation: answered || !isNew ? obs : null,
      seizures: newSeizures.map((s) => ({ ...s, date: obs.date, time: s.time?.trim() ? s.time : null, preSymptoms: cleanList(s.preSymptoms), postSymptoms: cleanList(s.postSymptoms) })),
      bleeding: (obs.measures?.[BLEEDING_KEY] ?? null) as boolean | null,
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
        <span>Answer what you can – skip anything you didn’t track (it counts as “not recorded”, not “no”).</span>
        <a href="#/journal" onClick={onCancel} className="inline-flex items-center gap-1 font-semibold text-teal-800 underline">
          <Mic size={14} aria-hidden="true" /> Prefer to talk? Use the voice journal
        </a>
      </div>

      <Section title="Every day">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set('date', v)} error={errors.date} />
          <NumberInput label="Sleep (hours, night before)" value={draft.sleepHours} onChange={(v) => set('sleepHours', v)} error={errors.sleepHours} step="0.1" min={0} max={24} hint="Night ending on the morning of this date." />
          <NumberInput label="Sleep quality (1–5)" value={draft.sleepQuality} onChange={(v) => set('sleepQuality', v)} error={errors.sleepQuality} step="1" min={1} max={5} />
          <NumberInput label="Stress (0–10)" value={draft.stressLevel} onChange={(v) => set('stressLevel', v)} error={errors.stressLevel} step="1" min={0} max={10} />
          <TriState label="Illness (cold, flu, fever…)" value={draft.illness} onChange={(v) => set('illness', v)} />
        </div>
      </Section>

      {plan.seizures && (
        <Section title="Seizures on this day" sub={`Shown because of: ${plan.seizures.reasons.join(', ')}. If you check in and add no seizures, the day counts as a day without recorded seizures.`}>
          {existingSeizures.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {existingSeizures.map((s) => (
                <li key={s.id} className="rounded-md bg-slate-50 px-2 py-1">
                  Already recorded: {s.time ?? 'time unknown'} · {SEIZURE_TYPE_LABELS[s.type]} · {duration(s.durationSeconds)}
                  <span className="block text-xs text-slate-500">Edit or delete it from the Health Timeline or Records.</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-4">
            {newSeizures.map((s, i) => (
              <div key={s.id} className="rounded-lg border border-teal-200 bg-teal-50/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">New seizure {i + 1}</p>
                  <button type="button" className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove new seizure ${i + 1}`} onClick={() => setNewSeizures((l) => l.filter((x) => x.id !== s.id))}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextInput label="Time (optional)" type="time" value={s.time ?? ''} onChange={(v) => updateSeizure(s.id, { time: v || null })} error={errors[`sz-${i}-time`]} />
                  <SelectInput label="Seizure type" value={s.type} onChange={(v) => updateSeizure(s.id, { type: v })} options={Object.entries(SEIZURE_TYPE_LABELS).map(([value, label]) => ({ value: value as SeizureEvent['type'], label }))} hint="Choose “Unknown / not sure” if unsure." />
                  <NumberInput label="Duration (seconds)" value={s.durationSeconds} onChange={(v) => updateSeizure(s.id, { durationSeconds: v })} error={errors[`sz-${i}-durationSeconds`]} step="1" min={1} />
                  <SelectInput
                    label="Severity"
                    value={s.severity ?? 'unknown'}
                    onChange={(v) => updateSeizure(s.id, { severity: v === 'unknown' ? null : v })}
                    options={[
                      { value: 'unknown', label: 'Not recorded' },
                      { value: 'mild', label: 'Mild' },
                      { value: 'moderate', label: 'Moderate' },
                      { value: 'severe', label: 'Severe' },
                    ]}
                  />
                  <NumberInput label="Recovery time (minutes)" value={s.recoveryMinutes} onChange={(v) => updateSeizure(s.id, { recoveryMinutes: v })} error={errors[`sz-${i}-recoveryMinutes`]} step="1" min={0} />
                  <ListInput label="Symptoms before" value={s.preSymptoms} onChange={(v) => updateSeizure(s.id, { preSymptoms: v })} />
                  <ListInput label="Symptoms after" value={s.postSymptoms} onChange={(v) => updateSeizure(s.id, { postSymptoms: v })} />
                  <TextInput label="Notes" value={s.notes} onChange={(v) => updateSeizure(s.id, { notes: v })} />
                </div>
                {(s.durationSeconds ?? 0) >= 300 && (
                  <div className="mt-3">
                    <Notice tone="rose" icon={<AlertTriangle size={16} />}>
                      A seizure lasting 5 minutes or longer is a medical emergency – follow the seizure action plan and call 911 if it happens. Please also tell the treating clinician about this event.
                    </Notice>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button className="mt-3" onClick={() => setNewSeizures((l) => [...l, blankSeizure(newSeizureId(), draft.date)])}>
            <Plus size={14} aria-hidden="true" /> {newSeizures.length ? 'Add another seizure' : 'Add a seizure'}
          </Button>
        </Section>
      )}

      {(plan.builtin.length > 0 || plan.measures.length > 0) && (
        <Section title="For your conditions" sub="Questions chosen from the conditions in your profile. Optional – skip anything you did not track.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plan.builtin.map((f) => (
              <div key={f.key}>
                <TriState label={f.label} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
                <p className="mt-0.5 text-[11px] text-slate-500">for {f.reasons.join(', ')}</p>
              </div>
            ))}
            {plan.measures.map(({ def, reasons }) => {
              const v = draft.measures?.[def.id] ?? null;
              return (
                <div key={def.id}>
                  {def.kind === 'boolean' ? (
                    <TriState label={def.label} value={typeof v === 'boolean' ? v : null} onChange={(nv) => setMeasure(def.id, nv)} />
                  ) : (
                    <NumberInput label={def.label} value={typeof v === 'number' ? v : null} onChange={(nv) => setMeasure(def.id, nv)} error={errors[`measure:${def.id}`]} step={String(def.step ?? 'any')} min={def.min} max={def.max} hint={def.hint ?? 'Leave blank if not recorded.'} />
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-500">for {reasons.join(', ')}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {plan.menstrual && (
        <Section title="Menstrual cycle">
          <div className="max-w-xs">
            <TriState label="Menstrual bleeding on this day?" value={bleeding} onChange={(v) => setMeasure(BLEEDING_KEY, v)} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Include spotting if you count it as bleeding. Consecutive bleeding days form your period record, which the cycle analysis uses.
            {coveringPeriod && ` Your period record ${coveringPeriod.periodStart}${coveringPeriod.periodEnd && coveringPeriod.periodEnd !== coveringPeriod.periodStart ? ` – ${coveringPeriod.periodEnd}` : ''} includes this date.`}
          </p>
        </Section>
      )}

      <Section title="Anything else">
        <div className="grid gap-4">
          <ListInput label="Other symptoms" value={draft.otherSymptoms} onChange={(v) => set('otherSymptoms', v)} />
          <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} />
        </div>
      </Section>

      <label className="mt-4 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" className="accent-teal-700" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show all optional questions (not just those for my conditions)
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div>
          {onDelete && (
            <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={onDelete}>
              Delete check-in
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(errors).length > 0 && (
            <span role="alert" className={cx('text-xs font-medium text-rose-700')}>
              {errors.form ?? 'Fix the highlighted fields.'}
            </span>
          )}
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit">
            Save check-in
          </Button>
        </div>
      </div>
    </form>
  );
}
