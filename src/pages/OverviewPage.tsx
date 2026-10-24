import { useMemo } from 'react';
import { Activity, AlertTriangle, BedDouble, CalendarClock, ClipboardCheck, Link2, Pill, Search, UserRound } from 'lucide-react';
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Stat } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import { SleepChart } from '../components/charts/SleepChart';
import { CycleStrip } from '../components/charts/CycleStrip';
import { buildDailySeries } from '../analysis/series';
import { formatDate, formatWindow } from '../analysis/dates';
import { duration, plural } from '../analysis/format';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { currentMedications, doseOn, pastMedications } from '../analysis/medicationInfo';
import { summarizeSleep } from '../analysis/completeness';
import { STATUS_LABELS } from '../analysis';
import { StatusBadge, historyStatusTone, sourceLabel } from '../components/labels';

export function OverviewPage() {
  const { state } = useHealthData();
  const { window, seizures, completeness, findings, connections } = useAnalysis();
  const { openEditor } = useEditor();
  const data = state.data;
  const series = useMemo(() => buildDailySeries(data, window), [data, window]);
  const sleep = useMemo(() => summarizeSleep(data, window, state.settings.sleepThresholdHours), [data, window, state.settings.sleepThresholdHours]);
  const diagnoses = data.history.filter((h) => h.kind === 'diagnosis');
  const current = currentMedications(data, window.end);
  const past = pastMedications(data, window.end);
  const active = findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change');
  const surfaced = connections.filter((c) => c.surfaced);
  const recent = [...series].reverse().slice(0, 7);
  const last = seizures.mostRecentOverall;

  return (
    <>
      <PageHeader
        title="Overview"
        description={<>Longitudinal picture for {data.profile.displayName} · {formatWindow(window)}. All values are calculated from the stored records.</>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Activity size={14} />} label="Seizure events" value={seizures.totalEvents} sub={`on ${plural(seizures.seizureDays, 'day')} in the period`} />
        <Stat
          icon={<CalendarClock size={14} />}
          label="Most recent seizure"
          value={last ? formatDate(last.date) : '—'}
          sub={last ? `${SEIZURE_TYPE_LABELS[last.type]} · ${duration(last.durationSeconds)}` : 'No seizures recorded'}
        />
        <Stat
          icon={<BedDouble size={14} />}
          label="Mean sleep"
          value={sleep.meanHours === null ? '—' : `${sleep.meanHours.toFixed(1)} h`}
          sub={`${sleep.recordedNights} recorded nights · ${sleep.nightsBelow} < ${sleep.threshold} h`}
        />
        <Stat
          icon={<ClipboardCheck size={14} />}
          label="Check-in days"
          value={`${completeness.checkInDays}/${completeness.calendarDays}`}
          sub={`${completeness.missingDays.length} days missing · ${completeness.partialCheckIns} partial`}
        />
      </div>

      {seizures.prolonged.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {plural(seizures.prolonged.length, 'seizure')} lasting 5 minutes or longer recorded in this period. See <a className="font-medium underline" href="#/connections">Clinical Connections</a> for the safety protocol.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle icon={<UserRound size={18} />} action={<Badge tone="amber">Synthetic</Badge>}>
            Patient profile
          </CardTitle>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium">{data.profile.displayName}</dd>
            <dt className="text-slate-500">Age</dt>
            <dd>{data.profile.age}</dd>
            <dt className="text-slate-500">Sex</dt>
            <dd>
              <span className="capitalize">{data.profile.sex}</span>
              {data.profile.pronouns ? ` (${data.profile.pronouns})` : ''}
            </dd>
            <dt className="text-slate-500">Condition focus</dt>
            <dd className="capitalize">{data.profile.conditionFocus}</dd>
          </dl>
          {data.profile.careTeamNote && <p className="mt-3 text-xs text-slate-500">{data.profile.careTeamNote}</p>}
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-800">Documented diagnoses</h3>
          {diagnoses.length ? (
            <ul className="space-y-2">
              {diagnoses.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {d.label}
                    <span className="block text-xs text-slate-500">
                      {sourceLabel(d.source)}
                      {d.date ? ` · since ${formatDate(d.date, true)}` : ''}
                    </span>
                  </span>
                  <Badge tone={historyStatusTone(d.status)}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No diagnoses recorded.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={<Pill size={18} />} action={<Button size="sm" onClick={() => openEditor({ kind: 'medicationEvent' })}>Log medication event</Button>}>
            Medications & treatment history
          </CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Current (as of {formatDate(window.end, true)})</h3>
              <ul className="space-y-2 text-sm">
                {current.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{m.name}</span>
                      <Badge tone={m.kind === 'prescription' ? 'teal' : m.kind === 'rescue' ? 'sky' : 'slate'}>{m.kind.replace('otc-supplement', 'OTC / supplement')}</Badge>
                    </div>
                    <p className="text-slate-600">
                      {doseOn(m, data.medicationEvents, window.end)} · {m.frequency}
                    </p>
                    <p className="text-xs text-slate-500">
                      Since {m.startDate} · {sourceLabel(m.source)}
                    </p>
                  </li>
                ))}
                {!current.length && <EmptyState>No current medications recorded.</EmptyState>}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Changes in this period</h3>
              <ul className="space-y-1 text-sm">
                {series.flatMap((p) => p.meds).map((m, i) => (
                  <li key={`${m.date}-${i}`} className="flex gap-2">
                    <span className="w-14 shrink-0 text-slate-500">{formatDate(m.date)}</span>
                    <span>{m.label}</span>
                  </li>
                ))}
                {!series.some((p) => p.meds.length) && <li className="text-slate-500">No medication events in this period.</li>}
              </ul>
              <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-800">Previous treatments</h3>
              <ul className="space-y-1 text-sm">
                {past.map((m) => (
                  <li key={m.id}>
                    {m.name} <span className="text-slate-500">({m.startDate} – {m.endDate})</span>
                    {m.notes && <span className="block text-xs text-slate-500">{m.notes}</span>}
                  </li>
                ))}
                {!past.length && <li className="text-slate-500">None recorded.</li>}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={<BedDouble size={18} />} sub="Sleep for the night ending on each date">
            Sleep trend
          </CardTitle>
          <SleepChart points={series} threshold={state.settings.sleepThresholdHours} />
        </Card>
        <Card>
          <CardTitle icon={<ClipboardCheck size={18} />} sub="Share of calendar days with each field recorded">
            Data completeness
          </CardTitle>
          <div className="space-y-3">
            <ProgressBar label="Daily check-ins" value={completeness.checkInDays} max={completeness.calendarDays} />
            {completeness.fields.map((f) => (
              <ProgressBar key={f.key} label={f.label} value={f.recordedDays} max={f.calendarDays} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Missing values are excluded from calculations – never counted as zero or “no”.</p>
        </Card>
      </div>

      {data.menstrual.length > 0 && (
        <Card className="mt-6">
          <CardTitle sub="Phases from recorded period starts (Herzog et al. 1997 day ranges)">Menstrual-cycle timeline</CardTitle>
          <CycleStrip points={series} />
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<CalendarClock size={18} />} action={<Button size="sm" onClick={() => openEditor({ kind: 'observation' })}>Add check-in</Button>}>
            Recent observations
          </CardTitle>
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((p) => (
              <li key={p.date} className="flex items-start gap-3 py-2">
                <span className="w-16 shrink-0 font-medium text-slate-700">{formatDate(p.date)}</span>
                {p.checkIn ? (
                  <button type="button" className="flex-1 text-left hover:text-teal-800" onClick={() => openEditor({ kind: 'observation', record: p.checkIn! })} aria-label={`Edit check-in for ${formatDate(p.date)}`}>
                    Sleep {p.sleepHours ?? '—'} h · stress {p.stressLevel ?? '—'}/10
                    {p.symptoms.length > 0 && <span className="text-slate-500"> · {p.symptoms.join(', ')}</span>}
                    {p.seizures.length > 0 && <Badge tone="rose" className="ml-2">{plural(p.seizures.length, 'seizure')}</Badge>}
                  </button>
                ) : (
                  <span className="flex-1 text-slate-500">
                    No check-in (missing)
                    {p.seizures.length > 0 && <Badge tone="rose" className="ml-2">{plural(p.seizures.length, 'seizure')}</Badge>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<Search size={18} />}>Active insights</CardTitle>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Personal patterns (calculated)</h3>
          <ul className="space-y-2">
            {active.map((f) => (
              <li key={f.id}>
                <a href={`#/patterns`} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:border-teal-300">
                  <span>{f.title}</span>
                  <StatusBadge status={f.status} />
                </a>
              </li>
            ))}
            {!active.length && <EmptyState>No possible patterns in this period.</EmptyState>}
          </ul>
          <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Connections for clinician review</h3>
          <ul className="space-y-2">
            {surfaced.map((c) => (
              <li key={c.id}>
                <a href="#/connections" className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:border-teal-300">
                  <Link2 size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
                  <span>{c.title}</span>
                </a>
              </li>
            ))}
            {!surfaced.length && <EmptyState>No connections surfaced.</EmptyState>}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {findings.length} analyses run: {Object.entries(countBy(findings.map((f) => STATUS_LABELS[f.status]))).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}.
          </p>
        </Card>
      </div>
    </>
  );
}

function countBy(xs: string[]): Record<string, number> {
  return xs.reduce<Record<string, number>>((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {});
}
