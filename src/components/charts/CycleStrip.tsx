import type { DayPoint } from '../../analysis/series';
import { PHASE_LABELS, type CyclePhase } from '../../analysis/cycle';
import { formatDate } from '../../analysis/dates';
import { cx } from '../ui';
import { BASIS_LABELS, PHASE_COLORS } from './phase';

/** Menstrual-cycle phase strip. Solid = recorded period; hatched = estimated; faded + hatched = projected. */
export function CycleStrip({ points, onSelect, selected }: { points: DayPoint[]; onSelect?: (date: string) => void; selected?: string | null }) {
  if (!points.some((p) => p.cycle)) return <p className="text-sm text-slate-500">No menstrual-cycle records – cycle timing is not shown (not interpreted as absent).</p>;
  const tick = (i: number) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2);
  return (
    <figure>
      <div className="flex h-4 items-end gap-px" aria-hidden="true">
        {points.map((p) => (
          <div key={p.date} className="flex flex-1 justify-center">
            {p.seizures.length > 0 && <span className="h-2 w-2 rounded-full bg-slate-800" />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex h-7 gap-px overflow-hidden rounded" role="list" aria-label="Cycle phase by day">
        {points.map((p) => {
          const c = p.cycle;
          const label = c?.phase
            ? `${formatDate(p.date)}: cycle day ${c.cycleDay > 0 ? c.cycleDay : '–'}, ${PHASE_LABELS[c.phase]} (${BASIS_LABELS[c.basis]})${p.seizures.length ? `, ${p.seizures.length} seizure(s)` : ''}`
            : `${formatDate(p.date)}: phase unknown`;
          const cls = cx('flex-1', c?.phase ? PHASE_COLORS[c.phase] : 'bg-slate-100', c && c.basis !== 'recorded' && 'hatch', c?.basis === 'projected' && 'opacity-50', selected === p.date && 'ring-2 ring-slate-900 ring-inset');
          return onSelect ? (
            <button key={p.date} type="button" role="listitem" title={label} aria-label={label} className={cls} onClick={() => onSelect(p.date)} />
          ) : (
            <div key={p.date} role="listitem" title={label} aria-label={label} className={cls} />
          );
        })}
      </div>
      <div className="mt-1 flex text-[11px] text-slate-500">
        {points.map((p, i) => (
          <div key={p.date} className="flex-1 overflow-visible whitespace-nowrap">
            {tick(i) ? formatDate(p.date) : ''}
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
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
          <span className="inline-block h-2 w-2 rounded-full bg-slate-800" aria-hidden="true" /> Seizure day
        </span>
      </figcaption>
    </figure>
  );
}
