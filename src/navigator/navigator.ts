/**
 * Care Navigator logic: specialty/service suggestions, next-step pathway, insurance checklist and templates.
 * Suggestions are "may be worth discussing" prompts built from recorded information – never referrals, never
 * statements of medical necessity, and never claims about anyone's coverage.
 */
import type { ConnectionResult } from '../models/analysis';
import type { HealthData, NavigatorState } from '../models/types';
import { CONDITION_BY_ID, SPECIALTY_LABELS, type SpecialtyId } from '../conditions/catalog';
import type { ReviewFlag } from '../review/flags';

export interface SuggestionSource {
  kind: 'condition' | 'symptom' | 'flag' | 'connection';
  label: string;
}

export interface SpecialtySuggestion {
  specialty: SpecialtyId;
  label: string;
  why: string;
  sources: SuggestionSource[];
  uncertainty: string;
  question: string;
  referralNote: string;
  inCareTeam: string | null;
}

const SYMPTOM_TAG_SPECIALTIES: Record<string, SpecialtyId[]> = {
  attention: ['psychiatry', 'psychology'],
  concentration: ['psychiatry', 'psychology'],
  'attention-childhood': ['psychiatry', 'psychology'],
  snoring: ['sleep-medicine'],
  'witnessed-apnea': ['sleep-medicine'],
  'daytime-sleepiness': ['sleep-medicine'],
  insomnia: ['sleep-medicine'],
  mood: ['psychology', 'psychiatry'],
  headache: ['primary-care', 'neurology'],
};

const CONNECTION_SPECIALTIES: Record<string, SpecialtyId[]> = {
  'conn-adhd': ['psychiatry', 'psychology'],
  'conn-sleep-disorder': ['sleep-medicine'],
  'conn-catamenial': ['neurology', 'gynecology'],
  'conn-seizure-change': ['neurology'],
};

function flagSpecialties(f: ReviewFlag): SpecialtyId[] {
  const id = f.findingId ?? '';
  if (f.level === 'red' || id.startsWith('pattern-trend-type')) return ['neurology'];
  if (id.startsWith('pattern-sleep')) return ['sleep-medicine', 'primary-care'];
  if (id.startsWith('pattern-menstrual')) return ['gynecology'];
  return ['primary-care'];
}

export function referralNote(nav: NavigatorState, specialty: SpecialtyId): string {
  if (specialty === 'primary-care') return 'Primary care visits usually do not need a referral, but check your plan’s rules.';
  const p = nav.insurance.planType;
  if (p === 'HMO' || p === 'POS') return `Your recorded plan type is ${p}. Plans of this type often require a primary-care referral before a specialist visit – confirm with your insurer.`;
  if (p === 'PPO' || p === 'EPO') return `Your recorded plan type is ${p}. Some of these plans allow specialist visits without a referral, but rules and networks vary – confirm with your insurer.`;
  if (p) return `Referral rules for your recorded plan type (${p}) vary – confirm with your insurer or member handbook.`;
  return 'Whether a referral or prior authorization is needed depends on your plan. Add your plan type under Insurance details and confirm with your insurer.';
}

export function suggestSpecialties(data: HealthData, flags: ReviewFlag[], connections: ConnectionResult[]): SpecialtySuggestion[] {
  const map = new Map<SpecialtyId, SuggestionSource[]>();
  const add = (s: SpecialtyId, src: SuggestionSource) => {
    const list = map.get(s) ?? [];
    if (!list.some((x) => x.kind === src.kind && x.label === src.label)) list.push(src);
    map.set(s, list);
  };

  for (const h of data.history) {
    if (h.status === 'resolved' || h.status === 'ruled-out') continue;
    const catalog = h.tags.map((t) => CONDITION_BY_ID.get(t)).find(Boolean);
    if (h.kind === 'diagnosis' && catalog) {
      for (const s of catalog.specialties) add(s, { kind: 'condition', label: `${h.label} (${h.status === 'confirmed' ? 'diagnosed' : h.status})` });
    } else if (h.kind === 'diagnosis' && h.tags.includes('custom')) {
      add('primary-care', { kind: 'condition', label: `${h.label} (${h.status === 'confirmed' ? 'diagnosed' : h.status})` });
    } else if (h.kind === 'symptom') {
      const specs = [...new Set(h.tags.flatMap((t) => SYMPTOM_TAG_SPECIALTIES[t] ?? []))];
      for (const s of specs.length ? specs : (['primary-care'] as SpecialtyId[])) add(s, { kind: 'symptom', label: h.label });
    }
  }
  for (const f of flags) for (const s of flagSpecialties(f)) add(s, { kind: 'flag', label: f.title });
  for (const c of connections.filter((x) => x.surfaced)) for (const s of CONNECTION_SPECIALTIES[c.id] ?? []) add(s, { kind: 'connection', label: c.title });
  // Primary care is always offered for coordination.
  if (!map.has('primary-care')) map.set('primary-care', []);

  const team = data.profile.careTeam ?? [];
  const out: SpecialtySuggestion[] = [...map.entries()].map(([specialty, sources]) => {
    const label = SPECIALTY_LABELS[specialty];
    const member = team.find((m) => m.specialty === specialty);
    const kinds = new Set(sources.map((s) => s.kind));
    const why = !sources.length
      ? 'Primary care can coordinate concerns that do not fit neatly into one specialty and advise on referrals.'
      : `May be worth discussing because of ${[
          kinds.has('condition') && 'a recorded condition',
          kinds.has('symptom') && 'a reported symptom',
          kinds.has('flag') && 'a pattern flagged for clinician review',
          kinds.has('connection') && 'an evidence-informed connection surfaced for review',
        ]
          .filter(Boolean)
          .join(', ')}.`;
    return {
      specialty,
      label,
      why,
      sources,
      uncertainty:
        kinds.has('flag') || kinds.has('connection')
          ? 'Patterns and connections are observations from your records, not diagnoses. A clinician decides whether this specialty is appropriate.'
          : 'Based only on what you recorded. It does not mean a referral is needed or that this specialty is right for you.',
      question: member
        ? `Ask your ${label.toLowerCase()} clinician (${member.name}): “Should we review ${sources[0]?.label.toLowerCase() ?? 'this'} at my next visit?”`
        : specialty === 'primary-care'
          ? 'Ask your primary care clinician: “Can we go through my recent records and decide together which concerns need follow-up, and with whom?”'
          : `Ask your primary care clinician or current treating professional: “Would it be useful for me to see ${label.toLowerCase()} about ${sources[0]?.label.toLowerCase() ?? 'my recorded concerns'}?”`,
      referralNote: referralNote(data.navigator, specialty),
      inCareTeam: member ? member.name : null,
    };
  });
  const score = (s: SpecialtySuggestion) => (s.sources.some((x) => x.kind === 'flag') ? 100 : 0) + (s.sources.some((x) => x.kind === 'connection') ? 50 : 0) + s.sources.length * 10 - (s.specialty === 'primary-care' ? 5 : 0);
  return out.sort((a, b) => score(b) - score(a) || a.label.localeCompare(b.label));
}

export interface PathwayStep {
  id: string;
  title: string;
  generic: string;
  personal: string | null;
  link?: { href: string; label: string };
}

export function buildPathway(data: HealthData, flags: ReviewFlag[], questionCount: number): PathwayStep[] {
  const nav = data.navigator;
  const team = data.profile.careTeam ?? [];
  const openTasks = data.tasks.filter((t) => t.status !== 'done').length;
  return [
    { id: 'review', title: 'Review the health concern and relevant data', generic: 'Look at the timeline, patterns and any flagged findings for the concern you want to raise.', personal: flags.length ? `${flags.length} finding(s) are marked for clinician review; ${openTasks} task(s) are open.` : null, link: { href: '#/review', label: 'Clinician Review' } },
    { id: 'prepare', title: 'Prepare a concise summary and questions', generic: 'Bring a short summary, your medication list and 2–3 questions.', personal: questionCount ? `${questionCount} suggested question(s) are ready in your report.` : null, link: { href: '#/summary', label: 'Clinician Summary / PDF' } },
    { id: 'who', title: 'Decide whether to contact primary care or an existing specialist', generic: 'If a specialist already manages the condition, they are often the first contact; otherwise start with primary care.', personal: team.length ? `Your recorded care team: ${team.map((m) => `${m.name} (${m.specialty.replace('-', ' ')})`).join('; ')}.` : null, link: { href: '#/settings', label: 'Edit care team' } },
    { id: 'referral', title: 'Check whether a referral or prior authorization may be needed', generic: 'Requirements depend on your plan and the service. Ask your insurer or your clinician’s office.', personal: nav.insurance.planType ? referralNote(nav, 'neurology') : null },
    { id: 'insurer', title: 'Contact the insurer or review member benefits', generic: 'Use the call template below and record the reference number.', personal: nav.insurance.insurer ? `Recorded insurer: ${nav.insurance.insurer}${nav.insurance.phone ? `, ${nav.insurance.phone}` : ''}.` : null },
    { id: 'network', title: 'Identify in-network providers and appointment requirements', generic: 'Use your insurer’s provider directory and ask offices about referrals, records and wait times.', personal: null },
    { id: 'record', title: 'Record the outcome and schedule the next follow-up', generic: 'Log who you spoke to, what was decided and the next follow-up date.', personal: nav.contacts.length ? `${nav.contacts.length} contact(s) logged so far.` : null, link: { href: '#/tasks', label: 'Care Tasks' } },
  ];
}

export const INSURANCE_CHECKLIST: Array<{ id: string; label: string; hint: string }> = [
  { id: 'in-network', label: 'Check whether the specialist is in network', hint: 'Ask for the provider’s name and location to be confirmed.' },
  { id: 'referral', label: 'Understand referral requirements', hint: 'Who must send it, and how long it is valid.' },
  { id: 'prior-auth', label: 'Check whether prior authorization may be needed', hint: 'For the visit, tests or treatments being discussed.' },
  { id: 'costs', label: 'Ask about deductible, copay, coinsurance and visit limits', hint: 'Note amounts exactly as the insurer states them.' },
  { id: 'therapy-tests', label: 'Ask about coverage for therapy or diagnostic testing', hint: 'e.g. sleep studies, therapy sessions, lab tests.' },
  { id: 'contact-details', label: 'Record insurer contact details and reference numbers', hint: 'Use the contact log below.' },
  { id: 'claims', label: 'Track claim questions or denied-service follow-ups', hint: 'Note claim numbers and deadlines you are given.' },
  { id: 'availability', label: 'Record appointment availability and waitlists', hint: 'Add follow-up dates as tasks.' },
];

export interface Template {
  id: string;
  title: string;
  body: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'insurer-call',
    title: 'Calling an insurance company',
    body: 'Hello, my name is [your name] and my member ID is [member ID]. I am checking my benefits for a possible appointment with a [specialty] provider. Could you confirm whether this specialty is covered under my plan, whether I need a referral or prior authorization, and how I can find an in-network provider? Could you also explain my expected out-of-pocket costs? May I have a reference number for this call?',
  },
  {
    id: 'pcp-referral',
    title: 'Requesting referral information from a primary care office',
    body: 'Hello, this is [your name], date of birth [date of birth]. I would like to ask whether Dr. [clinician name] thinks a referral to [specialty] is appropriate for [concern]. If so, could you tell me how the referral is sent, how long it takes and whether my insurer needs any paperwork?',
  },
  {
    id: 'specialist-office',
    title: 'Contacting a specialist’s office',
    body: 'Hello, I am [your name]. I am looking for an appointment with a [specialty] provider. Are you accepting new patients with [insurer]? Do you need a referral or records before the first visit, and what is the current wait time?',
  },
  {
    id: 'ask-clinician-flag',
    title: 'Asking a clinician about a flagged pattern',
    body: 'Hi Dr. [clinician name], I have been tracking my health data and an app I use flagged this for discussion: [pattern summary]. It is only an observation from my own records and may not mean anything, but I would like to know whether it is worth looking into. I can bring the report to my next appointment.',
  },
  {
    id: 'denied-claim',
    title: 'Asking an insurer about a denied claim',
    body: 'Hello, my name is [your name], member ID [member ID]. I am calling about claim [claim number] for [service] on [date of service], which was denied. Could you explain the reason for the denial, what information would be needed to reconsider it, and what the deadline and process are for an appeal? May I have a reference number for this call?',
  },
];

/** Replace [placeholders] with provided values; unknown placeholders are left visible for the user to edit. */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\[([^\]]+)\]/g, (m, key: string) => (values[key]?.trim() ? values[key].trim() : m));
}
