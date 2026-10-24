import { useState } from 'react';
import { CalendarDays, Info, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Notice, PageHeader, inputClass } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import type { CareTask, TaskStatus } from '../models/types';
import { RowActions } from './TimelinePage';
import { formatDate } from '../analysis/dates';

const KIND_LABELS: Record<CareTask['kind'], string> = {
  'discuss-pattern': 'Discuss a pattern',
  'ask-assessment': 'Ask about assessment',
  'referral-follow-up': 'Referral follow-up',
  'record-appointment': 'Appointment',
  other: 'Other',
};
const STATUS: Array<{ id: TaskStatus; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

export function TasksPage() {
  const { state, dispatch } = useHealthData();
  const { findings, connections } = useAnalysis();
  const { openEditor, requestDelete } = useEditor();
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const tasks = [...state.data.tasks].sort((a, b) => ((a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : (a.dueDate ?? '9999') > (b.dueDate ?? '9999') ? 1 : a.title.localeCompare(b.title)));
  const insightTitle = (id: string | null) => (id ? findings.find((f) => f.id === id)?.title ?? connections.find((c) => c.id === id)?.title ?? 'Insight not in current period' : null);

  const setStatus = (t: CareTask, status: TaskStatus) => dispatch({ type: 'upsert', collection: 'tasks', record: { ...t, status } });

  return (
    <>
      <PageHeader
        title="Care Tasks"
        description="Personal follow-up reminders – for example, to discuss a pattern or ask about an assessment at the next appointment."
        actions={
          <Button variant="primary" onClick={() => openEditor({ kind: 'task' })}>
            <Plus size={16} aria-hidden="true" /> New task
          </Button>
        }
      />
      <Notice tone="slate" icon={<Info size={16} />}>
        HealthConnect never orders tests, makes referrals, contacts providers or changes treatment. Tasks are reminders for you to act on with your care team. Create tasks from any insight card on Pattern Discovery or Clinical Connections.
      </Notice>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks by status">
        {(['all', 'open', 'in-progress', 'done'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS.find((s) => s.id === f)!.label} ({f === 'all' ? tasks.length : tasks.filter((t) => t.status === f).length})
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {STATUS.filter((s) => filter === 'all' || filter === s.id).map((s) => {
          const list = tasks.filter((t) => t.status === s.id);
          return (
            <section key={s.id} aria-labelledby={`col-${s.id}`} className={filter !== 'all' ? 'lg:col-span-3' : undefined}>
              <h2 id={`col-${s.id}`} className="mb-2 text-sm font-semibold text-slate-700">
                {s.label} ({list.length})
              </h2>
              <div className="space-y-3">
                {list.map((t) => (
                  <Card key={t.id} as="article" className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-semibold ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{t.title}</h3>
                      <RowActions onEdit={() => openEditor({ kind: 'task', record: t, insightTitle: insightTitle(t.insightId) ?? undefined })} onDelete={() => requestDelete('task', t.id, 'care task')} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{t.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge>{KIND_LABELS[t.kind]}</Badge>
                      {t.dueDate && (
                        <Badge tone="amber">
                          <CalendarDays size={11} aria-hidden="true" /> Due {formatDate(t.dueDate, true)}
                        </Badge>
                      )}
                      {t.appointmentDate && <Badge tone="teal">Appointment {formatDate(t.appointmentDate, true)}</Badge>}
                    </div>
                    {t.insightId && <p className="mt-2 text-xs text-slate-500">From insight: {insightTitle(t.insightId)}</p>}
                    <div className="mt-3">
                      <label htmlFor={`st-${t.id}`} className="sr-only">
                        Status for {t.title}
                      </label>
                      <select id={`st-${t.id}`} className={`${inputClass} py-1 text-xs`} value={t.status} onChange={(e) => setStatus(t, e.target.value as TaskStatus)}>
                        {STATUS.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}
                {!list.length && <EmptyState>No tasks.</EmptyState>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
