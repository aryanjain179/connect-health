import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, ClipboardPlus, MessageSquareText } from 'lucide-react';
import type { PatternFinding } from '../models/analysis';
import { Badge, Button, Card } from './ui';
import { StatusBadge } from './labels';
import { formatWindow } from '../analysis/dates';
import { per30, pct, plural, pValue, ratio } from '../analysis/format';
import { evidenceById, formatCitation } from '../clinical/knowledgeBase';

const FACTOR_LABELS: Record<PatternFinding['factor'], string> = {
  sleep: 'Sleep',
  'menstrual-cycle': 'Menstrual cycle',
  medication: 'Medication change',
  stress: 'Stress',
  trend: 'Change over time',
};

export function EvidenceLinks({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <ul className="space-y-1">
      {ids.map((id) => {
        const e = evidenceById(id);
        if (!e) return null;
        return (
          <li key={id} className="text-xs text-slate-600">
            <a href={e.url} target="_blank" rel="noreferrer noopener" className="font-medium text-teal-800 underline decoration-teal-300 underline-offset-2 hover:decoration-teal-700">
              {e.citation.authors.includes(',') ? `${e.citation.authors.split(',')[0]} et al.` : e.citation.authors} ({e.citation.year}) – {e.citation.journal}
            </a>
            <span className="block">{formatCitation(e)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function InsightCard({ finding: f, onCreateTask }: { finding: PatternFinding; onCreateTask: (f: PatternFinding) => void }) {
  const suppressed = f.status === 'insufficient-data' || f.status === 'not-applicable';
  const useSeizureDays = f.stats?.metric === 'seizure-day proportion';
  const chartData = f.groups.map((g) => ({
    name: g.label,
    value: useSeizureDays ? (g.seizureDayRate ?? 0) * 100 : (g.eventRate ?? 0) * 30,
  }));

  return (
    <Card as="article" className="flex flex-col gap-4" aria-labelledby={`${f.id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge tone="violet">Personal pattern · calculated</Badge>
            <Badge>{FACTOR_LABELS[f.factor]}</Badge>
            <StatusBadge status={f.status} />
          </div>
          <h3 id={`${f.id}-title`} className="text-base font-semibold text-slate-900">
            {f.title}
          </h3>
        </div>
        {!suppressed && (
          <Button size="sm" onClick={() => onCreateTask(f)}>
            <ClipboardPlus size={14} aria-hidden="true" /> Create follow-up task
          </Button>
        )}
      </header>

      <p className="text-sm text-slate-700">{f.explanation}</p>

      <dl className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Observation window</dt>
          <dd className="font-medium text-slate-800">
            {formatWindow(f.window)} ({f.window.calendarDays} days)
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Data completeness</dt>
          <dd className="font-medium text-slate-800">
            {f.completeness.eligibleDays} of {f.completeness.calendarDays} days eligible ({pct(f.completeness.calendarDays ? f.completeness.eligibleDays / f.completeness.calendarDays : null, 0)})
          </dd>
        </div>
        {f.stats && !suppressed && (
          <div>
            <dt className="text-slate-500">Comparison ({f.stats.metric})</dt>
            <dd className="font-medium text-slate-800">
              ratio {ratio(f.stats.rateRatio)} · exploratory p {pValue(f.stats.pValue)}
            </dd>
          </div>
        )}
      </dl>

      {f.suppressionReason && suppressed && <p className="rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-600">Suppressed: {f.suppressionReason}</p>}

      {f.groups.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="overflow-x-auto lg:col-span-3">
            <table className="w-full text-left text-xs">
              <caption className="mb-1 text-left text-xs font-semibold text-slate-700">Supporting data</caption>
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1 pr-2 font-medium">Group</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Eligible days</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Seizure days</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Events</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Seizure-day %</th>
                  <th scope="col" className="py-1 font-medium">Events / 30 d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {f.groups.map((g) => (
                  <tr key={g.label}>
                    <th scope="row" className="py-1 pr-2 font-medium text-slate-800">{g.label}</th>
                    <td className="py-1 pr-2">{g.eligibleDays}</td>
                    <td className="py-1 pr-2">{g.seizureDays}</td>
                    <td className="py-1 pr-2">{g.events}</td>
                    <td className="py-1 pr-2">{pct(g.seizureDayRate)}</td>
                    <td className="py-1">{per30(g.eventRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {f.stats && !suppressed && (
              <p className="mt-2 text-xs text-slate-500">
                {f.stats.test}. Rate difference {f.stats.rateDifference === null ? '—' : useSeizureDays ? `${(f.stats.rateDifference * 100).toFixed(1)} percentage points` : `${per30(f.stats.rateDifference)} events per 30 days`}.
              </p>
            )}
          </div>
          {!suppressed && (
            <figure className="lg:col-span-2">
              <div className="h-40" role="img" aria-label={`Bar chart of ${useSeizureDays ? 'seizure-day percentage' : 'events per 30 days'} by group`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [useSeizureDays ? `${Number(v).toFixed(1)}%` : Number(v).toFixed(1), useSeizureDays ? 'Seizure-day %' : 'Events per 30 days']} />
                    <Bar dataKey="value" fill="#0f766e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="text-center text-[11px] text-slate-500">{useSeizureDays ? 'Seizure-day % by group' : 'Events per 30 observed days by group'}</figcaption>
            </figure>
          )}
        </div>
      )}

      {f.sensitivity && !suppressed && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold">Sensitivity check – {f.sensitivity.label}:</span>{' '}
          {f.sensitivity.groups.map((g) => `${g.label} ${g.seizureDays}/${g.eligibleDays} (${pct(g.seizureDayRate)})`).join(' vs ')}; ratio {ratio(f.sensitivity.stats?.rateRatio ?? null)}, p {pValue(f.sensitivity.stats?.pValue ?? null)}.
        </p>
      )}

      {f.details.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
          {f.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 text-xs md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-semibold text-slate-700">Potential confounders</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
            {f.confounderOverlap.map((o) => (
              <li key={o.factor}>
                {o.factor}: {o.count} of {o.of} seizure days in the exposed group
              </li>
            ))}
            {f.confounders.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {f.exclusions.length > 0 && (
            <>
              <h4 className="mt-3 mb-1 font-semibold text-slate-700">Excluded days</h4>
              <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
                {f.exclusions.map((e) => (
                  <li key={e.reason}>
                    {e.reason}: {plural(e.days, 'day')} ({plural(e.events, 'seizure event')} not used in the comparison)
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-slate-700">Limitations</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
            {f.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Method</summary>
        <p className="mt-1">{f.method}</p>
      </details>

      {f.evidenceIds.length > 0 && (
        <div>
          <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
            <BookOpen size={13} aria-hidden="true" /> Population-level evidence (context only)
          </h4>
          <EvidenceLinks ids={f.evidenceIds} />
        </div>
      )}

      <p className="flex gap-2 rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-sm text-teal-900">
        <MessageSquareText size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Suggested clinician discussion point: </span>
          {f.discussionPoint}
        </span>
      </p>
    </Card>
  );
}
