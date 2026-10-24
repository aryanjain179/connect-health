/**
 * Clinical-safety validators. Applied to every generated finding, connection and summary string, and to every
 * knowledge-base entry. See .kiro/steering/clinical-safety.md.
 */
import type { ConnectionResult, PatternFinding } from '../models/analysis';
import type { EvidenceEntry } from '../models/evidence';
import { KB_BY_ID } from './knowledgeBase';

interface UnsafePattern {
  id: string;
  description: string;
  re: RegExp;
  /** Skip the sentence if it contains a negation ("not", "does not", …). */
  skipIfNegated: boolean;
}

export const UNSAFE_PATTERNS: UnsafePattern[] = [
  {
    id: 'causal-claim',
    description: 'Causal claim from observational data',
    re: /\b(causes?|caused|causing|triggers?|triggered|leads? to|results? in|responsible for)\b/i,
    skipIfNegated: true,
  },
  {
    id: 'confirmed-trigger',
    description: 'Labels a factor a confirmed/proven trigger',
    re: /\b(confirmed|proven|definite|known)\s+(seizure\s+)?trigger/i,
    skipIfNegated: true,
  },
  {
    id: 'diagnosis-claim',
    description: 'States or implies an undocumented diagnosis',
    re: /\b((you|she|he|they|the patient|patient)\s+(has|have|likely has|probably has|is suffering from|suffers from)\s+(adhd|attention[- ]deficit|obstructive sleep apn(o)?ea|sleep apn(o)?ea|osa|catamenial epilepsy|a sleep disorder|narcolepsy)|diagnosed with (adhd|sleep apn(o)?ea|osa|catamenial)|consistent with a diagnosis|confirms? (a |the )?diagnosis)\b/i,
    skipIfNegated: true,
  },
  {
    id: 'individual-probability',
    description: 'Individual disease probability or risk estimate',
    re: /(\b\d+(\.\d+)?\s?%\s*(chance|probability|likelihood|risk)\b|\b(probability|likelihood|chance)\s+(of|that)\s+(having|developing|you|she|he|the patient)\b|\byour risk of\b|\brisk score\b)/i,
    skipIfNegated: false,
  },
  {
    id: 'medication-directive',
    description: 'Recommends a medication or dose change',
    re: /\b(you should|we recommend|it is recommended to|recommend(ed)?|consider|try)\s+(increas|decreas|reduc|stop|start|switch|discontinu|taper|chang|adjust)\w*/i,
    skipIfNegated: true,
  },
  {
    id: 'disease-prediction',
    description: 'Cancer / tumour prediction is out of scope',
    re: /\b(cancer|tumou?rs?|malignan\w*|glioma|neoplasm)\b/i,
    skipIfNegated: false,
  },
];

const NEGATION = /\b(not|no|never|cannot|can't|without|isn't|doesn't|does not|do not|did not|is not|are not|nor)\b/i;

/** Returns the ids of unsafe-language rules matched by `text`. */
export function findUnsafeLanguage(text: string): string[] {
  const hits = new Set<string>();
  const sentences = text.split(/(?<=[.!?;])\s+/);
  for (const s of sentences) {
    for (const p of UNSAFE_PATTERNS) {
      if (!p.re.test(s)) continue;
      if (p.skipIfNegated && NEGATION.test(s)) continue;
      hits.add(p.id);
    }
  }
  return [...hits];
}

export const ALLOWED_EVIDENCE_HOSTS = ['pubmed.ncbi.nlm.nih.gov', 'www.cdc.gov', 'doi.org'];

export function validateEvidenceEntry(e: EvidenceEntry): string[] {
  const errors: string[] = [];
  let url: URL | null = null;
  try {
    url = new URL(e.url);
  } catch {
    errors.push('invalid URL');
  }
  if (url) {
    if (url.protocol !== 'https:') errors.push('URL must use https');
    if (!ALLOWED_EVIDENCE_HOSTS.includes(url.hostname)) errors.push(`host ${url.hostname} not in allow-list`);
    if (url.hostname === 'pubmed.ncbi.nlm.nih.gov' && (!e.citation.pmid || !url.pathname.includes(e.citation.pmid)))
      errors.push('PubMed URL must contain the PMID');
  }
  if (e.citation.pmid && !/^\d{6,9}$/.test(e.citation.pmid)) errors.push('PMID format');
  if (e.citation.doi && !/^10\.\d{4,9}\/\S+$/.test(e.citation.doi)) errors.push('DOI format');
  if (!e.citation.authors || !e.citation.title || !e.citation.journal || !e.citation.year) errors.push('incomplete citation');
  if (!e.citation.pmid && !e.citation.doi && url?.hostname !== 'www.cdc.gov') errors.push('needs PMID, DOI or official guidance URL');
  if (!e.population.trim()) errors.push('population missing');
  if (!e.limitations.length) errors.push('limitations missing');
  if (!e.relevantSignals.length) errors.push('relevant signals missing');
  if (!e.discussionPoint.trim()) errors.push('discussion point missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.verifiedOn)) errors.push('verifiedOn missing');
  const unsafe = findUnsafeLanguage([e.keyFinding, e.discussionPoint].join(' '));
  if (unsafe.length) errors.push(`unsafe language: ${unsafe.join(', ')}`);
  return errors;
}

export function connectionTexts(c: ConnectionResult): string[] {
  return [c.title, c.rationale, c.hypothesis ?? '', c.discussionPoint, ...c.confounders, ...c.limitations, ...c.signals.map((s) => `${s.label}. ${s.detail}`)];
}

export function findingTexts(f: PatternFinding): string[] {
  return [f.title, f.explanation, f.method, f.discussionPoint, ...f.confounders, ...f.limitations, ...f.details, f.suppressionReason ?? ''];
}

export function validateConnection(c: ConnectionResult): string[] {
  const errors: string[] = [];
  for (const id of c.evidenceIds) {
    const e = KB_BY_ID.get(id);
    if (!e) errors.push(`unknown evidence id ${id}`);
    else if (validateEvidenceEntry(e).length) errors.push(`invalid evidence ${id}`);
  }
  if (c.surfaced) {
    if (!c.evidenceIds.length) errors.push('surfaced connection without evidence');
    if (!c.hypothesis) errors.push('surfaced connection without hypothesis');
    const patientSpecific = c.signals.filter((s) => s.kind !== 'confirmed-diagnosis');
    if (!patientSpecific.length) errors.push('surfaced connection needs a patient-specific signal beyond the diagnosis');
  }
  const unsafe = findUnsafeLanguage(connectionTexts(c).join(' '));
  if (unsafe.length) errors.push(`unsafe language: ${unsafe.join(', ')}`);
  return errors;
}
