import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayPoint } from '../../analysis/series';
import { formatDate } from '../../analysis/dates';

interface Row {
  date: string;
  sleep: number | null;
  rolling: number | null;
  seizure: number | null;
  seizureCount: number;
}

export function SleepChart({ points, threshold, height = 240, onSelect }: { points: DayPoint[]; threshold: number; height?: number; onSelect?: (date: string) => void }) {
  const rows: Row[] = points.map((p) => ({
    date: p.date,
    sleep: p.sleepHours,
    rolling: p.sleepRolling,
    seizure: p.seizures.length ? 11 : null,
    seizureCount: p.seizures.length,
  }));
  const missing = points.filter((p) => p.sleepHours === null).length;
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={`Sleep hours per night with seizure days marked. ${missing} nights not recorded.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} onClick={(s) => {
            const d = (s as { activeLabel?: string } | null)?.activeLabel;
            if (onSelect && d) onSelect(String(d));
          }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d)} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={24} />
            <YAxis domain={[0, 12]} ticks={[0, 3, 6, 9, 12]} tick={{ fontSize: 11, fill: '#64748b' }} width={44} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              labelFormatter={(d) => formatDate(String(d), true)}
              formatter={(value, name, item) => {
                if (name === 'Seizure day') return [`${(item.payload as Row).seizureCount} event(s)`, name];
                return [value === null || value === undefined ? 'not recorded' : `${value} h`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={threshold} stroke="#d97706" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="sleep" name="Sleep (night before)" stroke="#0f766e" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="rolling" name="7-day mean (recorded nights)" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Scatter dataKey="seizure" name="Seizure day" fill="#1e293b" shape="diamond" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">
        Gaps are nights with no sleep recorded ({missing} in this range) – they are not treated as zero. Diamonds mark days with ≥ 1 recorded seizure. Dashed amber line = {threshold} h short-sleep threshold.
      </figcaption>
    </figure>
  );
}
