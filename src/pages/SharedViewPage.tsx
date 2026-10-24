import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, Lock, ShieldOff } from 'lucide-react';
import { Badge, Card, CardTitle, EmptyState, Notice } from '../components/ui';
import { LogoMark } from '../components/Logo';
import { useHealthData, computeBundle } from '../store/HealthDataContext';
import { filterDataForPermissions, hasAccess, PERMISSIONS } from '../sharing/permissions';
import { buildDailySeries } from '../analysis/series';
import { SleepChart } from '../components/charts/SleepChart';
import { CycleStrip } from '../components/charts/CycleStrip';
import { buildClinicianSummary } from '../summary/clinicianSummary';
import { SEIZURE_TYPE_LABELS, SEX_LABELS, type PermissionKey } from '../models/types';
import { duration } from '../analysis/format';
import { currentMedications, doseOn } from '../analysis/medicationInfo';
import { formatWindow } from '../analysis/dates';
import { LABEL_TONE } from './SummaryPage';
import { TaskStatusBadge } from './TasksPage';

function Restricted({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
      <Lock size={14} aria-hidden="true" /> {label}: not shared with this person.
    </div>
  );
}

export function SharedViewPage({ personId }: { personId: string }) {
  const { state } = useHealthData();
  const person = state.data.sharing.find((p) => p.id === personId);
  const access = hasAccess(person);
  const perms = person?.permissions;
  // Everything below is computed from the FILTERED data – restricted categories are not present at all.
  const shared = useMemo(() => (access && perms ? { ...state, data: filterDataForPermissions(state.data, perms) } : null), [access, perms, state]);
  const bundle = useMemo(() => (shared ? computeBundle(shared) : null), [shared]);
  const back = (
    <a href="#/settings" className="inline-flex items-center gap-1 text-sm font-medium text-teal-800 underline">
      <ArrowLeft size={14} aria-hidden="true" /> Back to Settings & Sharing
    </a>
  );

  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-violet-100 px-4 py-2 text-center text-xs font-medium text-violet-900" role="note">
        Preview only – this is what {person?.name ?? 'this person'} would see. Nothing has been sent; no one has remote access.
      </div>
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <h1 className="text-xl font-semibold text-slate-900">Shared view{person ? ` for ${person.name}` : ''}</h1>
          </div>
          {back}
        </div>
        {children}
      </main>
    </div>
  );

  if (!person) return shell(<Notice tone="rose">This person was not found. They may have been removed.</Notice>);
  if (!access || !shared || !bundle || !perms)
    return shell(
      <Card className="text-center">
        <ShieldOff size={32} className="mx-auto text-slate-400" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-semibold text-slate-900">No access</h2>
        <p className="mt-1 text-sm text-slate-600">
          {person.status === 'revoked' ? `Access for ${person.name} was revoked on ${person.revokedOn}.` : `Sharing with ${person.name} has not been confirmed${Object.values(person.permissions).some(Boolean) ? '' : ' and no permissions are selected'}.`} Nothing is visible to them.
        </p>
      </Card>,
    );

  const d = shared.data;
  const series = buildDailySeries(d, bundle.window, bundle.outcome ?? 'seizures');
  const on = (k: PermissionKey) => perms[k];

  return shell(
    <div className="space-y-5">
      <Card>
        <p className="text-sm text-slate-600">
          Shared categories:{' '}
          {PERMISSIONS.filter((p) => on(p.key)).map((p) => (
            <Badge key={p.key} tone="teal" className="mr-1 mb-1">
              {p.label}
            </Badge>
          ))}
        </p>
        <p className="mt-1 text-xs text-slate-500">Period {formatWindow(bundle.window)}. Insights and reports are recalculated only from shared categories.</p>
      </Card>

      {on('profile') ? (
        <Card>
          <CardTitle>Health profile</CardTitle>
          <p className="text-sm">
            {d.profile.displayName}, {d.profile.age}, {SEX_LABELS[d.profile.sex]}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Allergies: </span>
            {d.allergies.length ? d.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join('; ') : d.profile.noKnownAllergies ? 'No known allergies' : 'Not recorded'}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1">
            {d.history.filter((h) => h.kind === 'diagnosis').map((h) => (
              <li key={h.id}>
                <Badge tone={h.status === 'confirmed' ? 'teal' : 'amber'}>
                  {h.label} · {h.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Restricted label="Health profile and conditions" />
      )}

      {on('events') ? (
        <Card>
          <CardTitle>Event history ({d.seizures.length})</CardTitle>
          <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto text-sm">
            {[...d.seizures].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
              <li key={s.id} className="py-1">
                {s.date} {s.time ?? ''} · {SEIZURE_TYPE_LABELS[s.type]} · {duration(s.durationSeconds)}
              </li>
            ))}
            {!d.seizures.length && <li className="py-1 text-slate-500">None recorded.</li>}
          </ul>
        </Card>
      ) : (
        <Restricted label="Seizure / event history" />
      )}

      {on('medications') ? (
        <Card>
          <CardTitle>Medications</CardTitle>
          <ul className="text-sm">
            {currentMedications(d, bundle.window.end).map((m) => (
              <li key={m.id}>
                {m.name} {doseOn(m, d.medicationEvents, bundle.window.end)} {m.frequency}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Restricted label="Medications" />
      )}

      {on('sleep') ? (
        <Card>
          <CardTitle>Sleep</CardTitle>
          <SleepChart points={series} threshold={shared.settings.sleepThresholdHours} flags={on('insights') ? bundle.flags : []} height={200} />
        </Card>
      ) : (
        <Restricted label="Sleep observations" />
      )}

      {on('symptoms') ? (
        <Card>
          <CardTitle>Symptoms (last 7 check-ins)</CardTitle>
          <ul className="text-sm">
            {[...d.observations].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7).map((o) => (
              <li key={o.id}>
                {o.date}: stress {o.stressLevel ?? '—'}/10 · {[o.headache && 'headache', o.dizziness && 'dizziness', o.illness && 'illness', o.attentionDifficulty && 'attention difficulty', ...o.otherSymptoms].filter(Boolean).join(', ') || 'none reported'}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Restricted label="Symptoms and daily journal" />
      )}

      {on('menstrual') ? (
        <Card>
          <CardTitle>Menstrual cycle</CardTitle>
          <CycleStrip points={series} />
        </Card>
      ) : (
        <Restricted label="Menstrual-cycle data" />
      )}

      {on('insights') ? (
        <Card>
          <CardTitle>Pattern insights and review flags</CardTitle>
          <ul className="space-y-1 text-sm">
            {bundle.findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change').map((f) => (
              <li key={f.id}>• {f.title}</li>
            ))}
            {bundle.flags.map((f) => (
              <li key={f.id}>
                <Badge tone={f.level === 'red' ? 'rose' : 'amber'}>{f.level}</Badge> {f.title}
              </li>
            ))}
            {!bundle.findings.some((f) => f.status === 'possible-pattern' || f.status === 'notable-change') && !bundle.flags.length && <li className="text-slate-500">No patterns can be calculated from the shared categories.</li>}
          </ul>
        </Card>
      ) : (
        <Restricted label="Pattern insights and graphs" />
      )}

      {on('reports') ? (
        <Card>
          <CardTitle>Clinician report (from shared categories)</CardTitle>
          {buildClinicianSummary(d, bundle.findings, bundle.connections, bundle.window, shared.settings, { flags: on('insights') ? bundle.flags : [], insufficient: [] }).sections.slice(0, 4).map((s) => (
            <section key={s.id} className="mb-3">
              <h3 className="text-xs font-semibold text-slate-700 uppercase">{s.heading}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {s.items.slice(0, 6).map((i, idx) => (
                  <li key={idx}>
                    <Badge tone={LABEL_TONE[i.label]}>{i.label}</Badge> {i.text}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      ) : (
        <Restricted label="Clinician reports and PDF exports" />
      )}

      {on('tasks') ? (
        <Card>
          <CardTitle>Care tasks</CardTitle>
          <ul className="text-sm">
            {d.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-0.5">
                <TaskStatusBadge status={t.status} /> {t.title}
              </li>
            ))}
            {!d.tasks.length && <EmptyState>No tasks.</EmptyState>}
          </ul>
        </Card>
      ) : (
        <Restricted label="Care tasks and navigation notes" />
      )}
    </div>,
  );
}
