import { useMemo, useState } from 'react';
import { menstrualModuleOn, seizureModuleOn } from '../conditions/checkin';
import { Activity, AlertTriangle, ArrowRight, BedDouble, CalendarClock, ClipboardCheck, Flag, HeartPulse, Link2, Pill, Search, UserRound } from 'lucide-react';
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Stat } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import { SleepChart } from '../components/charts/SleepChart';
import { CycleStrip } from '../components/charts/CycleStrip';
import { FlagDialog, FlagMarkerList } from '../components/review/FlagDialog';
import { TodayCard } from '../components/TodayCard';
import { buildDailySeries } from '../analysis/series';
import { formatDate, formatWindow } from '../analysis/dates';
import { duration, plural } from '../analysis/format';
import { SEIZURE_TYPE_LABELS, SEX_LABELS, type GoalId } from '../models/types';
import { currentMedications, doseOn, pastMedications } from '../analysis/medicationInfo';
import { medicationAllergyWarnings } from '../conditions/allergies';
import { summarizeSleep } from '../analysis/completeness';
import { getOutcome } from '../analysis/outcomes';
import { STATUS_LABELS } from '../analysis';
import { StatusBadge, historyStatusTone, sourceLabel } from '../components/labels';
import type { ReviewFlag } from '../review/flags';

const GOAL_LINKS: Record<GoalId, { label: string; href: string }> = {
  'understand-patterns': { label: 'See patterns in your data', href: '#/patterns' },
  'prepare-appointments': { label: 'Prepare your clinician report', href: '#/summary' },
  'organize-medications': { label: 'Organise medications and history', href: '#/records' },
  'explore-connections': { label: 'Explore potential connections', href: '#/connections' },
  'find-specialists': { label: 'Find specialists worth discussing', href: '#/navigator' },
  'insurance-referrals': { label: 'Plan insurance and referral steps', href: '#/navigator' },
  'track-factors': { label: 'Log today in the Voice Journal', href: '#/journal' },
  'share-caregiver': { label: 'Set up sharing with someone you trust', href: '#/settings' },
};

export function OverviewPage() {
  const { state, isDemo } = useHealthData();
  const { window, seizures, completeness, findings, connections, flags, outcome } = useAnalysis();
  const { openEditor } = useEditor();
  const [dialog, setDialog] = useState<ReviewFlag | null>(null);
  const data = state.data;
  const p = data.profile;
  const seizureTracking = seizureModuleOn(data);
  const cycleTracking = menstrualModuleOn(data);
  const series = useMemo(() => buildDailySeries(data, window, outcome ?? 'seizures'), [data, window, outcome]);
  const sleep = useMemo(() => summarizeSleep(data, window, state.settings.sleepThresholdHours), [data, window, state.settings.sleepThresholdHours]);
  const conditions = data.history.filter((h) => h.kind === 'diagnosis' || h.kind === 'symptom');
  const current = currentMedications(data, window.end);
  const past = pastMedications(data, window.end);
  const allergyWarnings = medicationAllergyWarnings(data.allergies, current);
  const active = findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change');
  const surfaced = connections.filter((c) => c.surfaced);
  const recent = [...series].reverse().slice(0, 7);
  const last = seizures.mostRecentOverall;
  const outcomeDays = outcome && outcome !== 'seizures' ? series.filter((d) => d.seizures.length).length : null;
  const noData = !data.observations.length && !data.seizures.length;
  const goals = p.goals ?? [];

  return (
    <>
      <PageHeader
        title={isDemo ? 'Overview' : `Welcome${p.preferredName || p.displayName ? `, ${p.preferredName || p.displayName.split(' ')[0]}` : ''}`}
        description={<>Your longitudinal picture · {formatWindow(window)}. Everything here is calculated from {isDemo ? 'the synthetic demo records' : 'the records you have entered'}.</>}
      />

      <TodayCard />

      {noData && (
        <Card className="mb-6">
          <CardTitle icon={<HeartPulse size={18} />} sub="Patterns appear once there is enough recorded data – usually a few weeks of check-ins.">
            Start building your record
          </CardTitle>
          <p className="text-sm text-slate-600">Check in each day using the buttons above. You can also add your medications so they appear in reports.</p>
          <div className="mt-3">
            <Button onClick={() => openEditor({ kind: 'medication' })}>Add a medication</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {seizureTracking ? (
          <>
            <Stat icon={<Activity size={14} />} label="Seizure events" value={seizures.totalEvents} sub={`on ${plural(seizures.seizureDays, 'day')} in the period`} />
            <Stat icon={<CalendarClock size={14} />} label="Most recent seizure" value={last ? formatDate(last.date) : '—'} sub={last ? `${SEIZURE_TYPE_LABELS[last.type]} · ${duration(last.durationSeconds)}` : 'No seizures recorded'} />
          </>
        ) : (
          <>
            <Stat icon={<Activity size={14} />} label={outcome ? getOutcome(outcome).label : 'Symptom days'} value={outcomeDays ?? '—'} sub={outcome ? 'days reported in the period' : 'No symptom answers yet'} />
            <Stat icon={<Flag size={14} />} label="Review flags" value={flags.length} sub={flags.length ? 'patterns for clinician review' : 'none in this period'} />
          </>
        )}
        <Stat icon={<BedDouble size={14} />} label="Mean sleep" value={sleep.meanHours === null ? '—' : `${sleep.meanHours.toFixed(1)} h`} sub={`${sleep.recordedNights} recorded nights · ${sleep.nightsBelow} < ${sleep.threshold} h`} />
        <Stat icon={<ClipboardCheck size={14} />} label="Check-in days" value={`${completeness.checkInDays}/${completeness.calendarDays}`} sub={`${completeness.missingDays.length} days missing · ${completeness.partialCheckIns} partial`} />
      </div>

      {flags.some((f) => f.level === 'red') && (
        <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            A finding needing prompt clinician review is recorded. See <a className="font-medium underline" href="#/review">Clinician Review</a> for details and emergency guidance.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle icon={<UserRound size={18} />} action={isDemo ? <Badge tone="amber">Synthetic</Badge> : <Badge tone="teal">Your profile</Badge>}>
            Profile, allergies and conditions
          </CardTitle>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium">{p.displayName}</dd>
            <dt className="text-slate-500">Age</dt>
            <dd>{p.age}</dd>
            <dt className="text-slate-500">Sex</dt>
            <dd>
              {SEX_LABELS[p.sex]}
              {p.pronouns ? ` (${p.pronouns})` : ''}
            </dd>
            {p.genderIdentity && (
              <>
                <dt className="text-slate-500">Gender identity</dt>
                <dd>{p.genderIdentity}</dd>
              </>
            )}
          </dl>
          <div className="mt-5 mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Allergies</h3>
            <Button size="sm" variant="ghost" onClick={() => openEditor({ kind: 'allergy' })}>
              Add
            </Button>
          </div>
          {data.allergies.length ? (
            <ul className="space-y-1 text-sm">
              {data.allergies.filter((a) => a.status !== 'resolved').map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left hover:text-teal-800" onClick={() => openEditor({ kind: 'allergy', record: a })}>
                    {a.substance}
                    {a.reaction && <span className="block text-xs text-slate-500">{a.reaction} · {sourceLabel(a.source)}</span>}
                  </button>
                  <Badge tone={a.severity === 'severe' ? 'rose' : a.severity === 'moderate' ? 'amber' : 'slate'}>{a.severity === 'unknown' ? 'severity not recorded' : a.severity}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{p.noKnownAllergies ? 'No known allergies (reported).' : 'Not recorded.'}</p>
          )}
          {allergyWarnings.length > 0 && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              Name match between a current medication and a recorded allergy: {allergyWarnings.map((w) => `${w.med.name} ↔ ${w.allergy.substance}`).join('; ')}. Please confirm with your prescriber or pharmacist.
            </p>
          )}
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-800">Conditions and reported symptoms</h3>
          {p.noKnownConditions && <p className="mb-2 text-sm text-slate-600">No known diagnosed conditions.</p>}
          {conditions.length ? (
            <ul className="space-y-2">
              {conditions.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {d.label}
                    <span className="block text-xs text-slate-500">
                      {d.kind === 'symptom' ? 'Symptom' : 'Diagnosis'} · {sourceLabel(d.source)}
                      {d.date ? ` · ${formatDate(d.date, true)}` : ''}
                    </span>
                  </span>
                  <Badge tone={historyStatusTone(d.status)}>{d.status === 'confirmed' && d.source === 'patient-reported' ? 'diagnosed (self-reported)' : d.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            !p.noKnownConditions && <EmptyState>No conditions recorded. Add them in Records → Symptoms & history.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={<Pill size={18} />} action={<Button size="sm" onClick={() => openEditor({ kind: data.medications.length ? 'medicationEvent' : 'medication' })}>{data.medications.length ? 'Log medication event' : 'Add medication'}</Button>}>
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
                {series.flatMap((d) => d.meds).map((m, i) => (
                  <li key={`${m.date}-${i}`} className="flex gap-2">
                    <span className="w-14 shrink-0 text-slate-500">{formatDate(m.date)}</span>
                    <span>{m.label}</span>
                  </li>
                ))}
                {!series.some((d) => d.meds.length) && <li className="text-slate-500">No medication events in this period.</li>}
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
          <CardTitle icon={<BedDouble size={18} />} sub="Sleep for the night ending on each date, with clinician-review markers">
            Sleep trend
          </CardTitle>
          <SleepChart points={series} threshold={state.settings.sleepThresholdHours} flags={flags} onFlagClick={(f) => setDialog(f)} eventLabel={getOutcome(outcome ?? 'seizures').label.replace(/s$/, '')} />
          <FlagMarkerList flags={flags} onOpen={setDialog} />
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

      {cycleTracking && (
        <Card className="mt-6">
          <CardTitle sub="Estimated cycle phases, counted from the period dates you recorded. Phase day ranges follow a published epilepsy study (Herzog et al. 1997); ovulation is not confirmed.">Menstrual-cycle timeline</CardTitle>
          <CycleStrip points={series} eventLabel={getOutcome(outcome ?? 'seizures').label.replace(/s$/, '').replace(/ days?$/, '')} />
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle icon={<ArrowRight size={18} />} sub={goals.length ? 'Based on the goals you chose' : 'Choose goals in Settings to personalise this'}>
            Suggested next steps
          </CardTitle>
          <ul className="space-y-2">
            {(goals.length ? goals : (['understand-patterns', 'prepare-appointments', 'track-factors'] as GoalId[])).map((g) => (
              <li key={g}>
                <a href={GOAL_LINKS[g].href} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm hover:border-teal-300">
                  {GOAL_LINKS[g].label} <ArrowRight size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<CalendarClock size={18} />} action={<Button size="sm" onClick={() => openEditor({ kind: 'observation' })}>Add check-in</Button>}>
            Recent observations
          </CardTitle>
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((d) => (
              <li key={d.date} className="flex items-start gap-3 py-2">
                <span className="w-14 shrink-0 font-medium text-slate-700">{formatDate(d.date)}</span>
                {d.checkIn ? (
                  <button type="button" className="flex-1 text-left hover:text-teal-800" onClick={() => openEditor({ kind: 'observation', record: d.checkIn! })} aria-label={`Edit check-in for ${formatDate(d.date)}`}>
                    Sleep {d.sleepHours ?? '—'} h · stress {d.stressLevel ?? '—'}/10
                    {d.symptoms.length > 0 && <span className="text-slate-500"> · {d.symptoms.join(', ')}</span>}
                  </button>
                ) : (
                  <span className="flex-1 text-slate-500">No check-in (missing)</span>
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
                <a href="#/patterns" className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:border-teal-300">
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
            {findings.length} analyses run{findings.length ? `: ${Object.entries(countBy(findings.map((f) => STATUS_LABELS[f.status]))).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}` : ' – not enough data yet'}.
          </p>
        </Card>
      </div>
      <FlagDialog flag={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function countBy(xs: string[]): Record<string, number> {
  return xs.reduce<Record<string, number>>((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {});
}
