/**
 * Clinician summary generator. Built only from stored records and calculated results; every item is labelled with
 * its information type so observations, calculated patterns, hypotheses and established diagnoses stay distinct.
 */
import type { ConnectionResult, DateWindow, PatternFinding } from '../models/analysis';
import type { AnalysisSettings, HealthData } from '../models/types';
import { SEIZURE_TYPE_LABELS } from '../models/types';
import { computeCompleteness, summarizeSeizures, summarizeSleep } from '../analysis/completeness';
import { projectedNextStart, summarizeCycles } from '../analysis/cycle';
import { formatWindow, inWindow } from '../analysis/dates';
import { sortByDateId } from '../analysis/context';
import { currentMedications, doseOn, pastMedications } from '../analysis/medicationInfo';
import { duration, pct, plural } from '../analysis/format';
import { evidenceById, formatCitation } from '../clinical/knowledgeBase';

export type SummaryLabel =
  | 'Established diagnosis'
  | 'Patient-reported'
  | 'Recorded observation'
  | 'Calculated pattern'
  | 'Potential hypothesis'
  | 'Evidence'
  | 'Limitation'
  | 'Question'
  | 'Task'
  | 'Context';

export interface SummaryItem {
  label: SummaryLabel;
  text: string;
}

export interface SummarySection {
  id: string;
  heading: string;
  items: SummaryItem[];
}

export interface SummaryReport {
  title: string;
  patient: string;
  window: DateWindow;
  disclaimer: string;
  sections: SummarySection[];
}

export const SUMMARY_DISCLAIMER =
  'SYNTHETIC DEMONSTRATION DATA. Patient-generated diary data and exploratory calculations for clinician review. Patterns are observational associations, not diagnoses or evidence of cause and effect. Hypotheses are prompts for discussion. HealthConnect makes no treatment recommendations.';

export function buildClinicianSummary(
  data: HealthData,
  findings: PatternFinding[],
  connections: ConnectionResult[],
  window: DateWindow,
  settings: AnalysisSettings,
): SummaryReport {
  const sz = summarizeSeizures(data, window);
  const comp = computeCompleteness(data, window);
  const sleep = summarizeSleep(data, window, settings.sleepThresholdHours);
  const cycles = summarizeCycles(data.menstrual);
  const sections: SummarySection[] = [];
  const hist = [...data.history].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 1. History
  const history: SummaryItem[] = [
    { label: 'Context', text: `${data.profile.displayName}, ${data.profile.age} y, ${data.profile.sex}. Condition focus: ${data.profile.conditionFocus}.` },
  ];
  for (const h of hist.filter((x) => x.kind === 'diagnosis' && x.status === 'confirmed'))
    history.push({ label: 'Established diagnosis', text: `${h.label}${h.date ? ` (since ${h.date})` : ''} – ${h.source.replace('-', ' ')}.` });
  for (const h of hist.filter((x) => x.kind === 'history' || x.kind === 'referral'))
    history.push({ label: h.source === 'patient-reported' ? 'Patient-reported' : 'Context', text: `${h.label} (${h.status}).` });
  sections.push({ id: 'history', heading: 'Relevant patient history', items: history });

  // 2. Seizures
  const seizures: SummaryItem[] = [
    {
      label: 'Recorded observation',
      text: `${plural(sz.totalEvents, 'seizure event')} on ${plural(sz.seizureDays, 'day')} (${formatWindow(window)}); ${sz.eventsPer30ObservedDays === null ? 'no observed days' : `${sz.eventsPer30ObservedDays.toFixed(1)} events per 30 observed days`} (rate uses the ${plural(sz.eventsOnObservedDays, 'event')} on ${plural(sz.observedDays, 'observed day')}).`,
    },
  ];
  if (sz.byType.length)
    seizures.push({ label: 'Recorded observation', text: `By type: ${sz.byType.map((t) => `${SEIZURE_TYPE_LABELS[t.type]} ${t.count}`).join('; ')}.` });
  if (sz.mostRecentOverall)
    seizures.push({
      label: 'Recorded observation',
      text: `Most recent: ${sz.mostRecentOverall.date}${sz.mostRecentOverall.time ? ` ${sz.mostRecentOverall.time}` : ''}, ${SEIZURE_TYPE_LABELS[sz.mostRecentOverall.type].toLowerCase()}, ${duration(sz.mostRecentOverall.durationSeconds)}.`,
    });
  if (sz.eventsOnDaysWithoutCheckIn)
    seizures.push({ label: 'Limitation', text: sz.eventsOnDaysWithoutCheckIn === 1 ? '1 event fell on a day without a check-in and is excluded from rate comparisons.' : `${sz.eventsOnDaysWithoutCheckIn} events fell on days without a check-in and are excluded from rate comparisons.` });
  for (const f of findings.filter((x) => x.factor === 'trend'))
    seizures.push({ label: f.status === 'insufficient-data' ? 'Limitation' : 'Calculated pattern', text: `${f.title}. ${f.explanation}` });
  sections.push({ id: 'seizures', heading: 'Seizure frequency and change over time', items: seizures });

  // 3. Context
  const context: SummaryItem[] = [];
  context.push({
    label: 'Recorded observation',
    text: sleep.meanHours === null
      ? 'Sleep: no nights recorded in this period.'
      : `Sleep: mean ${sleep.meanHours.toFixed(1)} h over ${sleep.recordedNights} recorded nights; ${sleep.nightsBelow} nights < ${sleep.threshold} h; ${comp.calendarDays - sleep.recordedNights} nights not recorded.`,
  });
  if (data.menstrual.length) {
    const next = projectedNextStart(data.menstrual);
    context.push({
      label: 'Recorded observation',
      text: `Menstrual cycle: ${plural(cycles.starts.length, 'recorded period start')}; ${cycles.boundedPlausible} complete cycles${cycles.averageLength ? `, average ${cycles.averageLength} days` : ''}${next ? `; next start projected around ${next} (estimate)` : ''}.`,
    });
  }
  for (const m of currentMedications(data, window.end))
    context.push({ label: 'Recorded observation', text: `Current: ${m.name} ${doseOn(m, data.medicationEvents, window.end)} ${m.frequency} (${m.indication}; ${m.source.replace('-', ' ')}).` });
  for (const m of pastMedications(data, window.end))
    context.push({ label: 'Context', text: `Previous: ${m.name} ${m.startDate} – ${m.endDate ?? 'unknown'}${m.notes ? ` (${m.notes.replace(/\.$/, '')})` : ''}.` });
  for (const e of sortByDateId(data.medicationEvents).filter((x) => inWindow(x.date, window))) {
    const med = data.medications.find((m) => m.id === e.medicationId)?.name ?? 'Unknown medication';
    const what = e.kind === 'dose-change' ? `dose change${e.newDose ? ` to ${e.newDose}` : ''}` : e.kind.replace('-', ' ');
    context.push({ label: e.source === 'patient-reported' ? 'Patient-reported' : 'Recorded observation', text: `${e.date} – ${med}: ${what}. ${e.description}` });
  }
  sections.push({ id: 'context', heading: 'Sleep, menstrual-cycle and medication context', items: context });

  // 4. Patterns
  const supported = findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change');
  const patterns: SummaryItem[] = supported.map((f) => ({ label: 'Calculated pattern', text: `${f.title}. ${f.explanation}` }));
  const unclear = findings.filter((f) => f.status === 'no-clear-pattern');
  if (unclear.length) patterns.push({ label: 'Calculated pattern', text: `Analyses without a clear pattern: ${unclear.map((f) => f.title).join('; ')}.` });
  if (!patterns.length) patterns.push({ label: 'Limitation', text: 'No supported personal patterns in this period.' });
  sections.push({ id: 'patterns', heading: 'Supported personal patterns', items: patterns });

  // 5. Connections
  const surfaced = connections.filter((c) => c.surfaced);
  const conn: SummaryItem[] = [];
  for (const c of surfaced) {
    conn.push({ label: 'Potential hypothesis', text: `${c.title}. ${c.hypothesis}` });
    for (const id of c.evidenceIds.slice(0, 2)) {
      const e = evidenceById(id);
      if (e) conn.push({ label: 'Evidence', text: `${e.relationship}: ${formatCitation(e)} ${e.url}` });
    }
  }
  if (!conn.length) conn.push({ label: 'Limitation', text: 'No evidence-informed connections were surfaced for this period.' });
  sections.push({ id: 'connections', heading: 'Potential comorbidities and connections for clinician review', items: conn });

  // 6. Patient-reported concerns
  const concerns: SummaryItem[] = hist
    .filter((h) => h.kind === 'symptom' && h.source === 'patient-reported' && h.status !== 'resolved' && h.status !== 'ruled-out')
    .map((h) => ({ label: 'Patient-reported' as const, text: `${h.label}${h.date ? ` (reported ${h.date})` : ''}.` }));
  for (const e of sortByDateId(data.medicationEvents).filter((x) => x.kind === 'side-effect' && inWindow(x.date, window)))
    concerns.push({ label: 'Patient-reported', text: `Side effect ${e.date}: ${e.description}` });
  if (!concerns.length) concerns.push({ label: 'Limitation', text: 'No patient-reported concerns recorded.' });
  sections.push({ id: 'concerns', heading: 'Patient-reported concerns', items: concerns });

  // 7. Missing data
  const missing: SummaryItem[] = [
    { label: 'Limitation', text: `Check-ins on ${comp.checkInDays} of ${comp.calendarDays} days (${pct(comp.checkInDays / Math.max(1, comp.calendarDays), 0)}); ${comp.missingDays.length} days without a check-in; ${comp.partialCheckIns} partial check-ins.` },
    { label: 'Limitation', text: `Field completeness: ${comp.fields.map((f) => `${f.label} ${f.recordedDays}/${f.calendarDays}`).join('; ')}.` },
    { label: 'Limitation', text: 'Missing days are excluded from denominators; they are not treated as seizure-free or symptom-free.' },
  ];
  for (const f of findings.filter((x) => x.status === 'insufficient-data'))
    missing.push({ label: 'Limitation', text: `${f.title}: ${f.suppressionReason}` });
  missing.push({ label: 'Limitation', text: 'All analyses are exploratory and observational; several comparisons are made without multiple-comparison adjustment.' });
  sections.push({ id: 'missing', heading: 'Missing data and limitations', items: missing });

  // 8. Questions
  const questions = [...supported.map((f) => f.discussionPoint), ...surfaced.map((c) => c.discussionPoint)];
  const uniqueQ = [...new Set(questions)];
  sections.push({
    id: 'questions',
    heading: 'Suggested appointment questions',
    items: uniqueQ.length ? uniqueQ.map((q) => ({ label: 'Question' as const, text: q })) : [{ label: 'Question', text: 'Review the seizure diary and any changes since the last visit.' }],
  });

  // 9. Tasks
  const open = data.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id));
  sections.push({
    id: 'tasks',
    heading: 'Outstanding follow-up tasks',
    items: open.length
      ? open.map((t) => ({ label: 'Task' as const, text: `${t.title} [${t.status}]${t.dueDate ? ` – due ${t.dueDate}` : ''}${t.appointmentDate ? ` – appointment ${t.appointmentDate}` : ''}. ${t.reason}` }))
      : [{ label: 'Task', text: 'No outstanding tasks.' }],
  });

  return {
    title: 'HealthConnect clinician summary',
    patient: data.profile.displayName,
    window,
    disclaimer: SUMMARY_DISCLAIMER,
    sections,
  };
}

export function summaryToMarkdown(r: SummaryReport): string {
  const lines = [`# ${r.title}`, '', `**Patient:** ${r.patient}  `, `**Period:** ${formatWindow(r.window)}`, '', `> ${r.disclaimer}`, ''];
  for (const s of r.sections) {
    lines.push(`## ${s.heading}`, '');
    for (const i of s.items) lines.push(`- **[${i.label}]** ${i.text}`);
    lines.push('');
  }
  return lines.join('\n');
}
