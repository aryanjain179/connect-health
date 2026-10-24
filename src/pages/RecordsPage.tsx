import { useRef, useState, type ReactNode } from 'react';
import { Download, Plus, RotateCcw, Upload } from 'lucide-react';
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, PageHeader, cx } from '../components/ui';
import { useHealthData } from '../store/HealthDataContext';
import { useEditor, type EditorKind } from '../components/forms/EditorContext';
import { RowActions } from './TimelinePage';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { duration } from '../analysis/format';
import { exportJson, parseImport } from '../store/storage';
import { observationCompleteness } from '../analysis/completeness';
import { doseOn } from '../analysis/medicationInfo';
import { historyStatusTone, sourceLabel } from '../components/labels';

type Tab = 'seizures' | 'observations' | 'menstrual' | 'medications' | 'history';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'seizures', label: 'Seizures' },
  { id: 'observations', label: 'Daily check-ins' },
  { id: 'menstrual', label: 'Menstrual cycle' },
  { id: 'medications', label: 'Medications' },
  { id: 'history', label: 'Symptoms & history' },
];

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty: boolean }) {
  if (empty) return <EmptyState>No records yet.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

const nr = <span className="text-slate-400">—</span>;
const desc = <T extends Record<K, string>, K extends keyof T>(key: K) => (a: T, b: T) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0);

export function RecordsPage() {
  const { state, dispatch } = useHealthData();
  const { openEditor, requestDelete } = useEditor();
  const [tab, setTab] = useState<Tab>('seizures');
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const d = state.data;

  const add = (kind: EditorKind) => openEditor({ kind });

  const doExport = () => {
    const blob = new Blob([exportJson(d)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'healthconnect-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ tone: 'ok', text: 'Export downloaded.' });
  };

  const doImport = async (file: File) => {
    try {
      const data = parseImport(await file.text());
      dispatch({ type: 'replaceData', data });
      setMessage({ tone: 'ok', text: `Imported ${data.seizures.length} seizures and ${data.observations.length} check-ins.` });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  return (
    <>
      <PageHeader
        title="Records"
        description="Add, edit and delete the records behind every chart and calculation. Changes are saved in this browser and recalculated everywhere."
      />

      <Card className="mb-6">
        <CardTitle sub="Data stays in this browser’s local storage. No account or server is used.">Data management</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport}>
            <Download size={16} aria-hidden="true" /> Export JSON
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import JSON file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
          <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} aria-hidden="true" /> Reset to synthetic dataset
          </Button>
        </div>
        {message && (
          <p role="status" className={cx('mt-2 text-sm', message.tone === 'ok' ? 'text-teal-800' : 'text-rose-700')}>
            {message.text}
          </p>
        )}
      </Card>

      <div role="tablist" aria-label="Record types" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t.id ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-600 hover:text-slate-900')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'seizures' && (
            <>
              <CardTitle action={<Button variant="primary" size="sm" onClick={() => add('seizure')}><Plus size={14} aria-hidden="true" /> Add seizure</Button>}>Seizure events ({d.seizures.length})</CardTitle>
              <Table head={['Date', 'Time', 'Type', 'Duration', 'Severity', 'Recovery', 'Source']} empty={!d.seizures.length}>
                {[...d.seizures].sort(desc('date')).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.date}</td>
                    <td className="py-2 pr-3">{s.time ?? nr}</td>
                    <td className="py-2 pr-3">{SEIZURE_TYPE_LABELS[s.type]}</td>
                    <td className="py-2 pr-3">{duration(s.durationSeconds)}</td>
                    <td className="py-2 pr-3 capitalize">{s.severity ?? nr}</td>
                    <td className="py-2 pr-3">{s.recoveryMinutes === null ? nr : `${s.recoveryMinutes} min`}</td>
                    <td className="py-2 pr-3">{s.isSynthetic ? <Badge tone="amber">synthetic</Badge> : <Badge tone="sky">user-entered</Badge>}</td>
                    <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'seizure', record: s })} onDelete={() => requestDelete('seizure', s.id, 'seizure event')} /></td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {tab === 'observations' && (
            <>
              <CardTitle action={<Button variant="primary" size="sm" onClick={() => add('observation')}><Plus size={14} aria-hidden="true" /> Add check-in</Button>}>Daily check-ins ({d.observations.length})</CardTitle>
              <Table head={['Date', 'Sleep h', 'Quality', 'Stress', 'Attention', 'Symptoms', 'Complete']} empty={!d.observations.length}>
                {[...d.observations].sort(desc('date')).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{o.date}</td>
                    <td className="py-2 pr-3">{o.sleepHours ?? nr}</td>
                    <td className="py-2 pr-3">{o.sleepQuality ?? nr}</td>
                    <td className="py-2 pr-3">{o.stressLevel ?? nr}</td>
                    <td className="py-2 pr-3">{o.attentionDifficulty === null ? nr : o.attentionDifficulty ? 'yes' : 'no'}</td>
                    <td className="py-2 pr-3 text-xs">{[o.headache && 'headache', o.dizziness && 'dizziness', o.illness && 'illness', ...o.otherSymptoms].filter(Boolean).join(', ') || nr}</td>
                    <td className="py-2 pr-3">{Math.round(observationCompleteness(o) * 100)}%</td>
                    <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'observation', record: o })} onDelete={() => requestDelete('observation', o.id, 'daily check-in')} /></td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {tab === 'menstrual' && (
            <>
              <CardTitle action={<Button variant="primary" size="sm" onClick={() => add('menstrual')}><Plus size={14} aria-hidden="true" /> Add period</Button>}>Menstrual-cycle records ({d.menstrual.length})</CardTitle>
              <Table head={['Period start', 'Period end', 'Start certainty', 'Notes']} empty={!d.menstrual.length}>
                {[...d.menstrual].sort(desc('periodStart')).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3">{m.periodStart}</td>
                    <td className="py-2 pr-3">{m.periodEnd ?? nr}</td>
                    <td className="py-2 pr-3"><Badge tone={m.startCertainty === 'exact' ? 'teal' : 'amber'}>{m.startCertainty}</Badge></td>
                    <td className="py-2 pr-3 text-xs">{m.notes || nr}</td>
                    <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'menstrual', record: m })} onDelete={() => requestDelete('menstrual', m.id, 'period record')} /></td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {tab === 'medications' && (
            <>
              <CardTitle action={<Button variant="primary" size="sm" onClick={() => add('medication')}><Plus size={14} aria-hidden="true" /> Add medication</Button>}>Medications ({d.medications.length})</CardTitle>
              <Table head={['Name', 'Current dose', 'Frequency', 'Start', 'End', 'Kind', 'Source']} empty={!d.medications.length}>
                {[...d.medications].sort(desc('startDate')).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="py-2 pr-3">{doseOn(m, d.medicationEvents, m.endDate ?? '9999-12-31')}</td>
                    <td className="py-2 pr-3">{m.frequency || nr}</td>
                    <td className="py-2 pr-3">{m.startDate}</td>
                    <td className="py-2 pr-3">{m.endDate ?? <Badge tone="teal">active</Badge>}</td>
                    <td className="py-2 pr-3 text-xs">{m.kind}</td>
                    <td className="py-2 pr-3 text-xs">{sourceLabel(m.source)}</td>
                    <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'medication', record: m })} onDelete={() => requestDelete('medication', m.id, 'medication')} /></td>
                  </tr>
                ))}
              </Table>
              <div className="mt-8">
                <CardTitle action={<Button size="sm" onClick={() => add('medicationEvent')} disabled={!d.medications.length}><Plus size={14} aria-hidden="true" /> Add dose change / missed dose / side effect</Button>}>
                  Medication events ({d.medicationEvents.length})
                </CardTitle>
                <Table head={['Date', 'Medication', 'Event', 'New dose', 'Description', 'Source']} empty={!d.medicationEvents.length}>
                  {[...d.medicationEvents].sort(desc('date')).map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{e.date}</td>
                      <td className="py-2 pr-3">{d.medications.find((m) => m.id === e.medicationId)?.name ?? nr}</td>
                      <td className="py-2 pr-3"><Badge tone={e.kind === 'dose-change' ? 'violet' : e.kind === 'missed-dose' ? 'amber' : 'sky'}>{e.kind}</Badge></td>
                      <td className="py-2 pr-3">{e.newDose ?? nr}</td>
                      <td className="py-2 pr-3 text-xs">{e.description || nr}</td>
                      <td className="py-2 pr-3 text-xs">{sourceLabel(e.source)}</td>
                      <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'medicationEvent', record: e })} onDelete={() => requestDelete('medicationEvent', e.id, 'medication event')} /></td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}

          {tab === 'history' && (
            <>
              <CardTitle action={<Button variant="primary" size="sm" onClick={() => add('history')}><Plus size={14} aria-hidden="true" /> Add symptom / history</Button>}>Symptoms, diagnoses & history ({d.history.length})</CardTitle>
              <Table head={['Kind', 'Description', 'Status', 'Source', 'Date', 'Tags']} empty={!d.history.length}>
                {[...d.history].sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)).map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 pr-3 capitalize">{h.kind}</td>
                    <td className="py-2 pr-3">{h.label}</td>
                    <td className="py-2 pr-3"><Badge tone={historyStatusTone(h.status)}>{h.status}</Badge></td>
                    <td className="py-2 pr-3 text-xs">{sourceLabel(h.source)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{h.date ?? nr}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{h.tags.join(', ') || nr}</td>
                    <td className="py-2 text-right"><RowActions onEdit={() => openEditor({ kind: 'history', record: h })} onDelete={() => requestDelete('history', h.id, 'history record')} /></td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to the synthetic dataset?"
        message="This replaces all records in this browser (including anything you added) with the original fictional dataset. Export first if you want to keep your changes."
        confirmLabel="Reset data"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          dispatch({ type: 'resetSynthetic' });
          setConfirmReset(false);
          setMessage({ tone: 'ok', text: 'Synthetic dataset restored.' });
        }}
      />
    </>
  );
}
