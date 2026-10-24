import { useState } from 'react';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { Card, Notice, PageHeader, inputClass } from '../components/ui';
import { InsightCard } from '../components/InsightCard';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import type { PatternFinding } from '../models/analysis';
import { DEFAULT_SETTINGS } from '../models/types';
import { formatWindow } from '../analysis/dates';

export function taskDefaultsFromFinding(f: PatternFinding) {
  return {
    title: f.status === 'notable-change' ? `Ask the care team about: ${f.title}` : `Discuss at next appointment: ${f.title}`,
    reason: f.explanation,
    kind: f.status === 'notable-change' ? 'ask-assessment' : 'discuss-pattern',
    insightId: f.id,
  };
}

export function PatternsPage() {
  const { state, dispatch } = useHealthData();
  const { findings, window } = useAnalysis();
  const { openEditor } = useEditor();
  const [showSuppressed, setShowSuppressed] = useState(true);
  const visible = showSuppressed ? findings : findings.filter((f) => f.status !== 'insufficient-data' && f.status !== 'not-applicable');
  const isDefault = state.settings.sleepThresholdHours === DEFAULT_SETTINGS.sleepThresholdHours && state.settings.highStressThreshold === DEFAULT_SETTINGS.highStressThreshold;

  return (
    <>
      <PageHeader
        title="Pattern Discovery"
        description={<>Deterministic calculations from the stored records for {formatWindow(window)}. Change the analysis period in the top bar or the thresholds below – everything is recalculated immediately.</>}
      />
      <Notice tone="amber" icon={<AlertTriangle size={16} />}>
        These are exploratory, observational calculations from diary data. A possible pattern is an association in these records – it does not show cause and effect and does not identify a confirmed seizure trigger. Small numbers make results uncertain. Review with the treating clinician before drawing conclusions.
      </Notice>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <SlidersHorizontal size={16} aria-hidden="true" /> Analysis thresholds
          </span>
          <div>
            <label htmlFor="sleep-th" className="block text-xs font-medium text-slate-600">
              Short sleep is less than
            </label>
            <select id="sleep-th" className={inputClass} value={state.settings.sleepThresholdHours} onChange={(e) => dispatch({ type: 'setSettings', settings: { sleepThresholdHours: Number(e.target.value) } })}>
              {[5, 5.5, 6, 6.5, 7].map((v) => (
                <option key={v} value={v}>
                  {v} hours
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="stress-th" className="block text-xs font-medium text-slate-600">
              High stress is at least
            </label>
            <select id="stress-th" className={inputClass} value={state.settings.highStressThreshold} onChange={(e) => dispatch({ type: 'setSettings', settings: { highStressThreshold: Number(e.target.value) } })}>
              {[5, 6, 7, 8, 9].map((v) => (
                <option key={v} value={v}>
                  {v} / 10
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-teal-700" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} />
            Show suppressed and not-applicable analyses
          </label>
          <button
            type="button"
            className="text-sm text-teal-800 underline disabled:text-slate-400 disabled:no-underline"
            disabled={isDefault}
            onClick={() => dispatch({ type: 'setSettings', settings: DEFAULT_SETTINGS })}
          >
            Reset to defaults
          </button>
        </div>
        {!isDefault && <p className="mt-2 text-xs text-amber-800">Thresholds differ from the pre-specified defaults (6 h, 7/10). Trying several thresholds increases the chance of finding a pattern by chance.</p>}
      </Card>

      <div className="mt-6 space-y-6">
        {visible.map((f) => (
          <InsightCard key={f.id} finding={f} onCreateTask={(x) => openEditor({ kind: 'task', defaults: taskDefaultsFromFinding(x), insightTitle: x.title })} />
        ))}
      </div>
    </>
  );
}
