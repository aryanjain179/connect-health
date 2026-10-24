/**
 * Deterministic extraction of PROPOSED journal entries from a transcript. Nothing here writes data.
 *
 * Rules
 * - Only values explicitly stated are proposed; nothing is inferred (no severity from mood words, no dose amounts,
 *   no seizure type). Missing details become clarification prompts.
 * - Simple negation ("no headache", "didn't have a seizure") is respected: a negated symptom is proposed as "No"
 *   (a recorded negative the user stated); a negated event creates nothing.
 * - Each proposal keeps the exact phrase it came from so the user can check it.
 * - Menstrual bleeding is proposed as a yes/no answer for the day, never inferred from cycle timing.
 * - No tone-of-voice or emotion detection: only the words are used.
 */
import type { ISODate, Medication } from '../models/types';
import { addDays } from '../analysis/dates';

export type ProposalKind =
  | 'sleepHours'
  | 'stress'
  | 'headache'
  | 'dizziness'
  | 'illness'
  | 'attentionDifficulty'
  | 'otherSymptom'
  | 'seizure'
  | 'missedDose'
  | 'sideEffect'
  | 'menstrualBleeding';

export interface Proposal {
  id: string;
  kind: ProposalKind;
  label: string;
  date: ISODate;
  /** sleepHours / stress rating: number|null; symptoms: boolean; otherSymptom: string; events: null. */
  value: number | boolean | string | null;
  evidence: string;
  note: string;
  clarification: string | null;
  /** Medication for missed-dose / side-effect proposals (null = user must choose). */
  medicationId: string | null;
  /** Seizure details stated in the transcript. */
  seizureTime: string | null;
  seizureDurationSeconds: number | null;
}

export interface ExtractContext {
  today: ISODate;
  medications: Medication[];
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60, a: 1, an: 1,
};
const NUM = '(\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|forty-five|sixty|an?)';

export function parseNumber(s: string): number | null {
  const t = s.toLowerCase();
  if (/^\d/.test(t)) return Number(t);
  return t in NUMBER_WORDS ? NUMBER_WORDS[t] : null;
}

/** Split into clauses so each proposal quotes a short phrase. */
export function clauses(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+|,\s*(?:and\s+|but\s+|then\s+)?|\s+(?:and then|but|and)\s+(?=(?:i|i'm|i've|my|felt|had|have|got|was|slept|took|missed|forgot|no|didn't|did not)\b)/i)
    .map((c) => c.trim().replace(/^(and|but|then)\s+/i, '').replace(/[.!?;]+$/, ''))
    .filter((c) => c.length > 1);
}

function negated(clause: string, keyword: RegExp): boolean {
  const neg = new RegExp(`\\b(no|not|without|never|didn'?t\\s+(?:have|get|feel|notice)|did\\s+not\\s+(?:have|get|feel|notice)|haven'?t\\s+had|wasn'?t)\\s+(?:\\w+\\s+){0,2}?(?:${keyword.source})`, 'i');
  return neg.test(clause);
}

const TIME_PHRASE = /\b(after (?:lunch|dinner|breakfast|work|school)|this (?:morning|afternoon|evening)|tonight|last night|in the (?:morning|afternoon|evening)|at night|at \d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)\b/i;

function clockTime(clause: string): string | null {
  const m = clause.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h <= 12 && !m[2]) return null; // "at 3" is ambiguous without am/pm
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function matchMedication(clause: string, meds: Medication[]): { id: string | null; clarification: string | null } {
  const lc = clause.toLowerCase();
  const named = meds.find((m) => lc.includes(m.name.toLowerCase()));
  if (named) return { id: named.id, clarification: null };
  const active = meds.filter((m) => m.endDate === null && m.kind !== 'rescue');
  if (active.length === 1) return { id: active[0].id, clarification: `No medication was named – confirm this was ${active[0].name}.` };
  return { id: null, clarification: active.length ? 'Which medication was this? It was not named.' : 'No current medication is recorded – add it in Records first, or reject this entry.' };
}

export function extractProposals(rawText: string, ctx: ExtractContext): Proposal[] {
  const text = rawText.replace(/[‘’]/g, "'");
  const out: Proposal[] = [];
  let n = 0;
  const push = (p: Omit<Proposal, 'id' | 'note' | 'clarification' | 'medicationId' | 'seizureTime' | 'seizureDurationSeconds'> & Partial<Proposal>) =>
    out.push({ id: `p${++n}`, note: '', clarification: null, medicationId: null, seizureTime: null, seizureDurationSeconds: null, ...p });

  for (const clause of clauses(text)) {
    const lc = clause.toLowerCase();
    const date = /\byesterday\b/.test(lc) && !/last night/.test(lc) ? addDays(ctx.today, -1) : ctx.today;
    const when = clause.match(TIME_PHRASE)?.[0] ?? '';

    // Sleep duration – only when hours are stated.
    if (/\b(slept|sleep|got)\b/.test(lc)) {
      const m = lc.match(new RegExp(`${NUM}(\\s+and\\s+a\\s+half)?\\s*(?:hours?|hrs?|h)\\b`));
      if (m) {
        const base = parseNumber(m[1]);
        const hours = base === null ? null : base + (m[2] ? 0.5 : 0);
        if (hours !== null && hours >= 0 && hours <= 24) {
          const approx = /\b(about|around|roughly|maybe|approximately|almost|nearly)\b/.test(lc);
          push({ kind: 'sleepHours', label: 'Sleep duration (night before)', date: ctx.today, value: hours, evidence: clause, note: approx ? 'You said this was approximate.' : '' });
        }
      }
    }

    // Stress – a rating only if a number out of 10 is stated; otherwise a note plus an optional rating prompt.
    const stressNum = lc.match(/stress(?:ed)?(?: level)?(?: was| is| at| of|:)?\s*(?:about |around )?(\d{1,2})(?:\s*(?:\/|out of)\s*10)?/);
    const stressWord = lc.match(/\b(anxious|anxiety|stressed|stressful|overwhelmed|panicky|worried|on edge)\b/);
    if (stressNum && Number(stressNum[1]) <= 10) {
      push({ kind: 'stress', label: 'Stress rating (0–10)', date, value: Number(stressNum[1]), evidence: clause, note: stressWord?.[0] ?? '' });
    } else if (stressWord && !negated(clause, /anxious|anxiety|stressed|stressful|overwhelmed|worried/)) {
      push({ kind: 'stress', label: 'Stress / anxiety (as you described it)', date, value: null, evidence: clause, note: `described as “${stressWord[0]}”${when ? ` ${when}` : ''}`, clarification: 'You described feeling this way but gave no rating. Add a 0–10 rating if you want one – it will not be guessed.' });
    }

    const symptom = (kind: ProposalKind, label: string, re: RegExp) => {
      if (!re.test(lc)) return;
      const neg = negated(clause, re);
      push({ kind, label, date, value: !neg, evidence: clause, note: neg ? 'Stated as not present.' : when });
    };
    symptom('headache', 'Headache', /headaches?|migraines?/);
    symptom('dizziness', 'Dizziness', /dizz\w*|light.?headed|vertigo/);
    symptom('illness', 'Illness', /\bflu\b|fever|\bsick\b|a cold\b|head cold|infection/);
    if (/couldn'?t (?:focus|concentrate)|could not (?:focus|concentrate)|trouble (?:focusing|concentrating)|hard to (?:focus|concentrate)|brain fog|unable to (?:focus|concentrate)/.test(lc)) {
      push({ kind: 'attentionDifficulty', label: 'Attention / concentration difficulty', date, value: true, evidence: clause, note: when });
    } else if (/no trouble (?:focusing|concentrating)|focus(?:ed)? (?:fine|well)/.test(lc)) {
      push({ kind: 'attentionDifficulty', label: 'Attention / concentration difficulty', date, value: false, evidence: clause, note: 'Stated as not present.' });
    }
    for (const [re, label] of [
      [/\bnause\w*|felt sick to my stomach/, 'nausea'],
      [/\b(tired|exhausted|fatigue\w*|wiped out)\b/, 'fatigue'],
      [/\birritab\w*|\bsnappy\b/, 'irritability'],
    ] as const) {
      if (re.test(lc) && !negated(clause, re)) push({ kind: 'otherSymptom', label: `Other symptom: ${label}`, date, value: label, evidence: clause, note: when });
    }

    // Seizure – type and severity are never inferred.
    const seizureRe = /\b(seizures?|convuls\w*)\b|\bhad (?:a|another) fit\b/;
    if (seizureRe.test(lc) && !negated(clause, /seizures?|fit/) && !/\bno seizures?\b/.test(lc)) {
      const d = lc.match(new RegExp(`(?:lasted|lasting|for)\\s+(?:about |around |maybe )?${NUM}\\s*(seconds?|secs?|minutes?|mins?)`));
      const qty = d ? parseNumber(d[1]) : null;
      const secs = qty === null || !d ? null : /min/.test(d[2]) ? Math.round(qty * 60) : Math.round(qty);
      const time = clockTime(clause);
      push({
        kind: 'seizure',
        label: 'Seizure event',
        date,
        value: null,
        evidence: clause,
        seizureTime: time,
        seizureDurationSeconds: secs,
        note: [time ? `at ${time}` : when, secs ? `about ${secs} s` : ''].filter(Boolean).join(', '),
        clarification: `Type ${secs ? '' : 'and duration '}not stated – the type will be saved as “Unknown” unless you edit it later.${time ? '' : ' Time not stated.'}`,
      });
    }

    // Medication adherence and side effects – doses are never invented.
    if (/\b(missed|forgot|skipped)\b.{0,30}\b(dose|meds?|medication|pills?|tablets?)\b|\b(missed|forgot|skipped)\b/.test(lc) && /dose|meds?|medication|pill|tablet|take/.test(lc)) {
      const med = matchMedication(clause, ctx.medications);
      const part = lc.match(/\b(morning|evening|night|afternoon|lunchtime)\b/)?.[1];
      push({ kind: 'missedDose', label: 'Missed dose', date, value: null, evidence: clause, medicationId: med.id, clarification: med.clarification, note: part ? `${part} dose` : '' });
    }
    if (/side.?effects?|made me (?:feel )?\w+|since (?:starting|taking) /.test(lc)) {
      const med = matchMedication(clause, ctx.medications);
      push({ kind: 'sideEffect', label: 'Possible side effect (your description)', date, value: clause, evidence: clause, medicationId: med.id, clarification: med.clarification });
    }

    // Menstrual bleeding today (yes / no as stated).
    const bleedNo = /\b(no (?:menstrual )?bleeding|not bleeding|no spotting|period (?:ended|finished|stopped|is over))\b/.test(lc);
    const bleedYes = /\b(period (?:started|came|began|arrived)|started my period|got my period|my period is here|(?:i'm|i am|still) on my period|menstrual bleeding|bleeding (?:today|this morning|lightly|heavily)|spotting)\b/.test(lc);
    if (bleedNo || bleedYes) {
      push({ kind: 'menstrualBleeding', label: 'Menstrual bleeding on this day', date, value: !bleedNo, evidence: clause, note: bleedNo ? 'Stated as no bleeding.' : '' });
    }
  }
  return out;
}
