/** Curated clinical-evidence models. Entries live in `src/clinical/knowledgeBase.ts`. */

export type EvidenceType =
  | 'systematic-review'
  | 'consensus-statement'
  | 'cross-sectional-survey'
  | 'cohort-study'
  | 'clinical-study'
  | 'classification-report'
  | 'public-health-guidance';

export interface Citation {
  authors: string;
  title: string;
  journal: string;
  year: number;
  volume?: string;
  pages?: string;
  pmid?: string;
  doi?: string;
}

export interface EvidenceEntry {
  id: string;
  /** Population-level clinical relationship, e.g. "Epilepsy ↔ ADHD symptoms". */
  relationship: string;
  citation: Citation;
  url: string;
  evidenceType: EvidenceType;
  /** Population the evidence was derived from. */
  population: string;
  /** Paraphrased key finding (population-level, not patient-specific). */
  keyFinding: string;
  limitations: string[];
  /** Symptoms, diagnoses or calculated patterns that make this entry relevant. */
  relevantSignals: string[];
  discussionPoint: string;
  /** Date the citation metadata was verified against PubMed / the publisher. */
  verifiedOn: string;
}
