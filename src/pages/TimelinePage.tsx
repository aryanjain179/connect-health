import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { menstrualModuleOn, seizureModuleOn } from '../conditions/checkin';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardTitle, PageHeader, cx, inputClass } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import { buildDailySeries, type DayPoint } from '../analysis/series';
import { addDays, formatDate, isValidISODate, maxDate, minDate } from '../analysis/dates';
import { dataDates } from '../analysis/context';
import { SleepChart } from '../components/charts/SleepChart';
import { CycleStrip } from '../components/charts/CycleStrip';
import { PHASE_LABELS } from '../analysis/cycle';
import { BASIS_LABELS } from '../components/charts/phase';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { duration } from '../analysis/format';
import { describeMeasures } from '../conditions/checkin';
import { FlagDialog, FlagMarkerList } from '../components/review/FlagDialog';
import { flagsOnDate, type ReviewFlag } from '../review/flags';
import { getOutcome } from '../analysis/outcomes';

type Layer = 'flags' | 'seizures' | 'sleep' | 'cycle' | 'meds' | 'symptoms' | 'checkins';
const LAYERS: Array<{ id: Layer; label: string }> = [
  { id: 'flags', label: 'Clinician-review markers' },
  { id: 'seizures', label: 'Seizures' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'cycle', label: 'Menstrual cycle' },
  { id: 'meds', label: 'Medication changes' },
  { id: 'symptoms', label: 'Other symptoms' },
  { id: 'checkins', label: 'Check-ins / missing' },
];

function Lane({ label, points, render, onSelect, selected }: { label: string; points: DayPoint[]; render: (p: DayPoint) => { cls: string; title: string; content?: ReactNode }; onSelect: (d: string) => void; selected: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 shrink-0 text-xs font-medium text-slate-600">{label}</div>
      <div className="flex h-6 flex-1 gap-px">
        {points.map((p) => {
          const r = render(p);
          return (
            <button
              key={p.date}
              type="button"
              title={r.title}
              aria-label={r.title}
              onClick={() => onSelect(p.date)}
              className={cx('flex min-w-[6px] flex-1 items-center justify-center rounded-[2px] text-[9px] font-bold', r.cls, selected === p.date && 'ring-2 ring-slate-900 ring-inset')}
            >
              {r.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sleepCls(h: number | null, t: number) {
  if (h === null) return 'bg-white ring-1 ring-inset ring-slate-200';
  if (h < t - 1) return 'bg-teal-900/80';
  if (h < t) return 'bg-teal-700/70';
  if (h < t + 1.5) return 'bg-teal-400/60';
  return 'bg-teal-200/70';
}

export function TimelinePage({ initialDate }: { initialDate?: string | null }) {
  const { state } = useHealthData();
  const { window: analysisWindow, flags, outcome } = useAnalysis();
  const [dialog, setDialog] = useState<ReviewFlag | null>(null);
  const { openEditor, requestDelete } = useEditor();
  const data = state.data;
  const all = dataDates(data);
  const minD = minDate(all) ?? analysisWindow.start;
  const maxD = maxDate(all) ?? analysisWindow.end;

  const [range, setRange] = useState(() => ({
    start: initialDate && initialDate < analysisWindow.start ? addDays(initialDate, -14) : analysisWindow.start,
    end: initialDate && initialDate > analysisWindow.end ? initialDate : analysisWindow.end,
  }));
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ flags: true, seizures: true, sleep: true, cycle: true, meds: true, symptoms: true, checkins: true });
  const [selected, setSelected] = useState<string | null>(initialDate && isValidISODate(initialDate) ? initialDate : null);
  useEffect(() => {
    if (initialDate && isValidISODate(initialDate)) setSelected(initialDate);
  }, [initialDate]);
  const seizureTracking = seizureModuleOn(data);
  const cycleTracking = menstrualModuleOn(data);
  const visibleLayers = LAYERS.filter((l) => (l.id !== 'seizures' || seizureTracking) && (l.id !== 'cycle' || cycleTracking));
  const valid = isValidISODate(range.start) && isValidISODate(range.end) && range.start <= range.end;
  const win = valid ? range : analysisWindow;
  const series = useMemo(() => buildDailySeries(data, win, outcome ?? 'seizures'), [data, win, outcome]);
  const eventLabel = getOutcome(outcome ?? 'seizures').label.replace(/s$/, '');
  const t = state.settings.sleepThresholdHours;
  const day = selected ? series.find((p) => p.date === selected) ?? buildDailySeries(data, { start: selected, end: selected })[0] : null;

  const preset = (days: number | 'all') => {
    if (days === 'all') setRange({ start: minD, end: maxD });
    else setRange({ start: addDays(maxD, -(days - 1)), end: maxD });
  };

  return (
    <>
      <PageHeader
        title="Health Timeline"
        description="Seizures, sleep, cycle phase, medication changes and symptoms aligned day by day. Select any day to inspect, edit or delete its records."
      />
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="tl-start" className="block text-xs font-medium text-slate-600">
              From
            </label>
            <input id="tl-start" type="date" className={inputClass} value={range.start} min={minD} max={maxD} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="tl-end" className="block text-xs font-medium text-slate-600">
              To
            </label>
            <input id="tl-end" type="date" className={inputClass} value={range.end} min={minD} max={maxD} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={() => preset(14)}>Last 14 days</Button>
            <Button size="sm" onClick={() => preset(30)}>Last 30 days</Button>
            <Button size="sm" onClick={() => preset(90)}>Last 90 days</Button>
            <Button size="sm" onClick={() => preset('all')}>All</Button>
          </div>
          {!valid && <p className="text-xs font-medium text-rose-700" role="alert">“From” must be on or before “To”. Showing the analysis period instead.</p>}
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-slate-600">Layers</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {visibleLayers.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" className="accent-teal-700" checked={layers[l.id]} onChange={(e) => setLayers((s) => ({ ...s, [l.id]: e.target.checked }))} />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {layers.sleep && (
            <Card>
              <CardTitle icon={<CalendarRange size={18} />} sub="Click a day on the chart to inspect it">
                Sleep and seizure days
              </CardTitle>
              <SleepChart points={series} threshold={t} onSelect={setSelected} flags={layers.flags ? flags : []} onFlagClick={(f) => setDialog(f)} eventLabel={eventLabel} />
              {layers.flags && <FlagMarkerList flags={flags} onOpen={setDialog} />}
            </Card>
          )}
          <Card>
            <CardTitle sub={`${formatDate(win.start, true)} – ${formatDate(win.end, true)} · ${series.length} days`}>Aligned lanes</CardTitle>
            <div className="overflow-x-auto">
              <div className="min-w-[640px] space-y-2">
                {layers.flags && flags.length > 0 && (
                  <Lane label="Review markers" points={series} onSelect={setSelected} selected={selected} render={(p) => {
                    const f = flagsOnDate(flags, p.date);
                    return { cls: f.some((x) => x.level === 'red') ? 'bg-rose-600 text-white' : f.length ? 'bg-amber-400' : 'bg-slate-50', title: `${formatDate(p.date)}: ${f.length ? f.map((x) => x.title).join('; ') : 'no review marker'}`, content: f.length ? '!' : null };
                  }} />
                )}
                {layers.seizures && seizureTracking && (
                  <Lane label="Seizures" points={series} onSelect={setSelected} selected={selected} render={(p) => ({
                    cls: p.seizures.length ? (p.seizures.some((s) => s.severity === 'severe') ? 'bg-rose-700 text-white' : 'bg-slate-800 text-white') : 'bg-slate-50',
                    title: `${formatDate(p.date)}: ${p.seizures.length} seizure(s)`,
                    content: p.seizures.length > 1 ? p.seizures.length : null,
                  })} />
                )}
                {layers.sleep && (
                  <Lane label="Sleep (h)" points={series} onSelect={setSelected} selected={selected} render={(p) => ({
                    cls: sleepCls(p.sleepHours, t),
                    title: `${formatDate(p.date)}: ${p.sleepHours === null ? 'sleep not recorded' : `${p.sleepHours} h`}`,
                    content: p.sleepHours === null ? <span className="text-slate-300">·</span> : null,
                  })} />
                )}
                {layers.meds && (
                  <Lane label="Medication" points={series} onSelect={setSelected} selected={selected} render={(p) => ({
                    cls: p.meds.some((m) => m.kind === 'dose-change' || m.kind === 'start' || m.kind === 'stop') ? 'bg-violet-600 text-white' : p.meds.some((m) => m.kind === 'missed-dose') ? 'bg-amber-400' : p.meds.length ? 'bg-violet-200' : 'bg-slate-50',
                    title: `${formatDate(p.date)}: ${p.meds.map((m) => m.label).join('; ') || 'no medication events'}`,
                    content: p.meds.some((m) => m.kind === 'missed-dose') ? '!' : null,
                  })} />
                )}
                {layers.symptoms && (
                  <Lane label="Other symptoms" points={series} onSelect={setSelected} selected={selected} render={(p) => ({
                    cls: !p.checkIn ? 'bg-white ring-1 ring-inset ring-slate-200' : p.symptoms.length ? 'bg-sky-400' : 'bg-slate-50',
                    title: `${formatDate(p.date)}: ${!p.checkIn ? 'no check-in' : p.symptoms.join(', ') || 'none reported'}`,
                    content: p.symptoms.length > 1 ? p.symptoms.length : null,
                  })} />
                )}
                {layers.checkins && (
                  <Lane label="Check-in" points={series} onSelect={setSelected} selected={selected} render={(p) => ({
                    cls: p.checkIn ? 'bg-emerald-200' : 'bg-rose-100 text-rose-700',
                    title: `${formatDate(p.date)}: ${p.checkIn ? 'check-in recorded' : 'MISSING – no check-in'}`,
                    content: p.checkIn ? null : '×',
                  })} />
                )}
                {layers.cycle && cycleTracking && (
                  <div className="flex gap-2">
                    <div className="w-32 shrink-0 pt-5 text-xs font-medium text-slate-600">Cycle phase</div>
                    <div className="flex-1">
                      <CycleStrip points={series} onSelect={setSelected} selected={selected} eventLabel={eventLabel} showEvents={false} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Sleep lane: darker = shorter night; white with a dot = not recorded. Medication lane: purple = start/stop/dose change, amber “!” = missed dose, light purple = side-effect report. Check-in lane: “×” = missing day.
            </p>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-20 xl:self-start" aria-labelledby="inspector-title">
          <CardTitle id="inspector-title">{day ? formatDate(day.date, true) : 'Day inspector'}</CardTitle>
          {!day && <p className="text-sm text-slate-500">Select a day in the chart or lanes to see every record for that date.</p>}
          {day && <DayInspector day={day} onEdit={openEditor} onDelete={requestDelete} threshold={t} flags={flagsOnDate(flags, day.date)} onFlag={setDialog} />}
        </Card>
      </div>
      <FlagDialog flag={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function DayInspector({ day, onEdit, onDelete, threshold, flags, onFlag }: { day: DayPoint; onEdit: ReturnType<typeof useEditor>['openEditor']; onDelete: ReturnType<typeof useEditor>['requestDelete']; threshold: number; flags: ReviewFlag[]; onFlag: (f: ReviewFlag) => void }) {
  const { state } = useHealthData();
  const o = day.checkIn;
  const show = (v: unknown) => (v === null || v === undefined ? <span className="text-slate-400">not recorded</span> : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
  const history = state.data.history.filter((h) => h.date === day.date);
  // Use stored seizure records (the chart series may contain symptom-day markers for other outcomes).
  const seizuresToday = state.data.seizures.filter((s) => s.date === day.date).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  return (
    <div className="space-y-5 text-sm">
      {flags.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-800">Clinician-review markers on this date</h3>
          <FlagMarkerList flags={flags} onOpen={onFlag} />
        </section>
      )}
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Seizures ({seizuresToday.length})</h3>
          <Button size="sm" onClick={() => onEdit({ kind: 'seizure', defaults: { date: day.date } })}>
            <Plus size={14} aria-hidden="true" /> Add
          </Button>
        </div>
        {seizuresToday.length === 0 && <p className="text-slate-500">None recorded{o ? '' : ' (no check-in that day)'}.</p>}
        <ul className="space-y-2">
          {seizuresToday.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {s.time ?? 'time unknown'} · {SEIZURE_TYPE_LABELS[s.type]}
                  </p>
                  <p className="text-slate-600">
                    {duration(s.durationSeconds)} · {s.severity ?? 'severity not recorded'} · recovery {s.recoveryMinutes ?? '—'} min
                  </p>
                  {(s.preSymptoms.length > 0 || s.postSymptoms.length > 0) && (
                    <p className="text-xs text-slate-500">
                      Before: {s.preSymptoms.join(', ') || '—'} · After: {s.postSymptoms.join(', ') || '—'}
                    </p>
                  )}
                  {s.notes && <p className="text-xs text-slate-500">{s.notes}</p>}
                </div>
                <RowActions onEdit={() => onEdit({ kind: 'seizure', record: s })} onDelete={() => onDelete('seizure', s.id, 'seizure event')} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Daily check-in</h3>
          {o ? (
            <RowActions onEdit={() => onEdit({ kind: 'observation', record: o })} onDelete={() => onDelete('observation', o.id, 'daily check-in')} />
          ) : (
            <Button size="sm" onClick={() => onEdit({ kind: 'observation', defaults: { date: day.date } })}>
              <Plus size={14} aria-hidden="true" /> Add
            </Button>
          )}
        </div>
        {o ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-slate-500">Sleep</dt>
            <dd>
              {show(o.sleepHours)}
              {o.sleepHours !== null && ' h'} {o.sleepHours !== null && o.sleepHours < threshold && <Badge tone="amber">short</Badge>}
            </dd>
            <dt className="text-slate-500">Sleep quality</dt>
            <dd>{show(o.sleepQuality)}</dd>
            <dt className="text-slate-500">Stress</dt>
            <dd>{show(o.stressLevel)}</dd>
            <dt className="text-slate-500">Illness</dt>
            <dd>{show(o.illness)}</dd>
            <dt className="text-slate-500">Headache</dt>
            <dd>{show(o.headache)}</dd>
            <dt className="text-slate-500">Dizziness</dt>
            <dd>{show(o.dizziness)}</dd>
            <dt className="text-slate-500">Attention difficulty</dt>
            <dd>{show(o.attentionDifficulty)}</dd>
            <dt className="text-slate-500">Other</dt>
            <dd>{o.otherSymptoms.join(', ') || '—'}</dd>
            {describeMeasures(o).map((m) => (
              <div key={m} className="col-span-2 text-slate-700">{m}</div>
            ))}
          </dl>
        ) : (
          <p className="rounded-md bg-rose-50 p-2 text-rose-800">No check-in for this day. It is treated as missing – not as a day without seizures or symptoms.</p>
        )}
      </section>

      <section>
        <h3 className="mb-1 font-semibold text-slate-800">Menstrual cycle</h3>
        {day.cycle?.phase ? (
          <p>
            Cycle day {day.cycle.cycleDay > 0 ? day.cycle.cycleDay : '–'} · {PHASE_LABELS[day.cycle.phase]}{' '}
            <Badge tone={day.cycle.basis === 'recorded' ? 'teal' : 'amber'}>{BASIS_LABELS[day.cycle.basis]}</Badge>
            {day.cycle.note && <span className="mt-1 block text-xs text-slate-500">{day.cycle.note}</span>}
          </p>
        ) : (
          <p className="text-slate-500">Phase unknown for this date.</p>
        )}
      </section>

      <section>
        <h3 className="mb-1 font-semibold text-slate-800">Medication events</h3>
        {day.meds.length === 0 && <p className="text-slate-500">None recorded.</p>}
        <ul className="space-y-1">
          {day.meds.map((m, i) => {
            const ev = m.eventId ? state.data.medicationEvents.find((e) => e.id === m.eventId) : null;
            const med = state.data.medications.find((x) => x.id === m.medicationId);
            return (
              <li key={i} className="flex items-start justify-between gap-2">
                <span>{m.label}</span>
                {ev ? (
                  <RowActions onEdit={() => onEdit({ kind: 'medicationEvent', record: ev })} onDelete={() => onDelete('medicationEvent', ev.id, 'medication event')} />
                ) : med ? (
                  <RowActions onEdit={() => onEdit({ kind: 'medication', record: med })} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {history.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-800">Reported symptoms & history</h3>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-2">
                <span>{h.label}</span>
                <RowActions onEdit={() => onEdit({ kind: 'history', record: h })} onDelete={() => onDelete('history', h.id, 'history record')} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      {onEdit && (
        <button type="button" onClick={onEdit} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Edit">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
