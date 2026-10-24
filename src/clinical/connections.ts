/**
 * Evidence-informed clinical connections.
 *
 * Each rule surfaces a POTENTIAL connection for clinician review only when patient-specific signals exist.
 * A confirmed epilepsy diagnosis alone never surfaces anything. Rules never diagnose, never estimate individual
 * probabilities, never recommend medication changes and never predict cancer or other diseases.
 */
import type { ConnectionResult, DateWindow, PatientSignal, PatternFinding } from '../models/analysis';
import type { HealthData, HistoryRecord } from '../models/types';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { buildContext, sortByDateId } from '../analysis/context';
import { isNocturnal } from '../analysis/sleep';
import { PROLONGED_SECONDS } from '../analysis/completeness';
import { duration, pct, plural } from '../analysis/format';
import { validateConnection } from './safety';

export const MIN_DAILY_SIGNAL_DAYS = 14;
export const DAILY_SIGNAL_SHARE = 0.3;

const ACTIVE_STATUSES: HistoryRecord['status'][] = ['confirmed', 'suspected', 'patient-reported', 'pending'];

function withTags(data: HealthData, tags: string[], statuses = ACTIVE_STATUSES): HistoryRecord[] {
  return data.history
    .filter((h) => statuses.includes(h.status) && h.tags.some((t) => tags.includes(t)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function epilepsyDiagnosis(data: HealthData): HistoryRecord | undefined {
  return data.history.find((h) => h.kind === 'diagnosis' && h.status === 'confirmed' && h.tags.includes('epilepsy'));
}

function diagnosisSignal(h: HistoryRecord): PatientSignal {
  return { kind: 'confirmed-diagnosis', label: h.label, detail: `Documented diagnosis (${h.source.replace('-', ' ')}).`, sourceId: h.id };
}

function reportedSignal(h: HistoryRecord): PatientSignal {
  return {
    kind: h.source === 'patient-reported' ? 'patient-reported-symptom' : 'history-context',
    label: h.label,
    detail: `${h.kind === 'history' ? 'Patient-reported history' : 'Patient-reported symptom'}${h.date ? `, recorded ${h.date}` : ''}.`,
    sourceId: h.id,
  };
}

function base(id: string, title: string, category: ConnectionResult['category']): ConnectionResult {
  return {
    id,
    title,
    category,
    surfaced: false,
    rationale: '',
    hypothesis: null,
    signals: [],
    evidenceIds: [],
    confounders: [],
    limitations: [],
    discussionPoint: '',
    urgency: 'routine',
  };
}

// ---------------------------------------------------------------------------------------------------------------

function adhdRule(data: HealthData, window: DateWindow, findings: PatternFinding[]): ConnectionResult {
  const c = base('conn-adhd', 'Attention symptoms and epilepsy – possible ADHD-related evaluation', 'potential-comorbidity');
  c.evidenceIds = data.profile.age >= 18 ? ['ettinger-2015-adhd-adults', 'auvin-2018-adhd-children'] : ['auvin-2018-adhd-children', 'ettinger-2015-adhd-adults'];
  c.discussionPoint =
    'Ask about onset (including childhood), duration and day-to-day impact of attention symptoms, and whether a structured assessment by a clinician experienced in ADHD is appropriate after accounting for sleep, seizures and medication effects.';
  c.limitations = [
    'Population studies describe groups, not this patient; they do not give an individual likelihood.',
    'Daily attention ratings are self-reported yes/no answers.',
    'This is a hypothesis for clinician review, not a diagnosis.',
  ];

  const epi = epilepsyDiagnosis(data);
  const existing = withTags(data, ['adhd'], ['confirmed']);
  const ruledOut = withTags(data, ['adhd'], ['ruled-out']);
  if (!epi) {
    c.rationale = 'No confirmed epilepsy diagnosis is documented, so this epilepsy-specific connection is not evaluated.';
    return c;
  }
  c.signals.push(diagnosisSignal(epi));
  if (existing.length) {
    c.rationale = `ADHD is already a documented diagnosis (${existing[0].label}); no new assessment suggestion is generated.`;
    return c;
  }
  if (ruledOut.length) {
    c.rationale = `A previous ADHD evaluation is recorded as ruled out (${ruledOut[0].label}); not surfaced again automatically.`;
    return c;
  }

  const reported = withTags(data, ['attention', 'concentration', 'hyperactivity', 'impulsivity', 'attention-childhood']);
  c.signals.push(...reported.map(reportedSignal));

  const ctx = buildContext(data, window);
  const obsList = [...ctx.obsByDate.values()];
  const recorded = obsList.filter((o) => o.attentionDifficulty !== null);
  const yes = recorded.filter((o) => o.attentionDifficulty === true);
  const dailyShare = recorded.length ? yes.length / recorded.length : 0;
  const dailySignal = recorded.length >= MIN_DAILY_SIGNAL_DAYS && dailyShare >= DAILY_SIGNAL_SHARE;
  if (dailySignal) {
    c.signals.push({
      kind: 'daily-observation',
      label: 'Attention / concentration difficulty in daily check-ins',
      detail: `Reported on ${yes.length} of ${recorded.length} days with this field recorded (${pct(dailyShare)}); ${ctx.calendarDays - recorded.length} days not recorded.`,
      sourceId: null,
    });
  }

  // Computed confounders: overlap with short sleep, side effects, seizures.
  const shortSleep = recorded.filter((o) => o.sleepHours !== null && o.sleepHours < 6);
  const otherSleep = recorded.filter((o) => o.sleepHours !== null && o.sleepHours >= 6);
  if (shortSleep.length && otherSleep.length) {
    c.confounders.push(
      `Attention difficulty was reported on ${shortSleep.filter((o) => o.attentionDifficulty).length} of ${shortSleep.length} short-sleep days (< 6 h) vs ${otherSleep.filter((o) => o.attentionDifficulty).length} of ${otherSleep.length} other days – sleep loss may contribute.`,
    );
  }
  const sideEffects = sortByDateId(data.medicationEvents).filter((e) => e.kind === 'side-effect');
  if (sideEffects.length) c.confounders.push(`${plural(sideEffects.length, 'medication side-effect report')} recorded (e.g. "${sideEffects[0].description}").`);
  c.confounders.push('Seizures, post-ictal effects, mood symptoms and antiseizure medications can all affect attention.');
  const sleepFinding = findings.find((f) => f.id === 'pattern-sleep');
  if (sleepFinding?.status === 'possible-pattern') c.confounders.push('A possible sleep-related seizure pattern was also calculated for this period.');

  if (!reported.length && !dailySignal) {
    c.rationale =
      'A confirmed epilepsy diagnosis alone does not surface this connection. No patient-reported attention symptoms or sustained attention difficulties in daily check-ins were found.';
    return c;
  }
  c.surfaced = true;
  c.rationale = `Surfaced because attention-related information is recorded (${plural(c.signals.length - 1, 'patient-specific signal')}) alongside a confirmed epilepsy diagnosis.`;
  c.hypothesis =
    'Recorded attention and concentration difficulties may warrant clinician review. Population studies report that ADHD symptoms are more common in people with epilepsy than in the general population; whether this applies here can only be judged clinically.';
  return c;
}

function sleepDisorderRule(data: HealthData, window: DateWindow, findings: PatternFinding[]): ConnectionResult {
  const c = base('conn-sleep-disorder', 'Sleep symptoms and epilepsy – possible sleep-disorder evaluation', 'potential-comorbidity');
  c.evidenceIds = ['malow-2000-osa', 'ferlisi-2014-precipitants'];
  c.discussionPoint =
    'Ask about snoring, witnessed pauses in breathing and daytime sleepiness, and whether sleep medicine evaluation (including any pending referral) is appropriate.';
  c.limitations = [
    'Snoring and sleepiness are non-specific; only a formal sleep evaluation can identify a sleep disorder.',
    'The cited OSA study was small and in drug-resistant epilepsy; applicability may be limited.',
    'This is a hypothesis for clinician review, not a diagnosis.',
  ];
  const epi = epilepsyDiagnosis(data);
  if (!epi) {
    c.rationale = 'No confirmed epilepsy diagnosis is documented, so this epilepsy-specific connection is not evaluated.';
    return c;
  }
  c.signals.push(diagnosisSignal(epi));
  const existing = withTags(data, ['sleep-apnea', 'osa'], ['confirmed']);
  if (existing.length) {
    c.rationale = `A sleep disorder is already documented (${existing[0].label}); no new evaluation suggestion is generated.`;
    return c;
  }

  const reported = withTags(data, ['snoring', 'witnessed-apnea', 'daytime-sleepiness', 'insomnia', 'morning-headache']);
  c.signals.push(...reported.map(reportedSignal));

  const ctx = buildContext(data, window);
  const rated = [...ctx.obsByDate.values()].filter((o) => o.sleepQuality !== null);
  const poor = rated.filter((o) => (o.sleepQuality as number) <= 2);
  const poorShare = rated.length ? poor.length / rated.length : 0;
  const poorSignal = rated.length >= MIN_DAILY_SIGNAL_DAYS && poorShare >= DAILY_SIGNAL_SHARE;
  if (poorSignal) {
    c.signals.push({
      kind: 'daily-observation',
      label: 'Poor sleep quality in daily check-ins',
      detail: `Sleep quality rated 1–2 of 5 on ${poor.length} of ${rated.length} recorded nights (${pct(poorShare)}).`,
      sourceId: null,
    });
  }
  const sleepFinding = findings.find((f) => f.id === 'pattern-sleep');
  if (sleepFinding?.status === 'possible-pattern') {
    c.signals.push({ kind: 'calculated-pattern', label: 'Possible sleep-duration pattern', detail: sleepFinding.explanation, sourceId: sleepFinding.id });
  }
  const nocturnal = ctx.seizuresInWindow.filter((s) => isNocturnal(s.time));
  if (nocturnal.length) {
    c.signals.push({
      kind: 'daily-observation',
      label: 'Seizures beginning during usual sleep hours',
      detail: `${plural(nocturnal.length, 'seizure')} began between 00:00 and 05:59 (${nocturnal.map((s) => s.date).join(', ')}).`,
      sourceId: null,
    });
  }
  const referral = withTags(data, ['sleep-referral']);
  if (referral.length) c.signals.push({ kind: 'history-context', label: referral[0].label, detail: `Referral status: ${referral[0].status}.`, sourceId: referral[0].id });

  c.confounders = [
    'Short sleep may reflect schedule, stress or nocturnal seizures rather than a sleep disorder.',
    'Sedating medications and supplements (e.g. recently started melatonin, if recorded) can affect sleep and sleepiness.',
  ];

  if (!reported.length && !poorSignal) {
    c.rationale =
      'A confirmed epilepsy diagnosis alone does not surface this connection. No patient-reported sleep-disorder symptoms or sustained poor sleep quality were found.';
    return c;
  }
  c.surfaced = true;
  c.rationale = 'Surfaced because sleep-related symptoms or sustained poor sleep quality are recorded alongside a confirmed epilepsy diagnosis.';
  c.hypothesis =
    'Recorded snoring, sleepiness or poor sleep may warrant clinician review for a possible sleep disorder. Obstructive sleep apnoea has been reported to be common and often unrecognised in some epilepsy populations.';
  c.discussionPoint += referral.length ? ' A sleep medicine referral is recorded as pending.' : '';
  return c;
}

function catamenialRule(findings: PatternFinding[]): ConnectionResult {
  const c = base('conn-catamenial', 'Seizure timing and the menstrual cycle – pattern review', 'pattern-review');
  c.evidenceIds = ['herzog-1997-catamenial', 'nakken-2005-precipitants'];
  c.discussionPoint = 'Review the cycle-phase calculation, whether further charting over more cycles is helpful, and whether cycle timing is relevant to management.';
  c.limitations = [
    'Phases are calendar estimates; ovulation is not confirmed.',
    'Few cycles are observed. Published definitions rely on charting and, in some cases, hormone measurement.',
    'A calculated pattern is not a diagnosis.',
  ];
  c.confounders = ['Sleep, stress and missed doses may cluster around particular cycle phases.'];
  const f = findings.find((x) => x.id === 'pattern-menstrual');
  if (!f || f.status !== 'possible-pattern') {
    c.rationale = f
      ? `Not surfaced: the menstrual-cycle analysis status is “${f.status.replace('-', ' ')}”${f.suppressionReason ? ` (${f.suppressionReason})` : ''}.`
      : 'Not surfaced: no menstrual-cycle analysis available.';
    return c;
  }
  c.signals.push({ kind: 'calculated-pattern', label: f.title, detail: f.explanation, sourceId: f.id });
  for (const o of f.confounderOverlap) if (o.count > 0) c.confounders.push(`${o.factor}: ${o.count} of ${o.of} seizure days in that phase.`);
  c.surfaced = true;
  c.rationale = 'Surfaced because the personal pattern engine calculated a phase-related increase across at least two cycles.';
  c.hypothesis =
    'The calculated phase-related increase resembles catamenial seizure patterns described in the literature and may be worth reviewing with the treating clinician.';
  return c;
}

function seizureChangeRule(data: HealthData, window: DateWindow, findings: PatternFinding[]): ConnectionResult {
  const c = base('conn-seizure-change', 'Change in seizure pattern – clinician review and safety protocol', 'safety-review');
  c.evidenceIds = ['cdc-seizure-first-aid', 'trinka-2015-status-epilepticus'];
  c.limitations = [
    'Seizure types and durations are patient- or witness-reported.',
    'HealthConnect does not predict any disease from seizure patterns; changes are routed to clinician review.',
    'The safety protocol in this prototype has not been clinically validated.',
  ];
  const ctx = buildContext(data, window);
  const prolonged = ctx.seizuresInWindow.filter((s) => (s.durationSeconds ?? 0) >= PROLONGED_SECONDS);
  const typeF = findings.find((f) => f.id === 'pattern-trend-type');
  const freqF = findings.find((f) => f.id === 'pattern-trend-frequency');

  for (const s of prolonged)
    c.signals.push({ kind: 'daily-observation', label: `Seizure on ${s.date} lasted ${duration(s.durationSeconds)}`, detail: `${SEIZURE_TYPE_LABELS[s.type]}; at or above the 5-minute emergency threshold.`, sourceId: s.id });
  if (typeF?.status === 'notable-change') c.signals.push({ kind: 'calculated-pattern', label: typeF.title, detail: typeF.details.join(' '), sourceId: typeF.id });
  if (freqF?.status === 'possible-pattern' && (freqF.stats?.rateRatio ?? 0) > 1)
    c.signals.push({ kind: 'calculated-pattern', label: freqF.title, detail: freqF.explanation, sourceId: freqF.id });
  const missedRecent = sortByDateId(data.medicationEvents).filter((e) => e.kind === 'missed-dose' && e.date >= window.start && e.date <= window.end);
  if (missedRecent.length) c.confounders.push(`${plural(missedRecent.length, 'missed dose')} logged in the period (${missedRecent.map((e) => e.date).join(', ')}).`);
  c.confounders.push('Sleep loss, illness and medication changes can coincide with changes in seizures.');

  if (!c.signals.length) {
    c.rationale = 'Not surfaced: no new seizure type, frequency increase or seizure lasting ≥ 5 minutes was found in the selected period.';
    return c;
  }
  c.surfaced = true;
  c.urgency = prolonged.length ? 'emergency-guidance' : 'prompt';
  c.rationale = 'Surfaced because the records show a change in seizure type or frequency, or a prolonged seizure.';
  c.hypothesis =
    'A change in seizure pattern may warrant prompt review with the treating clinician to update the seizure action plan. It is not used to predict any other condition.';
  c.discussionPoint =
    'Review the new or changed events with the treating clinician and confirm the seizure action plan, including rescue medication instructions and when to call emergency services.';
  return c;
}

/** Evaluate all rules; any surfaced connection failing safety validation is suppressed. */
export function evaluateConnections(data: HealthData, findings: PatternFinding[], window: DateWindow): ConnectionResult[] {
  const results = [adhdRule(data, window, findings), sleepDisorderRule(data, window, findings), catamenialRule(findings), seizureChangeRule(data, window, findings)];
  return results.map((r) => {
    const errors = validateConnection(r);
    if (!errors.length) return r;
    return { ...r, surfaced: false, hypothesis: null, rationale: `Suppressed by safety validation (${errors.join('; ')}).` };
  });
}

export const SIGNAL_KIND_LABELS: Record<PatientSignal['kind'], string> = {
  'confirmed-diagnosis': 'Confirmed diagnosis',
  'patient-reported-symptom': 'Patient-reported symptom',
  'calculated-pattern': 'Patient-specific calculated pattern',
  'daily-observation': 'Recorded observation',
  'medication-context': 'Medication context',
  'history-context': 'History / referral',
};
