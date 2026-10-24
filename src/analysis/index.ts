/**
 * Pattern-discovery orchestrator. Pure: same records + window + settings ⇒ same findings, regardless of input order.
 */
import type { DateWindow, PatternFinding } from '../models/analysis';
import type { AnalysisSettings, HealthData, OutcomeKey } from '../models/types';
import { buildContext } from './context';
import { analyzeSleep } from './sleep';
import { analyzeMenstrual } from './menstrual';
import { analyzeMedicationChanges } from './medication';
import { analyzeStress } from './stress';
import { analyzeFrequencyTrend, analyzeTypeChanges } from './trend';
import { outcomeAvailability, relabelFinding } from './outcomes';

/** Runs all analyses for `settings.outcome` (default: seizures). */
export function runPatternAnalysis(data: HealthData, window: DateWindow, settings: AnalysisSettings, outcomeOverride?: OutcomeKey): PatternFinding[] {
  const outcome = outcomeOverride ?? settings.outcome ?? 'seizures';
  const ctx = buildContext(data, window, outcome);
  const findings = [
    analyzeSleep(ctx, settings),
    analyzeMenstrual(ctx, data, settings),
    ...analyzeMedicationChanges(ctx, data),
    analyzeStress(ctx, settings),
    analyzeFrequencyTrend(ctx),
    // Seizure type / duration only exists for the seizure diary.
    ...(outcome === 'seizures' ? [analyzeTypeChanges(ctx, data)] : []),
  ];
  return findings.map((f) => relabelFinding(f, outcome));
}

/** Findings for every outcome that has data, keyed by outcome. */
export function runAllOutcomes(data: HealthData, window: DateWindow, settings: AnalysisSettings): Partial<Record<OutcomeKey, PatternFinding[]>> {
  const out: Partial<Record<OutcomeKey, PatternFinding[]>> = {};
  for (const a of outcomeAvailability(data)) if (a.available) out[a.key] = runPatternAnalysis(data, window, settings, a.key);
  return out;
}

/** All findings across outcomes, in a stable order. */
export function allOutcomeFindings(byOutcome: Partial<Record<OutcomeKey, PatternFinding[]>>): PatternFinding[] {
  return Object.values(byOutcome).flatMap((x) => x ?? []);
}

export const STATUS_LABELS: Record<PatternFinding['status'], string> = {
  'possible-pattern': 'Possible pattern',
  'no-clear-pattern': 'No clear pattern',
  'notable-change': 'Notable change',
  'insufficient-data': 'Insufficient data',
  'not-applicable': 'Not applicable',
};

export { buildContext, resolveWindow, type PeriodPreset } from './context';
