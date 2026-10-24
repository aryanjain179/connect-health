import { useState } from 'react';
import { Check, ClipboardList, Mic, MicOff, Square, Trash2, Wand2, X } from 'lucide-react';
import { useEditor } from '../components/forms/EditorContext';
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Notice, PageHeader, cx, inputClass } from '../components/ui';
import { useHealthData } from '../store/HealthDataContext';
import { useSpeechRecognition } from '../journal/useSpeech';
import { extractProposals, type Proposal } from '../journal/extract';
import { applyProposals, undoJournal } from '../journal/apply';
import { newId } from '../store/reducer';
import { localToday } from '../analysis/dates';
import type { JournalEntry } from '../models/types';

type Decision = 'pending' | 'approved' | 'rejected';

export function JournalPage() {
  const { state, dispatch } = useHealthData();
  const { openEditor } = useEditor();
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState<'speech' | 'typed'>('typed');
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [saveTranscript, setSaveTranscript] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: string[] } | null>(null);
  const [toDelete, setToDelete] = useState<{ entry: JournalEntry; withRecords: boolean } | null>(null);
  const speech = useSpeechRecognition((text) => {
    setSource('speech');
    setTranscript((t) => (t ? `${t} ${text}` : text));
  });
  const meds = state.data.medications;

  const review = () => {
    setProposals(extractProposals(transcript, { today: localToday(), medications: meds }));
    setDecisions({});
    setResult(null);
  };
  const update = (id: string, patch: Partial<Proposal>) => setProposals((ps) => ps?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? null);
  const decide = (id: string, d: Decision) => setDecisions((x) => ({ ...x, [id]: d }));
  const pending = proposals?.filter((p) => (decisions[p.id] ?? 'pending') === 'pending').length ?? 0;
  const approved = proposals?.filter((p) => decisions[p.id] === 'approved') ?? [];

  const commit = () => {
    if (!proposals) return;
    const rejected = proposals.filter((p) => decisions[p.id] === 'rejected').length;
    const { actions, entry, skipped } = applyProposals(approved, state.data, { transcript, saveTranscript, source, now: new Date().toISOString(), today: localToday(), newId, rejectedCount: rejected });
    dispatch({ type: 'batch', actions });
    setResult({ added: entry.approvedCount, skipped });
    setProposals(null);
    setTranscript('');
    setDecisions({});
  };

  const listening = speech.status === 'listening' || speech.status === 'requesting';

  return (
    <>
      <PageHeader
        title="Voice Journal"
        description="Just talk about your day – how you slept, how you feel, any symptoms or missed medication. ConnectHealth turns it into entries, and you approve each one before anything is saved."
        actions={
          <Button onClick={() => openEditor({ kind: 'observation' })}>
            <ClipboardList size={16} aria-hidden="true" /> Prefer a form? Daily check-in
          </Button>
        }
      />
      <Notice tone="slate">
        Nothing is recorded from your words until you approve it. ConnectHealth only reads the words you say or type – it does not analyse voice tone or detect emotions. Speech recognition is provided by your browser; in some browsers (for example Chrome) the audio is processed by the browser vendor’s online speech service. If you prefer, type instead.
      </Notice>

      <Card className="mt-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {speech.supported ? (
            <>
              <button
                type="button"
                onClick={listening ? speech.stop : speech.start}
                aria-pressed={listening}
                aria-label={listening ? 'Stop recording' : 'Start Voice Journal'}
                className={cx('flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-colors focus-visible:outline-4', listening ? 'animate-pulse bg-rose-600 hover:bg-rose-700' : 'bg-teal-700 hover:bg-teal-800')}
              >
                {listening ? <Square size={34} aria-hidden="true" /> : <Mic size={38} aria-hidden="true" />}
              </button>
              <p className="text-base font-semibold text-slate-900" role="status" aria-live="polite">
                {speech.status === 'requesting' && 'Requesting microphone permission…'}
                {speech.status === 'listening' && (
                  <span className="inline-flex items-center gap-2 text-rose-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600" aria-hidden="true" /> Recording – tap to stop
                  </span>
                )}
                {speech.status === 'stopped' && 'Recording stopped'}
                {(speech.status === 'idle' || speech.status === 'denied' || speech.status === 'error') && 'Start Voice Journal'}
              </p>
              {speech.status !== 'listening' && <p className="max-w-md text-sm text-slate-500">Tap the microphone and talk naturally, e.g. “I slept about six hours, had a headache after lunch and forgot my evening dose.”</p>}
              {speech.interim && <p className="max-w-xl text-sm text-slate-500 italic">“{speech.interim}”</p>}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
                <MicOff size={28} />
              </span>
              <p className="text-sm text-slate-700">Speech recognition isn’t available in this browser. Type your journal entry below – everything else works the same.</p>
            </div>
          )}
          {speech.error && (
            <p role="alert" className="text-sm text-rose-700">
              {speech.error}
            </p>
          )}
        </div>
        <label htmlFor="transcript" className="text-sm font-medium text-slate-700">
          Transcript (edit freely, or type here)
        </label>
        <textarea
          id="transcript"
          rows={5}
          className={`${inputClass} mt-1`}
          placeholder="e.g. I slept about five hours last night, felt unusually anxious this morning, and had a headache after lunch."
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            if (!listening) setSource((s) => (s === 'speech' ? 'speech' : 'typed'));
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={review} disabled={!transcript.trim() || listening}>
            <Wand2 size={16} aria-hidden="true" /> Review proposed entries
          </Button>
          <Button variant="ghost" onClick={() => { setTranscript(''); setProposals(null); }} disabled={!transcript}>
            Clear
          </Button>
        </div>
      </Card>

      {result && (
        <div className="mt-4">
          <Notice tone="sky">
            Added {result.added} approved {result.added === 1 ? 'entry' : 'entries'} – your timeline, dashboard and patterns have been recalculated.{' '}
            <a href="#/timeline" className="font-medium underline">View timeline</a>.
            {result.skipped.length > 0 && <> Not saved: {result.skipped.join('; ')}.</>}
          </Notice>
        </div>
      )}

      {proposals && (
        <Card className="mt-6">
          <CardTitle sub="Approve, edit or reject each proposal. Only approved items are saved.">Review proposed entries</CardTitle>
          {!proposals.length && <EmptyState>No structured details were recognised. Try mentioning sleep hours, symptoms such as headache or dizziness, a seizure, stress (0–10), or a missed dose – or add records manually.</EmptyState>}
          <ul className="space-y-3">
            {proposals.map((p) => {
              const d = decisions[p.id] ?? 'pending';
              return (
                <li key={p.id} className={cx('rounded-lg border p-3', d === 'approved' ? 'border-teal-300 bg-teal-50/50' : d === 'rejected' ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{p.label}</p>
                      <p className="text-xs text-slate-500">From: “{p.evidence}”</p>
                    </div>
                    <div className="flex gap-1" role="group" aria-label={`Decision for ${p.label}`}>
                      <Button size="sm" variant={d === 'approved' ? 'primary' : 'secondary'} aria-pressed={d === 'approved'} onClick={() => decide(p.id, 'approved')}>
                        <Check size={13} aria-hidden="true" /> Approve
                      </Button>
                      <Button size="sm" variant={d === 'rejected' ? 'danger' : 'secondary'} aria-pressed={d === 'rejected'} onClick={() => decide(p.id, 'rejected')}>
                        <X size={13} aria-hidden="true" /> Reject
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`d-${p.id}`} className="text-xs text-slate-600">Date</label>
                      <input id={`d-${p.id}`} type="date" className={inputClass} value={p.date} max={localToday()} onChange={(e) => update(p.id, { date: e.target.value })} />
                    </div>
                    <ProposalValue p={p} meds={meds} update={update} />
                  </div>
                  {p.note && <p className="mt-1 text-xs text-slate-600">Note: {p.note}</p>}
                  {p.clarification && <p className="mt-1 text-xs font-medium text-amber-800">Needs your input: {p.clarification}</p>}
                </li>
              );
            })}
          </ul>
          {proposals.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-teal-700" checked={saveTranscript} onChange={(e) => setSaveTranscript(e.target.checked)} />
                Save the original transcript with this journal entry
              </label>
              <div className="flex items-center gap-2">
                {pending > 0 && <span className="text-xs text-slate-500">{pending} still to decide (left unsaved)</span>}
                <Button variant="primary" onClick={commit} disabled={!approved.length}>
                  Add {approved.length} approved {approved.length === 1 ? 'entry' : 'entries'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardTitle sub="Delete an entry’s transcript, or the entry together with every record it created.">Journal history</CardTitle>
        <ul className="divide-y divide-slate-100 text-sm">
          {[...state.data.journal].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((j) => (
            <li key={j.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">
                    {new Date(j.createdAt).toLocaleString()} <Badge>{j.source === 'speech' ? 'spoken' : 'typed'}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">
                    {j.approvedCount} approved · {j.rejectedCount} rejected · {j.createdRecords.length} records created · {j.updatedFields.length} fields updated
                  </p>
                </div>
                <div className="flex gap-1">
                  {j.transcript && (
                    <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'upsert', collection: 'journal', record: { ...j, transcript: null } })}>
                      Delete transcript only
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setToDelete({ entry: j, withRecords: true })}>
                    <Trash2 size={13} aria-hidden="true" /> Delete entry & records
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-slate-600">{j.transcript ? `“${j.transcript}”` : <span className="text-slate-400">Transcript not saved.</span>}</p>
            </li>
          ))}
          {!state.data.journal.length && <li className="py-2 text-slate-500">No journal entries yet.</li>}
        </ul>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete journal entry and its records?"
        message="This removes the journal entry, deletes the records it created and restores any check-in fields it changed. Patterns and reports will be recalculated."
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) dispatch({ type: 'batch', actions: undoJournal(toDelete.entry, state.data, toDelete.withRecords) });
          setToDelete(null);
        }}
      />
    </>
  );
}

function ProposalValue({ p, meds, update }: { p: Proposal; meds: ReturnType<typeof useHealthData>['state']['data']['medications']; update: (id: string, patch: Partial<Proposal>) => void }) {
  const id = `v-${p.id}`;
  if (p.kind === 'sleepHours' || p.kind === 'stress') {
    const max = p.kind === 'sleepHours' ? 24 : 10;
    return (
      <div>
        <label htmlFor={id} className="text-xs text-slate-600">{p.kind === 'sleepHours' ? 'Hours' : 'Rating 0–10 (optional)'}</label>
        <input id={id} type="number" min={0} max={max} step={p.kind === 'sleepHours' ? 0.5 : 1} className={inputClass} value={typeof p.value === 'number' ? p.value : ''} onChange={(e) => update(p.id, { value: e.target.value === '' ? null : Math.min(max, Math.max(0, Number(e.target.value))) })} />
      </div>
    );
  }
  if (typeof p.value === 'boolean') {
    return (
      <div>
        <label htmlFor={id} className="text-xs text-slate-600">Recorded as</label>
        <select id={id} className={inputClass} value={p.value ? 'yes' : 'no'} onChange={(e) => update(p.id, { value: e.target.value === 'yes' })}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    );
  }
  if (p.kind === 'missedDose' || p.kind === 'sideEffect') {
    return (
      <div>
        <label htmlFor={id} className="text-xs text-slate-600">Medication</label>
        <select id={id} className={inputClass} value={p.medicationId ?? ''} onChange={(e) => update(p.id, { medicationId: e.target.value || null, clarification: e.target.value ? null : p.clarification })}>
          <option value="">Choose…</option>
          {meds.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (p.kind === 'otherSymptom') {
    return (
      <div>
        <label htmlFor={id} className="text-xs text-slate-600">Symptom</label>
        <input id={id} className={inputClass} value={String(p.value ?? '')} onChange={(e) => update(p.id, { value: e.target.value })} />
      </div>
    );
  }
  if (p.kind === 'seizure') {
    return (
      <>
        <div>
          <label htmlFor={`${id}-t`} className="text-xs text-slate-600">Time (optional)</label>
          <input id={`${id}-t`} type="time" className={inputClass} value={p.seizureTime ?? ''} onChange={(e) => update(p.id, { seizureTime: e.target.value || null })} />
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="text-xs text-slate-600">Duration seconds (optional)</label>
          <input id={`${id}-d`} type="number" min={1} className={inputClass} value={p.seizureDurationSeconds ?? ''} onChange={(e) => update(p.id, { seizureDurationSeconds: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </>
    );
  }
  return null;
}
