import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { ConnectionResult, DateWindow, PatternFinding } from '../models/analysis';
import { reducer, type Action, type AppState } from './reducer';
import { loadState, saveState } from './storage';
import { resolveWindow } from '../analysis/context';
import { runPatternAnalysis } from '../analysis';
import { evaluateConnections } from '../clinical/connections';
import { computeCompleteness, summarizeSeizures, type CompletenessReport, type SeizureSummary } from '../analysis/completeness';
import { localToday } from '../analysis/dates';

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
  loadNotice: string | null;
  dismissNotice: () => void;
}

const HealthDataContext = createContext<Ctx | null>(null);

export function HealthDataProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadState());
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [loadNotice, setLoadNotice] = useState<string | null>(
    initial.source === 'invalid' ? 'Saved data could not be read, so the synthetic dataset was loaded instead.' : null,
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, loadNotice, dismissNotice: () => setLoadNotice(null) }), [state, loadNotice]);
  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>;
}

export function useHealthData(): Ctx {
  const ctx = useContext(HealthDataContext);
  if (!ctx) throw new Error('useHealthData must be used inside HealthDataProvider');
  return ctx;
}

export interface AnalysisBundle {
  window: DateWindow;
  findings: PatternFinding[];
  connections: ConnectionResult[];
  completeness: CompletenessReport;
  seizures: SeizureSummary;
}

/** Derived, memoised analysis for the current data, settings and period. */
export function useAnalysis(): AnalysisBundle {
  const { state } = useHealthData();
  return useMemo(() => {
    const window = resolveWindow(state.data, state.period, localToday());
    const findings = runPatternAnalysis(state.data, window, state.settings);
    return {
      window,
      findings,
      connections: evaluateConnections(state.data, findings, window),
      completeness: computeCompleteness(state.data, window),
      seizures: summarizeSeizures(state.data, window),
    };
  }, [state.data, state.settings, state.period]);
}
