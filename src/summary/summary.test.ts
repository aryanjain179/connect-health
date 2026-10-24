import { describe, expect, it } from 'vitest';
import { buildClinicianSummary, summaryToMarkdown } from './clinicianSummary';
import { runPatternAnalysis } from '../analysis';
import { evaluateConnections } from '../clinical/connections';
import { createSyntheticDataset, SYNTHETIC_END, SYNTHETIC_START } from '../data/syntheticDataset';
import { DEFAULT_SETTINGS, type HealthData } from '../models/types';

const W = { start: SYNTHETIC_START, end: SYNTHETIC_END };
const build = (data: HealthData) => {
  const f = runPatternAnalysis(data, W, DEFAULT_SETTINGS);
  return buildClinicianSummary(data, f, evaluateConnections(data, f, W), W, DEFAULT_SETTINGS);
};

describe('clinician summary', () => {
  it('contains all required sections in order', () => {
    expect(build(createSyntheticDataset()).sections.map((s) => s.id)).toEqual(['history', 'allergies', 'seizures', 'context', 'review', 'timeline', 'patterns', 'connections', 'concerns', 'missing', 'questions', 'tasks']);
  });

  it('reflects actual records and calculations', () => {
    const md = summaryToMarkdown(build(createSyntheticDataset()));
    expect(md).toContain('15 seizure events on 13 days');
    expect(md).toContain('[Established diagnosis]** Focal epilepsy');
    expect(md).toContain('Levetiracetam 750 mg twice daily');
    expect(md).toContain('Check-ins on 83 of 90 days');
    expect(md).toContain('[Potential hypothesis]**');
    expect(md).toContain('SYNTHETIC DEMONSTRATION DATA');
    expect(md).toContain('pubmed.ncbi.nlm.nih.gov/25594106');
  });

  it('updates after records change', () => {
    const data = createSyntheticDataset();
    data.seizures = data.seizures.slice(0, 2);
    data.tasks = data.tasks.map((t) => ({ ...t, status: 'done' as const }));
    const md = summaryToMarkdown(build(data));
    expect(md).toContain('2 seizure events on 2 days');
    expect(md).toContain('No outstanding tasks.');
    expect(md).not.toContain('[Potential hypothesis]** Seizure timing and the menstrual cycle');
  });

  it('labels every item with an information type', () => {
    for (const s of build(createSyntheticDataset()).sections) for (const i of s.items) expect(i.label).toBeTruthy();
  });
});
