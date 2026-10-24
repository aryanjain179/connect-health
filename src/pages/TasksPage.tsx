import { useState } from 'react';
import { CalendarDays, Info, Link2, Phone, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Notice, PageHeader, inputClass } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import type { CareTask, TaskStatus } from '../models/types';
import { RowActions } from './TimelinePage';
import { formatDate } from '../analysis/dates';

export const KIND_LABELS: Record<CareTask['kind'], string> = {
  'discuss-pattern': 'Discuss a pattern',
  'ask-assessment': 'Ask about assessment',
  'referral-follow-up': 'Referral follow-up',
  'record-appointment': 'Appointment',
  other: 'Other',
};

export const TASK_STATUSES: Array<{ id: TaskStatus; label: string; tone: 'slate' | 'sky' | 'amber' | 'rose' | 'teal' }> = [
  { id: 'open', label: 'Not started', tone: 'slate' },
  { id: 'in-progress', label: 'Started', tone: 'sky' },
  { id: 'waiting', label: 'Waiting', tone: 'amber' },
  { id: 'blocked', label: 'Blocked', tone: 'rose' },
  { id: 'done', label: 'Completed', tone: 'teal' },
];

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUSES.find((x) => x.id === status)!;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function TasksPage() {
  const { state, dispatch } = useHealthData();
  const { findings, connections, flags } = useAnalysis();
  const { openEditor, requestDelete } = useEditor();
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const tasks = [...state.data.tasks].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
  const insightTitle = (id: string | null) =>
    id ? (findings.find((f) => f.id === id)?.title ?? connections.find((c) => c.id === id)?.title ?? flags.find((f) => f.id === id)?.title ?? (id.startsWith('specialty:') ? 'Care Navigator suggestion' : 'Insight not in current period')) : null;
  const setStatus = (t: CareTask, status: TaskStatus) => dispatch({ type: 'upsert', collection: 'tasks', record: { ...t, status } });
  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <>
      <PageHeader
        title="Care Tasks"
        description="Follow-up reminders and care-coordination steps – from insights, review flags, the Care Navigator, or added manually."
        actions={
          <Button variant="primary" onClick={() => openEditor({ kind: 'task' })}>
            <Plus size={16} aria-hidden="true" /> New task
          </Button>
        }
      />
      <Notice tone="slate" icon={<Info size={16} />}>
        ConnectHealth never orders tests, makes referrals, contacts providers or changes treatment. A contact or outcome only appears here if you record it.
      </Notice>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks by status">
        {(['all', ...TASK_STATUSES.map((s) => s.id)] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : TASK_STATUSES.find((s) => s.id === f)!.label} ({f === 'all' ? tasks.length : tasks.filter((t) => t.status === f).length})
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((t) => (
          <Card key={t.id} as="article" className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`text-sm font-semibold ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{t.title}</h3>
              <RowActions onEdit={() => openEditor({ kind: 'task', record: t, insightTitle: insightTitle(t.insightId) ?? undefined })} onDelete={() => requestDelete('task', t.id, 'care task')} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{t.reason}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TaskStatusBadge status={t.status} />
              <Badge>{KIND_LABELS[t.kind]}</Badge>
              {t.dueDate && (
                <Badge tone="amber">
                  <CalendarDays size={11} aria-hidden="true" /> Due {formatDate(t.dueDate, true)}
                </Badge>
              )}
              {t.appointmentDate && <Badge tone="teal">Appointment {formatDate(t.appointmentDate, true)}</Badge>}
              {t.followUpDate && <Badge tone="sky">Follow up {formatDate(t.followUpDate, true)}</Badge>}
            </div>
            {t.contactedWho && (
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                <Phone size={11} aria-hidden="true" /> You recorded contacting {t.contactedWho}
                {t.contactedOn ? ` on ${formatDate(t.contactedOn, true)}` : ''}.
              </p>
            )}
            {t.notes && <p className="mt-1 text-xs text-slate-600">Notes: {t.notes}</p>}
            {(t.links?.length ?? 0) > 0 && (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                <Link2 size={11} aria-hidden="true" /> Linked: {t.links!.map((l) => `${l.kind} – ${l.label}`).join('; ')}
              </p>
            )}
            {t.insightId && <p className="mt-1 text-xs text-slate-500">From: {insightTitle(t.insightId)}</p>}
            <div className="mt-3">
              <label htmlFor={`st-${t.id}`} className="sr-only">
                Status for {t.title}
              </label>
              <select id={`st-${t.id}`} className={`${inputClass} py-1 text-xs`} value={t.status} onChange={(e) => setStatus(t, e.target.value as TaskStatus)}>
                {TASK_STATUSES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        ))}
      </div>
      {!visible.length && (
        <div className="mt-4">
          <EmptyState>No tasks{filter !== 'all' ? ' with this status' : ''}. Create one from Pattern Discovery, Clinician Review, the Care Navigator, or with “New task”.</EmptyState>
        </div>
      )}
    </>
  );
}
