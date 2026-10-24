import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { ConnectionResult, DateWindow, PatternFinding } from '../models/analysis';
import type { OutcomeKey } from '../models/types';
import { initialState, rootReducer, type Action, type AppState, type RootAction, type RootState } from './reducer';
import { loadRoot, saveRoot } from './storage';
import { resolveWindow } from '../analysis/context';
import { allOutcomeFindings, runAllOutcomes } from '../analysis';
import { evaluateConnections } from '../clinical/connections';
import { computeCompleteness, summarizeSeizures, type CompletenessReport, type SeizureSummary } from '../analysis/completeness';
import { localToday } from '../analysis/dates';
import { outcomeAvailability, type OutcomeAvailability } from '../analysis/outcomes';
import { buildReviewFlags, type InsufficientItem, type ReviewFlag } from '../review/flags';

interface Ctx {
  root: RootState;
  rootDispatch: (a: RootAction) => void;
  /** Active profile state (falls back to the demo profile when none is active). */
  state: AppState;
  dispatch: (a: Action) => void;
  isDemo: boolean;
  loadNotice: string | null;
  dismissNotice: () => void;
}

const HealthDataContext = createContext<Ctx | null>(null);

export function HealthDataProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadRoot());
  const [root, rootDispatch] = useReducer(rootReducer, initial.root);
  const [loadNotice, setLoadNotice] = useState<string | null>(
    initial.source === 'invalid' ? 'Saved data could not be read, so the synthetic demo dataset was loaded instead.' : null,
  );

  useEffect(() => {
    saveRoot(root);
  }, [root]);

  const dispatch = useCallback((a: Action) => rootDispatch({ type: 'profile', action: a }), []);
  const state = (root.active && root.profiles[root.active]) || root.profiles.demo || initialState();

  const value = useMemo(
    () => ({ root, rootDispatch, state, dispatch, isDemo: root.active !== 'user', loadNotice, dismissNotice: () => setLoadNotice(null) }),
    [root, state, dispatch, loadNotice],
  );
  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>;
}

export function useHealthData(): Ctx {
  const ctx = useContext(HealthDataContext);
  if (!ctx) throw new Error('useHealthData must be used inside HealthDataProvider');
  return ctx;
}

export interface AnalysisBundle {
  window: DateWindow;
  outcome: OutcomeKey | null;
  outcomes: OutcomeAvailability[];
  /** Findings for the selected outcome (empty when no outcome has data). */
  findings: PatternFinding[];
  findingsByOutcome: Partial<Record<OutcomeKey, PatternFinding[]>>;
  connections: ConnectionResult[];
  flags: ReviewFlag[];
  insufficient: InsufficientItem[];
  completeness: CompletenessReport;
  seizures: SeizureSummary;
}

/** Derived, memoised analysis for the active profile's data, settings and period. */
export function useAnalysis(): AnalysisBundle {
  const { state } = useHealthData();
  return useMemo(() => computeBundle(state), [state]);
}

export function computeBundle(state: AppState): AnalysisBundle {
  const window = resolveWindow(state.data, state.period, localToday());
  const outcomes = outcomeAvailability(state.data);
  const findingsByOutcome = runAllOutcomes(state.data, window, state.settings);
  const selected = findingsByOutcome[state.settings.outcome] ? state.settings.outcome : (outcomes.find((o) => o.available)?.key ?? null);
  const all = allOutcomeFindings(findingsByOutcome);
  const { flags, insufficient } = buildReviewFlags(state.data, findingsByOutcome, window);
  return {
    window,
    outcome: selected,
    outcomes,
    findings: selected ? findingsByOutcome[selected]! : [],
    findingsByOutcome,
    connections: evaluateConnections(state.data, all, window),
    flags,
    insufficient,
    completeness: computeCompleteness(state.data, window),
    seizures: summarizeSeizures(state.data, window),
  };
}
