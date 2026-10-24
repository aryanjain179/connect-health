import { useState } from 'react';
import type { DayPoint } from '../../analysis/series';
import { PHASE_LABELS, type CyclePhase } from '../../analysis/cycle';
import { formatDate } from '../../analysis/dates';
import { cx } from '../ui';
import { BASIS_LABELS, PHASE_COLORS } from './phase';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (d: string) => WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];

function describe(p: DayPoint, eventLabel: string): string {
  const c = p.cycle;
  const parts = [`${weekday(p.date)}, ${formatDate(p.date, true)}`];
  if (c?.phase) parts.push(`cycle day ${c.cycleDay > 0 ? c.cycleDay : '–'}`, `${PHASE_LABELS[c.phase]} (${BASIS_LABELS[c.basis]})`);
  else parts.push('phase unknown');
  if (c?.cycleDay === 1 && c.basis === 'recorded') parts.push('period started');
  if (p.seizures.length) parts.push(`${p.seizures.length} ${eventLabel.toLowerCase()}${p.seizures.length > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

interface Props {
  points: DayPoint[];
  onSelect?: (date: string) => void;
  selected?: string | null;
  /** Singular label for event dots, e.g. "Seizure". */
  eventLabel?: string;
  /** Show the dated list of period starts and events below the strip. */
  showEvents?: boolean;
}

/**
 * Menstrual-cycle phase strip with dates: weekly date ticks, labelled period starts, dated event markers, a detail
 * line for the hovered/selected day, and (optionally) a dated list of events.
 * Solid = recorded period; hatched = estimated; faded + hatched = projected.
 */
export function CycleStrip({ points, onSelect, selected, eventLabel = 'Seizure', showEvents = true }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (!points.some((p) => p.cycle)) return <p className="text-sm text-slate-500">No menstrual-cycle records – cycle timing is not shown (not interpreted as absent).</p>;

  const n = points.length;
  const pos = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const starts = points.map((p, i) => ({ p, i })).filter(({ p }) => p.cycle?.cycleDay === 1 && p.cycle.basis === 'recorded');
  // Weekly ticks on Mondays (plus the first day when the range is short).
  const ticks = points.map((p, i) => ({ p, i })).filter(({ p, i }) => (n <= 21 ? true : weekday(p.date) === 'Mon') || i === 0);
  const tickEvery = n <= 21 ? 2 : 1;
  const eventDays = points.map((p, i) => ({ p, i })).filter(({ p }) => p.seizures.length > 0);
  const focus = points.find((p) => p.date === (active ?? selected)) ?? null;

  return (
    <figure>
      {/* Period-start labels */}
      <div className="relative h-5 text-[10px] font-medium text-rose-700" aria-hidden="true">
        {starts.map(({ p, i }) => (
          <span key={p.date} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(i) }}>
            ▼ {formatDate(p.date)}
          </span>
        ))}
      </div>

      {/* Event markers (dated, focusable) */}
      <div className="relative h-4">
        {eventDays.map(({ p, i }) => (
          <button
            key={p.date}
            type="button"
            className={cx('absolute top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-slate-800 hover:ring-2 hover:ring-teal-400 focus-visible:ring-2', (active ?? selected) === p.date && 'ring-2 ring-teal-500')}
            style={{ left: pos(i) }}
            aria-label={describe(p, eventLabel)}
            title={describe(p, eventLabel)}
            onMouseEnter={() => setActive(p.date)}
            onFocus={() => setActive(p.date)}
            onMouseLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onClick={() => (onSelect ? onSelect(p.date) : setActive(p.date))}
          />
        ))}
      </div>

      {/* Phase cells */}
      <div className="mt-1 flex h-7 gap-px overflow-hidden rounded" role="list" aria-label="Cycle phase by day" onMouseLeave={() => setActive(null)}>
        {points.map((p) => {
          const c = p.cycle;
          const label = describe(p, eventLabel);
          const cls = cx('flex-1', c?.phase ? PHASE_COLORS[c.phase] : 'bg-slate-100', c && c.basis !== 'recorded' && 'hatch', c?.basis === 'projected' && 'opacity-50', (selected === p.date || active === p.date) && 'ring-2 ring-slate-900 ring-inset');
          return onSelect ? (
            <button key={p.date} type="button" role="listitem" title={label} aria-label={label} className={cls} onMouseEnter={() => setActive(p.date)} onClick={() => onSelect(p.date)} />
          ) : (
            <div key={p.date} role="listitem" title={label} aria-label={label} className={cls} onMouseEnter={() => setActive(p.date)} />
          );
        })}
      </div>

      {/* Weekly date axis */}
      <div className="relative h-8" aria-hidden="true">
        {ticks.map(({ p, i }, k) => (
          <span key={p.date} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(i) }}>
            <span className="h-1.5 w-px bg-slate-400" />
            {k % tickEvery === 0 && <span className="mt-0.5 text-[10px] whitespace-nowrap text-slate-500">{formatDate(p.date)}</span>}
          </span>
        ))}
      </div>

      <p className="min-h-5 text-xs text-slate-700" aria-live="polite">
        {focus ? describe(focus, eventLabel) : 'Hover over (or tap) a day or a dot to see its exact date, cycle day and phase.'}
      </p>

      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {(Object.keys(PHASE_COLORS) as CyclePhase[]).map((ph) => (
          <span key={ph} className="flex items-center gap-1">
            <span className={cx('inline-block h-3 w-3 rounded-sm', PHASE_COLORS[ph])} aria-hidden="true" /> {PHASE_LABELS[ph]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="hatch inline-block h-3 w-3 rounded-sm bg-slate-300" aria-hidden="true" /> Hatched = estimated
        </span>
        <span className="flex items-center gap-1">
          <span className="hatch inline-block h-3 w-3 rounded-sm bg-slate-300 opacity-50" aria-hidden="true" /> Faded = projected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-800" aria-hidden="true" /> {eventLabel} day
        </span>
        <span className="flex items-center gap-1 text-rose-700">▼ Period started (recorded)</span>
      </figcaption>

      {showEvents && (starts.length > 0 || eventDays.length > 0) && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Dated list of period starts and {eventLabel.toLowerCase()}s ({starts.length + eventDays.length})</summary>
          <div className="mt-2 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1 pr-2 font-medium">Date</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Event</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Cycle day</th>
                  <th scope="col" className="py-1 font-medium">Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...starts.map(({ p }) => ({ p, what: 'Period started' })), ...eventDays.map(({ p }) => ({ p, what: `${p.seizures.length} ${eventLabel.toLowerCase()}${p.seizures.length > 1 ? 's' : ''}` }))]
                  .sort((a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.what.localeCompare(b.what)))
                  .map(({ p, what }) => (
                    <tr key={p.date + what}>
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {onSelect ? (
                          <button type="button" className="text-teal-800 underline" onClick={() => onSelect(p.date)}>
                            {weekday(p.date)} {formatDate(p.date, true)}
                          </button>
                        ) : (
                          <a className="text-teal-800 underline" href={`#/timeline?date=${p.date}`}>
                            {weekday(p.date)} {formatDate(p.date, true)}
                          </a>
                        )}
                      </td>
                      <td className="py-1 pr-2">{what}</td>
                      <td className="py-1 pr-2">{p.cycle && p.cycle.cycleDay > 0 ? p.cycle.cycleDay : '–'}</td>
                      <td className="py-1">{p.cycle?.phase ? `${PHASE_LABELS[p.cycle.phase]} (${BASIS_LABELS[p.cycle.basis]})` : 'unknown'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
