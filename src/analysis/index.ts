/**
 * Pattern-discovery orchestrator. Pure: same records + window + settings ⇒ same findings, regardless of input order.
 */
import type { DateWindow, PatternFinding } from '../models/analysis';
import type { AnalysisSettings, HealthData } from '../models/types';
import { buildContext } from './context';
import { analyzeSleep } from './sleep';
import { analyzeMenstrual } from './menstrual';
import { analyzeMedicationChanges } from './medication';
import { analyzeStress } from './stress';
import { analyzeFrequencyTrend, analyzeTypeChanges } from './trend';

export function runPatternAnalysis(data: HealthData, window: DateWindow, settings: AnalysisSettings): PatternFinding[] {
  const ctx = buildContext(data, window);
  return [
    analyzeSleep(ctx, settings),
    analyzeMenstrual(ctx, data, settings),
    ...analyzeMedicationChanges(ctx, data),
    analyzeStress(ctx, settings),
    analyzeFrequencyTrend(ctx),
    analyzeTypeChanges(ctx, data),
  ];
}

export const STATUS_LABELS: Record<PatternFinding['status'], string> = {
  'possible-pattern': 'Possible pattern',
  'no-clear-pattern': 'No clear pattern',
  'notable-change': 'Notable change',
  'insufficient-data': 'Insufficient data',
  'not-applicable': 'Not applicable',
};

export { buildContext, resolveWindow, type PeriodPreset } from './context';
