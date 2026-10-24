/**
 * Ask My Health Data – a rule-based prototype assistant. NO language model is connected.
 *
 * Questions are matched to intents with keyword rules and answered by deterministic builders that read only the
 * stored records, the analysis results and the curated knowledge base. Every answer lists its sources and the
 * information that is missing. Safety intents (emergencies, diagnosis or prescribing requests) are checked first.
 */
import { allOutcomeFindings } from '../analysis';
import type { ConnectionResult, DateWindow, PatternFinding } from '../models/analysis';
import type { HealthData, OutcomeKey } from '../models/types';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import type { CompletenessReport, SeizureSummary } from '../analysis/completeness';
import { summarizeSleep } from '../analysis/completeness';
import type { InsufficientItem, ReviewFlag } from '../review/flags';
import { getOutcome, outcomeOfFindingId } from '../analysis/outcomes';
import { formatWindow, inWindow } from '../analysis/dates';
import { currentMedications, doseOn } from '../analysis/medicationInfo';
import { duration, plural } from '../analysis/format';

export interface AssistantContext {
  data: HealthData;
  window: DateWindow;
  findingsByOutcome: Partial<Record<OutcomeKey, PatternFinding[]>>;
  flags: ReviewFlag[];
  insufficient: InsufficientItem[];
  connections: ConnectionResult[];
  completeness: CompletenessReport;
  seizures: SeizureSummary;
  sleepThreshold: number;
}

export interface AssistantSource {
  label: string;
  href?: string;
}

export interface AssistantAnswer {
  intent: string;
  kind: 'answer' | 'unsupported' | 'safety' | 'emergency';
  text: string;
  bullets: string[];
  sources: AssistantSource[];
  missing: string[];
  questions: string[];
}

export const SUGGESTED_QUESTIONS = [
  'What patterns have appeared in my health data over the last three months?',
  'Have my symptoms changed since my medication was adjusted?',
  'What information should I bring to my next appointment?',
  'Can you summarize the relationship between my sleep and recorded events?',
  'Which of my recorded concerns might be worth discussing with my doctor?',
  'What follow-up tasks have I not completed?',
];

const SUPPORTED_TOPICS = [
  'patterns in your recorded data',
  'changes around medication adjustments',
  'what to bring to an appointment',
  'sleep and recorded events',
  'concerns worth discussing with a clinician',
  'outstanding follow-up tasks',
  'your recorded allergies',
  'missing or incomplete data',
  'your most recent recorded event',
  'menstrual-cycle timing (if tracked)',
  'stress (if recorded)',
];

const RULES: Array<{ intent: string; re: RegExp }> = [
  { intent: 'emergency', re: /(won'?t stop|not stopping|still seizing|can'?t breathe|cannot breathe|trouble breathing|unconscious|not waking|won'?t wake|chest pain|anaphyla|throat (?:is )?(?:swelling|closing|tight)|swollen (?:throat|tongue)|suicid|kill myself|end my life|overdos)/i },
  { intent: 'safety', re: /(do i have|diagnos|what (disease|condition|illness) do i|is (it|this) (cancer|a tumou?r|serious)|\bcancer\b|tumou?r|should i (stop|start|increase|decrease|change|take|skip|double)|what dose|how much .{0,30} should i take|prescribe)/i },
  { intent: 'allergies', re: /(allerg|intoleran|react(ion)? to)/i },
  { intent: 'tasks', re: /(task|follow.?up|to.?do|outstanding|not (yet )?(done|completed)|haven'?t (done|completed))/i },
  { intent: 'medication', re: /(medic|dose|drug|pill|adjust|levetiracetam|treatment change)/i },
  { intent: 'appointment', re: /(appointment|bring|prepare|visit|what should i (say|ask))/i },
  { intent: 'sleep', re: /(sleep|slept|night)/i },
  { intent: 'cycle', re: /(period|menstrual|cycle)/i },
  { intent: 'stress', re: /(stress|anxi)/i },
  { intent: 'discuss', re: /(discuss|worth|concern|doctor|clinician|flag)/i },
  { intent: 'last-event', re: /(last|latest|most recent).{0,20}(seizure|event|episode)/i },
  { intent: 'missing', re: /(missing|incomplete|complete|gaps?|how much data)/i },
  { intent: 'patterns', re: /(pattern|trend|chang|insight|found|appeared|summar)/i },
];

export function matchIntent(question: string): string {
  const q = question.replace(/[‘’]/g, "'");
  return RULES.find((r) => r.re.test(q))?.intent ?? 'unsupported';
}

const periodNote = (c: AssistantContext) => `Based on your records for ${formatWindow(c.window)} (the period selected in the top bar).`;

function allFindings(c: AssistantContext): PatternFinding[] {
  return allOutcomeFindings(c.findingsByOutcome);
}

function outcomeLabel(f: PatternFinding) {
  return getOutcome(outcomeOfFindingId(f.id)).label;
}

function base(intent: string): AssistantAnswer {
  return { intent, kind: 'answer', text: '', bullets: [], sources: [], missing: [], questions: [] };
}

export function answerQuestion(question: string, c: AssistantContext): AssistantAnswer {
  const q = question.trim();
  const intent = q ? matchIntent(q) : 'unsupported';
  const a = base(intent);
  const findings = allFindings(c);

  switch (intent) {
    case 'emergency':
      return {
        ...a,
        kind: 'emergency',
        text: 'If this is happening now, please get help immediately: call 911 (or your local emergency number). For a seizure lasting more than 5 minutes, follow your seizure action plan and call 911. For a severe allergic reaction, use your epinephrine auto-injector if you have one and call 911. If you are thinking about suicide or self-harm, call or text 988 (Suicide & Crisis Lifeline, US).',
        bullets: ['I am a rule-based prototype and cannot assess emergencies.'],
        sources: [{ label: 'CDC – First Aid for Seizures', href: 'https://www.cdc.gov/epilepsy/first-aid-for-seizures/index.html' }],
      };
    case 'safety':
      return {
        ...a,
        kind: 'safety',
        text: 'I can’t diagnose conditions, say whether something is serious, or advise on starting, stopping or changing medication. Those decisions need a qualified clinician who knows your history.',
        bullets: [
          `I can summarise what you have recorded: ${plural(c.flags.length, 'finding')} marked for clinician review and ${plural(c.connections.filter((x) => x.surfaced).length, 'connection')} surfaced for review in this period.`,
          'Your Clinician Summary or PDF report can help you raise the question at an appointment.',
        ],
        sources: [
          { label: 'Clinician Review', href: '#/review' },
          { label: 'Clinician Summary', href: '#/summary' },
        ],
        questions: ['Could we go through my recorded symptoms and decide whether any further assessment is needed?'],
      };

    case 'patterns': {
      const supported = findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change');
      a.text = supported.length
        ? `${periodNote(c)} ${plural(supported.length, 'possible pattern or notable change')} met the engine’s rules. These are observations from your records, not causes or diagnoses.`
        : `${periodNote(c)} No analysis met the rules for a possible pattern.`;
      a.bullets = supported.map((f) => `${outcomeLabel(f)} – ${f.title}: ${f.explanation}`);
      const unclear = findings.filter((f) => f.status === 'no-clear-pattern');
      if (unclear.length) a.bullets.push(`No clear pattern: ${unclear.map((f) => f.title).join('; ')}.`);
      a.sources = [{ label: 'Pattern Discovery', href: '#/patterns' }, ...(c.flags.length ? [{ label: 'Clinician Review', href: '#/review' }] : [])];
      a.missing = c.insufficient.map((i) => `${i.title}: ${i.reason}`);
      if (/three months|3 months|90 days|quarter/i.test(q) && c.completeness.calendarDays < 85)
        a.missing.unshift(`You asked about three months, but the selected period is ${c.completeness.calendarDays} days. Choose “Last 90 days” in the top bar to widen it.`);
      a.questions = c.flags.flatMap((f) => f.questions).slice(0, 3);
      if (!findings.length) a.missing.push('No outcome has enough recorded data to analyse yet – add daily check-ins or events.');
      return a;
    }

    case 'medication': {
      const med = findings.filter((f) => f.factor === 'medication');
      const changes = med.filter((f) => f.status !== 'not-applicable');
      if (!changes.length) {
        a.text = `${periodNote(c)} No medication starts, stops or dose changes were recorded in this period, so I can’t compare before and after.`;
        a.missing.push('Record medication changes under Records → Medications to enable this comparison.');
        a.sources = [{ label: 'Records – Medications', href: '#/records' }];
        return a;
      }
      a.text = `${periodNote(c)} I compared recorded outcomes in the 28 days before and after each change. These are timing associations only – they do not show whether a medication works.`;
      a.bullets = changes.map((f) => `${outcomeLabel(f)} – ${f.title}. ${f.status === 'insufficient-data' ? f.suppressionReason : f.explanation}`);
      a.sources = [{ label: 'Pattern Discovery – medication changes', href: '#/patterns' }, ...changes.flatMap((f) => f.involvedDates.slice(0, 1).map((d) => ({ label: `Timeline ${d}`, href: `#/timeline?date=${d}` })))];
      a.missing = changes.flatMap((f) => f.exclusions.filter((e) => e.days > 1).map((e) => `${outcomeLabel(f)}: ${e.reason} – ${e.days} days`));
      const sideEffects = c.data.medicationEvents.filter((e) => e.kind === 'side-effect' && inWindow(e.date, c.window));
      if (sideEffects.length) a.bullets.push(`You also recorded ${plural(sideEffects.length, 'side effect')}: ${sideEffects.map((e) => `${e.date} – ${e.description}`).join('; ')}.`);
      a.questions = ['How should we interpret the timing of my recorded symptoms around this medication change?'];
      return a;
    }

    case 'appointment': {
      const meds = currentMedications(c.data, c.window.end);
      a.text = `${periodNote(c)} Here is what you could bring, drawn from your records:`;
      a.bullets = [
        meds.length ? `Current medications: ${meds.map((m) => `${m.name} ${doseOn(m, c.data.medicationEvents, c.window.end)} ${m.frequency}`).join('; ')}.` : 'No current medications are recorded.',
        `${plural(c.flags.length, 'finding')} marked for clinician review${c.flags.length ? `: ${c.flags.map((f) => f.title).join('; ')}` : ''}.`,
        c.data.allergies.length ? `Allergies: ${c.data.allergies.filter((x) => x.status !== 'resolved').map((x) => `${x.substance}${x.reaction ? ` (${x.reaction})` : ''}`).join('; ')}.` : c.data.profile.noKnownAllergies ? 'Allergies: no known allergies (as you recorded).' : 'Allergies: not recorded – consider adding them in Records.',
        `Data completeness: check-ins on ${c.completeness.checkInDays} of ${c.completeness.calendarDays} days.`,
        `${plural(c.data.tasks.filter((t) => t.status !== 'done').length, 'open task')} in Care Tasks.`,
        'A PDF of your Clinician Summary (Clinician Summary → Download PDF).',
      ];
      a.questions = [...new Set(c.flags.flatMap((f) => f.questions))].slice(0, 4);
      a.sources = [
        { label: 'Clinician Summary', href: '#/summary' },
        { label: 'Clinician Review', href: '#/review' },
        { label: 'Care Tasks', href: '#/tasks' },
      ];
      return a;
    }

    case 'sleep': {
      const s = summarizeSleep(c.data, c.window, c.sleepThreshold);
      const sleepF = findings.filter((f) => f.factor === 'sleep');
      a.text = s.meanHours === null ? `${periodNote(c)} No sleep has been recorded in this period.` : `${periodNote(c)} You recorded sleep on ${s.recordedNights} nights (mean ${s.meanHours.toFixed(1)} h; ${s.nightsBelow} nights under ${s.threshold} h).`;
      a.bullets = sleepF.map((f) => `${outcomeLabel(f)} – ${f.title}. ${f.status === 'insufficient-data' ? f.suppressionReason : f.explanation}`);
      a.missing = [`${c.completeness.calendarDays - s.recordedNights} nights have no sleep recorded and are excluded, not counted as zero.`];
      a.sources = [
        { label: 'Pattern Discovery – sleep', href: '#/patterns' },
        { label: 'Health Timeline', href: '#/timeline' },
      ];
      if (sleepF.some((f) => f.status === 'possible-pattern')) a.questions = ['My records show more events after short nights – is this worth looking into, and what else could explain it?'];
      return a;
    }

    case 'cycle': {
      const f = c.findingsByOutcome.seizures?.find((x) => x.factor === 'menstrual-cycle') ?? findings.find((x) => x.factor === 'menstrual-cycle');
      if (!c.data.menstrual.length || !f) {
        a.text = 'No menstrual-cycle records are stored, so I can’t say anything about cycle timing. This is optional and not assumed to be relevant to you.';
        a.sources = [{ label: 'Settings – Trackers', href: '#/settings' }];
        return a;
      }
      a.text = `${periodNote(c)} ${f.title}.`;
      a.bullets = [f.status === 'insufficient-data' ? (f.suppressionReason ?? '') : f.explanation, 'Phases are calendar estimates; ovulation is not confirmed.'];
      a.sources = [{ label: 'Pattern Discovery – menstrual cycle', href: '#/patterns' }];
      return a;
    }

    case 'stress': {
      const st = findings.filter((x) => x.factor === 'stress');
      a.text = st.length ? `${periodNote(c)} Here is how recorded stress compared:` : 'No stress ratings are available to analyse.';
      a.bullets = st.map((f) => `${outcomeLabel(f)} – ${f.title}. ${f.status === 'insufficient-data' ? f.suppressionReason : f.explanation}`);
      a.missing = ['Stress is a single daily rating; I do not analyse voice tone or emotions.'];
      a.sources = [{ label: 'Pattern Discovery – stress', href: '#/patterns' }];
      return a;
    }

    case 'discuss': {
      const surfaced = c.connections.filter((x) => x.surfaced);
      const reported = c.data.history.filter((h) => h.kind === 'symptom' && h.status !== 'resolved' && h.status !== 'ruled-out');
      a.text = `${periodNote(c)} These recorded items may be worth raising. None of them is a diagnosis.`;
      a.bullets = [
        ...c.flags.map((f) => `Flagged for clinician review (${f.level}): ${f.title}.`),
        ...surfaced.map((x) => `Potential connection (unconfirmed): ${x.title}.`),
        ...reported.map((h) => `You reported: ${h.label}.`),
      ];
      if (!a.bullets.length) a.bullets.push('Nothing is flagged or surfaced in this period, and no symptoms are recorded in your history.');
      a.questions = [...new Set([...c.flags.flatMap((f) => f.questions), ...surfaced.map((x) => x.discussionPoint)])].slice(0, 4);
      a.sources = [
        { label: 'Clinician Review', href: '#/review' },
        { label: 'Clinical Connections', href: '#/connections' },
        { label: 'Records – Symptoms & history', href: '#/records' },
      ];
      return a;
    }

    case 'allergies': {
      const list = c.data.allergies.filter((x) => x.status !== 'resolved');
      a.text = list.length ? `You have recorded ${plural(list.length, 'allergy', 'allergies')}:` : c.data.profile.noKnownAllergies ? 'You recorded that you have no known allergies.' : 'No allergies are recorded. That means “not recorded”, not “no allergies”.';
      a.bullets = list.map((x) => `${x.substance} (${x.category})${x.reaction ? ` – ${x.reaction}` : ''}; severity ${x.severity === 'unknown' ? 'not recorded' : x.severity}; ${x.source.replace('-', ' ')}.`);
      a.sources = [{ label: 'Records – Allergies', href: '#/records' }];
      if (list.some((x) => x.severity === 'severe')) a.questions = ['Is my allergy information up to date in my medical and pharmacy records, and do I need an emergency plan?'];
      return a;
    }

    case 'tasks': {
      const open = c.data.tasks.filter((t) => t.status !== 'done').sort((x, y) => (x.dueDate ?? '9999').localeCompare(y.dueDate ?? '9999'));
      a.text = open.length ? `You have ${plural(open.length, 'task')} not completed:` : 'All recorded tasks are completed.';
      a.bullets = open.map((t) => `${t.title} – ${t.status.replace('-', ' ')}${t.dueDate ? `, due ${t.dueDate}` : ''}${t.followUpDate ? `, follow up ${t.followUpDate}` : ''}.`);
      a.sources = [{ label: 'Care Tasks', href: '#/tasks' }];
      return a;
    }

    case 'last-event': {
      const s = c.seizures.mostRecentOverall;
      if (!s) {
        a.text = 'No seizures or events are recorded.';
        return a;
      }
      a.text = `Your most recent recorded seizure was on ${s.date}${s.time ? ` at ${s.time}` : ''}: ${SEIZURE_TYPE_LABELS[s.type].toLowerCase()}, ${duration(s.durationSeconds)}.`;
      a.sources = [{ label: `Timeline ${s.date}`, href: `#/timeline?date=${s.date}` }];
      return a;
    }

    case 'missing': {
      a.text = `${periodNote(c)} Check-ins were recorded on ${c.completeness.checkInDays} of ${c.completeness.calendarDays} days.`;
      a.bullets = c.completeness.fields.map((f) => `${f.label}: ${f.recordedDays} of ${f.calendarDays} days.`);
      a.missing = c.insufficient.map((i) => `${i.title}: ${i.reason}`);
      a.sources = [{ label: 'Overview – data completeness', href: '#/overview' }];
      return a;
    }
  }

  return {
    ...a,
    kind: 'unsupported',
    text: 'I can’t answer that from your stored data. I’m a rule-based prototype that only answers questions about your own records and calculations.',
    bullets: [`I can help with: ${SUPPORTED_TOPICS.join('; ')}.`],
  };
}
