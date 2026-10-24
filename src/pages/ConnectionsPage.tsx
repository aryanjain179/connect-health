import { AlertTriangle, BookOpen, ClipboardPlus, ExternalLink, Info, MessageSquareText, Phone, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Notice, PageHeader } from '../components/ui';
import { useAnalysis } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import type { ConnectionResult, PatientSignal } from '../models/analysis';
import { KNOWLEDGE_BASE, formatCitation } from '../clinical/knowledgeBase';
import { SIGNAL_KIND_LABELS } from '../clinical/connections';
import { EvidenceLinks } from '../components/InsightCard';
import { formatWindow } from '../analysis/dates';

const SIGNAL_TONE: Record<PatientSignal['kind'], 'teal' | 'sky' | 'violet' | 'slate' | 'emerald'> = {
  'confirmed-diagnosis': 'teal',
  'patient-reported-symptom': 'sky',
  'calculated-pattern': 'violet',
  'daily-observation': 'emerald',
  'medication-context': 'slate',
  'history-context': 'slate',
};

const LEGEND: Array<{ label: string; tone: 'teal' | 'sky' | 'violet' | 'amber' | 'slate'; text: string }> = [
  { label: 'Confirmed diagnosis', tone: 'teal', text: 'Documented by a clinician in the record.' },
  { label: 'Patient-reported symptom', tone: 'sky', text: 'Reported by the patient; not clinically verified.' },
  { label: 'Population-level association', tone: 'slate', text: 'Published evidence about groups of people – not about this patient.' },
  { label: 'Patient-specific calculated pattern', tone: 'violet', text: 'Calculated by ConnectHealth from this patient’s records.' },
  { label: 'Potential clinical hypothesis', tone: 'amber', text: 'A question for the clinician to consider – not a diagnosis.' },
];

function ConnectionCard({ c, onTask }: { c: ConnectionResult; onTask: (c: ConnectionResult) => void }) {
  return (
    <Card as="article" className="flex flex-col gap-4" aria-labelledby={`${c.id}-t`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge tone={c.category === 'safety-review' ? 'rose' : 'amber'}>
              {c.category === 'potential-comorbidity' ? 'Potential comorbidity · for clinician review' : c.category === 'safety-review' ? 'Safety review' : 'Pattern review'}
            </Badge>
            {c.urgency !== 'routine' && <Badge tone="rose">{c.urgency === 'emergency-guidance' ? 'Emergency guidance applies' : 'Prompt review suggested'}</Badge>}
          </div>
          <h3 id={`${c.id}-t`} className="text-base font-semibold text-slate-900">
            {c.title}
          </h3>
        </div>
        <Button size="sm" onClick={() => onTask(c)}>
          <ClipboardPlus size={14} aria-hidden="true" /> Create follow-up task
        </Button>
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
        <p className="mb-1 text-xs font-semibold tracking-wide uppercase">Potential clinical hypothesis</p>
        {c.hypothesis}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold text-slate-700">Why this was surfaced – patient-specific signals</h4>
        <ul className="space-y-2">
          {c.signals.map((s, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2 text-sm sm:flex-row sm:items-start sm:gap-3">
              <Badge tone={SIGNAL_TONE[s.kind]} className="shrink-0 self-start">
                {SIGNAL_KIND_LABELS[s.kind]}
              </Badge>
              <span>
                <span className="font-medium text-slate-800">{s.label}</span>
                <span className="block text-xs text-slate-600">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">{c.rationale}</p>
      </div>

      <div>
        <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
          <BookOpen size={13} aria-hidden="true" /> Population-level associations (evidence)
        </h4>
        <EvidenceLinks ids={c.evidenceIds} />
      </div>

      <div className="grid gap-4 text-xs md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-semibold text-slate-700">Potential confounders</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
            {c.confounders.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-slate-700">Limitations</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
            {c.limitations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="flex gap-2 rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-sm text-teal-900">
        <MessageSquareText size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Suggested clinician discussion point: </span>
          {c.discussionPoint}
        </span>
      </p>
    </Card>
  );
}

export function ConnectionsPage() {
  const { connections, window } = useAnalysis();
  const { openEditor } = useEditor();
  const surfaced = connections.filter((c) => c.surfaced);
  const notSurfaced = connections.filter((c) => !c.surfaced);
  const safety = connections.find((c) => c.id === 'conn-seizure-change');
  const usedEvidence = new Set(surfaced.flatMap((c) => c.evidenceIds));

  const onTask = (c: ConnectionResult) =>
    openEditor({
      kind: 'task',
      insightTitle: c.title,
      defaults: {
        title: c.category === 'safety-review' ? 'Tell the care team about the change in seizures' : `Ask about further assessment: ${c.title.split(' – ')[0]}`,
        reason: c.hypothesis ?? c.rationale,
        kind: c.category === 'potential-comorbidity' ? 'ask-assessment' : 'discuss-pattern',
        insightId: c.id,
      },
    });

  return (
    <>
      <PageHeader
        title="Clinical Connections"
        description={<>Evidence-informed connections surfaced for clinician review only when this patient’s records give a specific reason ({formatWindow(window)}). Kept separate from the personal patterns.</>}
      />

      <Notice tone="sky" icon={<Info size={16} />}>
        ConnectHealth does not diagnose conditions, estimate individual disease probabilities, recommend medication changes or predict cancer or any other disease. Population evidence describes groups of people and is shown only as context for a clinician’s judgement.
      </Notice>

      <div className="mt-3">
        <Notice tone="slate">
          Coverage note: the curated knowledge base in this prototype currently covers epilepsy-related connections (ADHD symptoms, sleep disorders, menstrual-cycle timing and changing seizure patterns). For other conditions no connections are evaluated yet – this does not mean none exist.
        </Notice>
      </div>

      <Card className="mt-4">
        <CardTitle>How to read this page</CardTitle>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {LEGEND.map((l) => (
            <li key={l.label} className="text-xs text-slate-600">
              <Badge tone={l.tone}>{l.label}</Badge>
              <p className="mt-1">{l.text}</p>
            </li>
          ))}
        </ul>
      </Card>

      {safety?.surfaced && (
        <Card className="mt-6 border-rose-200 bg-rose-50/40">
          <CardTitle icon={<ShieldAlert size={18} />}>Safety protocol for new or changing seizures</CardTitle>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
            <li>
              <span className="font-semibold">Emergency:</span> a seizure lasting 5 minutes or longer, repeated seizures without recovery between them, breathing difficulty, injury, or seizure in water – follow the seizure action plan and call 911 (CDC first-aid guidance; ILAE status epilepticus time point t1 = 5 min for tonic-clonic seizures).
            </li>
            <li>
              <span className="font-semibold">Prompt clinician contact:</span> a new or different seizure type, or a clear increase in seizure frequency – tell the treating clinician soon so the seizure action plan can be reviewed.
            </li>
            <li>
              <span className="font-semibold">No disease prediction:</span> ConnectHealth does not infer other conditions from seizure changes. Evaluation decisions belong to the clinician.
            </li>
          </ol>
          <p className="mt-3 flex items-center gap-1 text-xs text-rose-800">
            <Phone size={12} aria-hidden="true" /> Prototype protocol – it has not been clinically validated and must be reviewed by qualified clinicians before real-world use.
          </p>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">Surfaced for clinician review ({surfaced.length})</h2>
      <div className="space-y-6">
        {surfaced.map((c) => (
          <ConnectionCard key={c.id} c={c} onTask={onTask} />
        ))}
        {!surfaced.length && <Notice tone="slate">No connections are surfaced for this period. See below for why each one was not surfaced.</Notice>}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">Evaluated but not surfaced ({notSurfaced.length})</h2>
      <ul className="space-y-2">
        {notSurfaced.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-800">{c.title}</p>
            <p className="text-slate-600">{c.rationale}</p>
          </li>
        ))}
        {!notSurfaced.length && <li className="text-sm text-slate-500">All rules surfaced a connection for this period.</li>}
      </ul>

      <Card className="mt-8">
        <CardTitle icon={<BookOpen size={18} />} sub="Curated entries with verified PubMed / CDC sources. Only these sources are ever cited.">
          Evidence library
        </CardTitle>
        <ul className="divide-y divide-slate-100">
          {KNOWLEDGE_BASE.map((e) => (
            <li key={e.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{e.relationship}</span>
                <Badge tone="slate">{e.evidenceType.replace(/-/g, ' ')}</Badge>
                {usedEvidence.has(e.id) ? <Badge tone="amber">Cited in a surfaced connection</Badge> : <Badge>Not currently cited</Badge>}
              </div>
              <p className="mt-1 text-slate-700">{e.keyFinding}</p>
              <p className="mt-1 text-xs text-slate-500">
                Population: {e.population} Limitations: {e.limitations.join(' ')}
              </p>
              <p className="mt-1 text-xs text-slate-500">Relevant signals: {e.relevantSignals.join(', ')}.</p>
              <a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-800 underline">
                {formatCitation(e)} <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <AlertTriangle size={12} aria-hidden="true" /> Citation metadata verified against PubMed / CDC on 2026-10-24. Key findings are paraphrased.
        </p>
      </Card>
    </>
  );
}
