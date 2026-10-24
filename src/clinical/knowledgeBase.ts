/**
 * Curated clinical-evidence knowledge base.
 *
 * Every citation below was verified against PubMed (NCBI E-utilities esummary/efetch) or the official CDC page on
 * 2026-10-24. Key findings are paraphrased from the abstracts. Do NOT add entries without verifying the source and
 * updating docs/CITATIONS.md and the verified-PMID list in tests.
 */
import type { EvidenceEntry } from '../models/evidence';

export const KNOWLEDGE_BASE: EvidenceEntry[] = [
  {
    id: 'ettinger-2015-adhd-adults',
    relationship: 'Epilepsy ↔ ADHD symptoms (adults)',
    citation: {
      authors: 'Ettinger AB, Ottman R, Lipton RB, Cramer JA, Fanning KM, Reed ML',
      title:
        'Attention-deficit/hyperactivity disorder symptoms in adults with self-reported epilepsy: Results from a national epidemiologic survey of epilepsy',
      journal: 'Epilepsia',
      year: 2015,
      volume: '56(2)',
      pages: '218-224',
      pmid: '25594106',
      doi: '10.1111/epi.12897',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/25594106/',
    evidenceType: 'cross-sectional-survey',
    population: 'US adults who self-reported epilepsy in a postal survey (1,361 with active epilepsy).',
    keyFinding:
      'About 18% screened positive for ADHD symptoms on the ASRS-6 screener; screen-positive respondents had more depression and anxiety symptoms, higher seizure frequency and lower quality of life.',
    limitations: [
      'Screening questionnaire, not a clinical ADHD diagnosis.',
      'Epilepsy was self-reported; cross-sectional design cannot establish direction of association.',
      'Population-level association; it does not estimate any individual patient’s likelihood of ADHD.',
    ],
    relevantSignals: ['Confirmed epilepsy diagnosis', 'Patient-reported attention or concentration difficulty', 'Childhood attention concerns'],
    discussionPoint:
      'Ask about the onset, duration and impact of attention symptoms, and whether a structured assessment is appropriate after accounting for sleep, seizures and medication effects.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'auvin-2018-adhd-children',
    relationship: 'Epilepsy ↔ ADHD (children; screening and management consensus)',
    citation: {
      authors: 'Auvin S, Wirrell E, Donald KA, et al.',
      title:
        'Systematic review of the screening, diagnosis, and management of ADHD in children with epilepsy. Consensus paper of the Task Force on Comorbidities of the ILAE Pediatric Commission',
      journal: 'Epilepsia',
      year: 2018,
      volume: '59(10)',
      pages: '1867-1880',
      pmid: '30178479',
      doi: '10.1111/epi.14549',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/30178479/',
    evidenceType: 'consensus-statement',
    population: 'Children with epilepsy (systematic review and ILAE task-force consensus).',
    keyFinding:
      'Describes ADHD as a common comorbidity in children with epilepsy; suggests screening from age 6 or at diagnosis, repeated over time and after antiseizure-medication changes, with diagnosis by practitioners trained in ADHD.',
    limitations: [
      'Paediatric population – applicability to adults is indirect.',
      'Several recommendations are graded as expert opinion (Level U).',
    ],
    relevantSignals: ['Confirmed epilepsy diagnosis', 'Attention symptoms', 'Recent antiseizure-medication change'],
    discussionPoint:
      'Consider whether childhood attention concerns and current symptoms warrant referral to a clinician experienced in ADHD assessment.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'malow-2000-osa',
    relationship: 'Epilepsy ↔ obstructive sleep apnoea',
    citation: {
      authors: 'Malow BA, Levy K, Maturen K, Bowes R',
      title: 'Obstructive sleep apnea is common in medically refractory epilepsy patients',
      journal: 'Neurology',
      year: 2000,
      volume: '55(7)',
      pages: '1002-1007',
      pmid: '11061259',
      doi: '10.1212/wnl.55.7.1002',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/11061259/',
    evidenceType: 'clinical-study',
    population: '39 epilepsy-surgery candidates with medically refractory epilepsy and no known sleep apnoea, studied with polysomnography.',
    keyFinding:
      'One third had previously undiagnosed obstructive sleep apnoea; those with OSA were more often older, male, had higher sleep-apnoea questionnaire scores and more seizures during sleep.',
    limitations: [
      'Small, selected sample of people with drug-resistant epilepsy; may not generalise.',
      'Snoring and sleepiness are non-specific; only a sleep study can establish OSA.',
    ],
    relevantSignals: ['Snoring', 'Witnessed pauses in breathing', 'Daytime sleepiness', 'Poor sleep quality', 'Seizures during sleep'],
    discussionPoint:
      'Ask about snoring, witnessed apnoeas and daytime sleepiness, and whether evaluation by sleep medicine (including the pending referral) is appropriate.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'ferlisi-2014-precipitants',
    relationship: 'Sleep deprivation, stress and fatigue as reported seizure precipitants',
    citation: {
      authors: 'Ferlisi M, Shorvon S',
      title: 'Seizure precipitants (triggering factors) in patients with epilepsy',
      journal: 'Epilepsy & Behavior',
      year: 2014,
      volume: '33',
      pages: '101-105',
      pmid: '24632482',
      doi: '10.1016/j.yebeh.2014.02.019',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/24632482/',
    evidenceType: 'clinical-study',
    population: '104 consecutive adults attending a tertiary epilepsy clinic in London (interview-based).',
    keyFinding:
      'Nearly all patients named at least one precipitant; stress, sleep deprivation and fatigue were the most frequently reported.',
    limitations: ['Patient-reported precipitants, subject to recall and attribution bias.', 'Single tertiary centre.'],
    relevantSignals: ['Calculated sleep or stress pattern'],
    discussionPoint: 'Discuss whether sleep and stress are relevant factors for this patient’s seizures.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'nakken-2005-precipitants',
    relationship: 'Frequently reported seizure precipitants',
    citation: {
      authors: 'Nakken KO, Solaas MH, Kjeldsen MJ, Friis ML, Pellock JM, Corey LA',
      title: 'Which seizure-precipitating factors do patients with epilepsy most frequently report?',
      journal: 'Epilepsy & Behavior',
      year: 2005,
      volume: '6(1)',
      pages: '85-89',
      pmid: '15652738',
      doi: '10.1016/j.yebeh.2004.11.003',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/15652738/',
    evidenceType: 'cross-sectional-survey',
    population: '1,677 people with epilepsy identified through Norwegian, Danish and US twin registries (questionnaire).',
    keyFinding:
      'About half reported at least one precipitant; emotional stress, sleep deprivation and tiredness were the most common. Women with focal (partial) seizures more often reported seizures around menstruation.',
    limitations: ['Closed-ended self-report questionnaire.', 'Twin-registry sample.'],
    relevantSignals: ['Calculated stress, sleep or menstrual pattern'],
    discussionPoint: 'Discuss which factors the patient believes affect their seizures and how reliably they are recorded.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'herzog-1997-catamenial',
    relationship: 'Menstrual-cycle timing ↔ seizure exacerbation (catamenial patterns)',
    citation: {
      authors: 'Herzog AG, Klein P, Ransil BJ',
      title: 'Three patterns of catamenial epilepsy',
      journal: 'Epilepsia',
      year: 1997,
      volume: '38(10)',
      pages: '1082-1088',
      pmid: '9579954',
      doi: '10.1111/j.1528-1157.1997.tb01197.x',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/9579954/',
    evidenceType: 'clinical-study',
    population: '184 women with intractable complex partial (focal impaired awareness) seizures charting one cycle with a day-22 progesterone level.',
    keyFinding:
      'Average daily seizure frequency was higher in the perimenstrual and preovulatory phases of ovulatory cycles; the authors proposed a twofold or greater increase as a reasonable definition of catamenial epilepsy.',
    limitations: [
      'Single cycle per participant; intractable epilepsy population.',
      'Phase assignment in ConnectHealth is calendar-based; ovulation is not confirmed.',
    ],
    relevantSignals: ['Calculated phase-related seizure-rate increase over ≥ 2 cycles'],
    discussionPoint: 'Review whether further cycle charting is useful and whether cycle timing is relevant to management.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'trinka-2015-status-epilepticus',
    relationship: 'Prolonged seizures (status epilepticus definition)',
    citation: {
      authors: 'Trinka E, Cock H, Hesdorffer D, Rossetti AO, Scheffer IE, Shinnar S, Shorvon S, Lowenstein DH',
      title: 'A definition and classification of status epilepticus – Report of the ILAE Task Force on Classification of Status Epilepticus',
      journal: 'Epilepsia',
      year: 2015,
      volume: '56(10)',
      pages: '1515-1523',
      pmid: '26336950',
      doi: '10.1111/epi.13121',
    },
    url: 'https://pubmed.ncbi.nlm.nih.gov/26336950/',
    evidenceType: 'classification-report',
    population: 'ILAE task-force definition (conceptual and operational).',
    keyFinding:
      'For convulsive (tonic-clonic) status epilepticus, a seizure beyond about 5 minutes (t1) should be regarded as continuous seizure activity; 30 minutes (t2) marks risk of long-term consequences.',
    limitations: ['Time points are best current estimates and differ for other seizure types.'],
    relevantSignals: ['Recorded seizure lasting ≥ 5 minutes'],
    discussionPoint: 'Confirm the patient has an up-to-date seizure action plan, including when to use rescue medication and seek emergency care.',
    verifiedOn: '2026-10-24',
  },
  {
    id: 'cdc-seizure-first-aid',
    relationship: 'Seizure first aid – when to seek emergency help',
    citation: {
      authors: 'Centers for Disease Control and Prevention',
      title: 'First Aid for Seizures',
      journal: 'CDC Epilepsy',
      year: 2025,
    },
    url: 'https://www.cdc.gov/epilepsy/first-aid-for-seizures/index.html',
    evidenceType: 'public-health-guidance',
    population: 'General public guidance.',
    keyFinding: 'Time the seizure; if it lasts more than 5 minutes, seek immediate medical attention or call 911.',
    limitations: ['General first-aid guidance; an individual seizure action plan from the treating clinician takes precedence.'],
    relevantSignals: ['Recorded seizure lasting ≥ 5 minutes', 'New seizure type'],
    discussionPoint: 'Review the seizure action plan with the patient and the people around them.',
    verifiedOn: '2026-10-24',
  },
];

export const KB_BY_ID = new Map(KNOWLEDGE_BASE.map((e) => [e.id, e]));

export function evidenceById(id: string): EvidenceEntry | undefined {
  return KB_BY_ID.get(id);
}

export function formatCitation(e: EvidenceEntry): string {
  const c = e.citation;
  const title = /[.?!]$/.test(c.title) ? c.title : `${c.title}.`;
  const parts = [`${c.authors}. ${title} ${c.journal}. ${c.year}`];
  if (c.volume) parts[0] += `;${c.volume}`;
  if (c.pages) parts[0] += `:${c.pages}`;
  parts[0] += '.';
  if (c.doi) parts.push(`doi:${c.doi}`);
  if (c.pmid) parts.push(`PMID: ${c.pmid}`);
  return parts.join(' ');
}
