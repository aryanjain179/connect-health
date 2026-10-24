import { CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayPoint } from '../../analysis/series';
import { formatDate } from '../../analysis/dates';
import type { ReviewFlag } from '../../review/flags';

interface Row {
  date: string;
  sleep: number | null;
  rolling: number | null;
  event: number | null;
  eventCount: number;
  amber: number | null;
  red: number | null;
}

interface Props {
  points: DayPoint[];
  threshold: number;
  height?: number;
  onSelect?: (date: string) => void;
  /** Review flags to mark on the chart. */
  flags?: ReviewFlag[];
  onFlagClick?: (flag: ReviewFlag, date: string) => void;
  /** Shade the comparison intervals of a single focused flag. */
  focusFlag?: ReviewFlag | null;
  eventLabel?: string;
}

/** Sleep trend with event markers and clickable clinician-review markers (amber = routine, red = prompt). */
export function SleepChart({ points, threshold, height = 240, onSelect, flags = [], onFlagClick, focusFlag, eventLabel = 'Seizure day' }: Props) {
  const flagOn = (date: string, level: 'red' | 'amber') => flags.find((f) => f.level === level && f.involvedDates.includes(date)) ?? null;
  const rows: Row[] = points.map((p) => ({
    date: p.date,
    sleep: p.sleepHours,
    rolling: p.sleepRolling,
    event: p.seizures.length ? 11 : null,
    eventCount: p.seizures.length,
    amber: flagOn(p.date, 'amber') ? 0.6 : null,
    red: flagOn(p.date, 'red') ? 0.6 : null,
  }));
  const missing = points.filter((p) => p.sleepHours === null).length;
  const handleFlag = (level: 'red' | 'amber') => (entry: unknown) => {
    const date = (entry as { payload?: Row })?.payload?.date;
    if (!date || !onFlagClick) return;
    const f = flagOn(date, level);
    if (f) onFlagClick(f, date);
  };
  const hasFlags = rows.some((r) => r.amber !== null || r.red !== null);
  const inRange = (d: string) => points.length > 0 && d >= points[0].date && d <= points[points.length - 1].date;

  return (
    <figure>
      <div style={{ height }} role="img" aria-label={`Sleep hours per night with ${eventLabel.toLowerCase()}s marked. ${missing} nights not recorded.${hasFlags ? ' Review markers are listed below the chart.' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            onClick={(s) => {
              const d = (s as { activeLabel?: string } | null)?.activeLabel;
              if (onSelect && d) onSelect(String(d));
            }}
          >
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            {focusFlag?.ranges.filter((r) => inRange(r.start) || inRange(r.end)).map((r, i) => (
              <ReferenceArea key={r.label} x1={r.start < points[0].date ? points[0].date : r.start} x2={r.end > points[points.length - 1].date ? points[points.length - 1].date : r.end} fill={i % 2 ? '#fde68a' : '#e2e8f0'} fillOpacity={0.35} label={{ value: r.label, position: 'insideTop', fontSize: 10, fill: '#78716c' }} />
            ))}
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d)} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={24} />
            <YAxis domain={[0, 12]} ticks={[0, 3, 6, 9, 12]} tick={{ fontSize: 11, fill: '#64748b' }} width={44} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              labelFormatter={(d) => formatDate(String(d), true)}
              formatter={(value, name, item) => {
                const row = item.payload as Row;
                if (name === eventLabel) return [`${row.eventCount} event(s)`, name];
                if (String(name).startsWith('Review')) return ['click marker for details', name];
                return [value === null || value === undefined ? 'not recorded' : `${value} h`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={threshold} stroke="#d97706" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="sleep" name="Sleep (night before)" stroke="#0f766e" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="rolling" name="7-day mean (recorded nights)" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Scatter dataKey="event" name={eventLabel} fill="#1e293b" shape="diamond" isAnimationActive={false} />
            {rows.some((r) => r.amber !== null) && (
              <Scatter dataKey="amber" name="Review: routine discussion" fill="#d97706" shape="triangle" isAnimationActive={false} onClick={handleFlag('amber')} cursor="pointer" />
            )}
            {rows.some((r) => r.red !== null) && (
              <Scatter dataKey="red" name="Review: prompt (documented guidance)" fill="#e11d48" shape="triangle" isAnimationActive={false} onClick={handleFlag('red')} cursor="pointer" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">
        Gaps are nights with no sleep recorded ({missing} in this range) – they are not treated as zero. Diamonds mark days with ≥ 1 recorded {eventLabel.toLowerCase().replace(' day', '')}. Dashed amber line = {threshold} h short-sleep threshold.
        {hasFlags && ' Triangles along the bottom mark data points in a pattern identified for clinician review (amber = routine discussion under a prototype rule; red = prompt review under documented guidance). Click a triangle or use the list below for details.'}
      </figcaption>
    </figure>
  );
}
