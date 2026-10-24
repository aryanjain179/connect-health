import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_BASE, KB_BY_ID } from './knowledgeBase';
import { connectionTexts, findUnsafeLanguage, findingTexts, validateConnection, validateEvidenceEntry } from './safety';
import { evaluateConnections } from './connections';
import { runPatternAnalysis } from '../analysis';
import { createSyntheticDataset, SYNTHETIC_END, SYNTHETIC_START } from '../data/syntheticDataset';
import { DEFAULT_SETTINGS, type HealthData, type HistoryRecord } from '../models/types';
import type { ConnectionResult } from '../models/analysis';
import type { EvidenceEntry } from '../models/evidence';
import { emptyData, obs, sz } from '../test/fixtures';
import { eachDay } from '../analysis/dates';
import { buildClinicianSummary, summaryToMarkdown } from '../summary/clinicianSummary';

const W = { start: SYNTHETIC_START, end: SYNTHETIC_END };

/** PMIDs verified against PubMed E-utilities on 2026-10-24 (see docs/CITATIONS.md). */
const VERIFIED_PMIDS = ['25594106', '30178479', '11061259', '24632482', '15652738', '9579954', '26336950'];

const hx = (id: string, partial: Partial<HistoryRecord>): HistoryRecord => ({
  id,
  kind: 'symptom',
  label: id,
  status: 'patient-reported',
  source: 'patient-reported',
  date: null,
  tags: [],
  notes: '',
  isSynthetic: true,
  ...partial,
});
const epilepsy = hx('epi', { kind: 'diagnosis', label: 'Focal epilepsy', status: 'confirmed', source: 'clinician-documented', tags: ['epilepsy'] });

function connectionsFor(data: HealthData, window = W): ConnectionResult[] {
  return evaluateConnections(data, runPatternAnalysis(data, window, DEFAULT_SETTINGS), window);
}

describe('knowledge base', () => {
  it('every entry passes evidence validation', () => {
    for (const e of KNOWLEDGE_BASE) expect(validateEvidenceEntry(e), e.id).toEqual([]);
  });
  it('only contains verified PMIDs (no fabricated citations)', () => {
    const pmids = KNOWLEDGE_BASE.map((e) => e.citation.pmid).filter(Boolean);
    expect(pmids.sort()).toEqual([...VERIFIED_PMIDS].sort());
    for (const e of KNOWLEDGE_BASE) if (e.citation.pmid) expect(e.url).toBe(`https://pubmed.ncbi.nlm.nih.gov/${e.citation.pmid}/`);
  });
  it('rejects malformed or non-allow-listed citations', () => {
    const fake: EvidenceEntry = { ...KNOWLEDGE_BASE[0], id: 'fake', url: 'https://example.com/study', citation: { ...KNOWLEDGE_BASE[0].citation, pmid: undefined, doi: undefined } };
    expect(validateEvidenceEntry(fake).length).toBeGreaterThan(0);
    const mismatch: EvidenceEntry = { ...KNOWLEDGE_BASE[0], url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' };
    expect(validateEvidenceEntry(mismatch)).toContain('PubMed URL must contain the PMID');
  });
});

describe('safety language validator', () => {
  it('flags unsafe claims', () => {
    expect(findUnsafeLanguage('Short sleep causes your seizures.')).toContain('causal-claim');
    expect(findUnsafeLanguage('Stress is a confirmed trigger.')).toContain('confirmed-trigger');
    expect(findUnsafeLanguage('The patient has ADHD.')).toContain('diagnosis-claim');
    expect(findUnsafeLanguage('You have a 40% chance of sleep apnea.')).toContain('individual-probability');
    expect(findUnsafeLanguage('You should increase the dose of levetiracetam.')).toContain('medication-directive');
    expect(findUnsafeLanguage('This seizure pattern could indicate a brain tumour.')).toContain('disease-prediction');
  });
  it('allows cautious, negated phrasing', () => {
    expect(findUnsafeLanguage('This does not show that short sleep causes seizures.')).toEqual([]);
    expect(findUnsafeLanguage('A possible personal pattern; not a confirmed trigger.')).toEqual([]);
  });
});

describe('clinical connections', () => {
  it('epilepsy alone does not surface an ADHD (or any) suggestion', () => {
    const data = emptyData({ history: [epilepsy], observations: eachDay(W.start, W.end).map((d) => obs(d)) });
    const conns = connectionsFor(data);
    const adhd = conns.find((c) => c.id === 'conn-adhd')!;
    expect(adhd.surfaced).toBe(false);
    expect(adhd.rationale).toMatch(/epilepsy diagnosis alone does not surface/);
    expect(conns.every((c) => !c.surfaced)).toBe(true);
  });

  it('surfaces ADHD connection only with a patient-specific attention signal', () => {
    const data = emptyData({ history: [epilepsy, hx('att', { label: 'Trouble focusing', tags: ['attention'] })] });
    const adhd = connectionsFor(data).find((c) => c.id === 'conn-adhd')!;
    expect(adhd.surfaced).toBe(true);
    expect(adhd.signals.map((s) => s.kind)).toEqual(['confirmed-diagnosis', 'patient-reported-symptom']);
    expect(adhd.evidenceIds.every((id) => KB_BY_ID.has(id))).toBe(true);
  });

  it('does not suggest assessment when ADHD is already documented, or when attention symptoms exist without epilepsy', () => {
    const documented = emptyData({ history: [epilepsy, hx('att', { tags: ['attention'] }), hx('adhd', { kind: 'diagnosis', status: 'confirmed', source: 'clinician-documented', tags: ['adhd'] })] });
    expect(connectionsFor(documented).find((c) => c.id === 'conn-adhd')!.surfaced).toBe(false);
    const noEpilepsy = emptyData({ history: [hx('att', { tags: ['attention'] })] });
    expect(connectionsFor(noEpilepsy).find((c) => c.id === 'conn-adhd')!.surfaced).toBe(false);
  });

  it('missing attention fields are not counted as "no" or "yes"', () => {
    const days = eachDay(W.start, W.end);
    // 20 recorded days, 8 with difficulty (40%); 70 days not recorded.
    const observations = days.map((d, i) => obs(d, { attentionDifficulty: i < 20 ? i < 8 : null }));
    const adhd = connectionsFor(emptyData({ history: [epilepsy], observations })).find((c) => c.id === 'conn-adhd')!;
    expect(adhd.surfaced).toBe(true);
    expect(adhd.signals[1].detail).toMatch(/8 of 20 days/);
  });

  it('surfaces the safety protocol with emergency guidance for a seizure ≥ 5 minutes', () => {
    const data = emptyData({ history: [epilepsy], seizures: [sz('2026-10-01', { durationSeconds: 360 })] });
    const c = connectionsFor(data).find((x) => x.id === 'conn-seizure-change')!;
    expect(c.surfaced).toBe(true);
    expect(c.urgency).toBe('emergency-guidance');
    expect(c.evidenceIds).toContain('cdc-seizure-first-aid');
  });

  it('suppresses a connection that references unknown evidence', () => {
    const bogus: ConnectionResult = {
      id: 'x', title: 'x', category: 'potential-comorbidity', surfaced: true, rationale: '', hypothesis: 'May warrant review.',
      signals: [{ kind: 'patient-reported-symptom', label: 'x', detail: '', sourceId: null }], evidenceIds: ['made-up-2024'],
      confounders: [], limitations: [], discussionPoint: '', urgency: 'routine',
    };
    expect(validateConnection(bogus)).toContain('unknown evidence id made-up-2024');
    expect(validateConnection({ ...bogus, evidenceIds: ['malow-2000-osa'], signals: [{ kind: 'confirmed-diagnosis', label: 'Epilepsy', detail: '', sourceId: null }] })).toContain(
      'surfaced connection needs a patient-specific signal beyond the diagnosis',
    );
  });

  it('synthetic dataset surfaces the four expected connections', () => {
    const conns = connectionsFor(createSyntheticDataset());
    expect(conns.filter((c) => c.surfaced).map((c) => c.id)).toEqual(['conn-adhd', 'conn-sleep-disorder', 'conn-catamenial', 'conn-seizure-change']);
    expect(conns.find((c) => c.id === 'conn-seizure-change')!.urgency).toBe('prompt');
  });
});

describe('no unsafe language anywhere in generated output', () => {
  const variants: Array<[string, HealthData]> = [
    ['synthetic', createSyntheticDataset()],
    ['empty', emptyData()],
    ['epilepsy only', emptyData({ history: [epilepsy] })],
  ];
  for (const [name, data] of variants) {
    for (const preset of [30, 90] as const) {
      it(`${name} – ${preset} days`, () => {
        const window = preset === 90 ? W : { start: '2026-09-21', end: W.end };
        const findings = runPatternAnalysis(data, window, DEFAULT_SETTINGS);
        const conns = evaluateConnections(data, findings, window);
        const md = summaryToMarkdown(buildClinicianSummary(data, findings, conns, window, DEFAULT_SETTINGS));
        const texts = [...findings.flatMap(findingTexts), ...conns.flatMap(connectionTexts)];
        for (const t of texts) expect(findUnsafeLanguage(t), t).toEqual([]);
        // The summary embeds citation titles (e.g. "triggering factors"), so check generated sentences only.
        const generated = md.split('\n').filter((l) => !l.includes('[Evidence]'));
        for (const l of generated) expect(findUnsafeLanguage(l), l).toEqual([]);
        expect(md).not.toMatch(/cancer|tumou?r|malignan/i);
      });
    }
  }
});
