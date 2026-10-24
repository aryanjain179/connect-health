import { useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Compass, Flag, HelpCircle, Info } from 'lucide-react';
import { Badge, Button, Card, CardTitle, EmptyState, Notice, PageHeader } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import { SleepChart } from '../components/charts/SleepChart';
import { CycleStrip } from '../components/charts/CycleStrip';
import { FlagBadge, FlagDetails, FlagDialog, taskDefaultsFromFlag } from '../components/review/FlagDialog';
import { buildDailySeries } from '../analysis/series';
import { getOutcome } from '../analysis/outcomes';
import { formatWindow } from '../analysis/dates';
import { PdfButton, PrintButton } from '../report/ReportActions';
import type { ReviewFlag } from '../review/flags';

export function ReviewPage({ focusId }: { focusId?: string | null }) {
  const { state } = useHealthData();
  const { flags, insufficient, window } = useAnalysis();
  const { openEditor } = useEditor();
  const [dialog, setDialog] = useState<ReviewFlag | null>(null);
  const red = flags.filter((f) => f.level === 'red');
  const amber = flags.filter((f) => f.level === 'amber');
  const questions = [...new Set(flags.flatMap((f) => f.questions))];
  const seriesByOutcome = useMemo(() => {
    const out = new Map<string, ReturnType<typeof buildDailySeries>>();
    for (const f of flags) if (!out.has(f.outcome)) out.set(f.outcome, buildDailySeries(state.data, window, f.outcome));
    return out;
  }, [flags, state.data, window]);

  useEffect(() => {
    if (focusId) document.getElementById(`flag-${focusId}`)?.scrollIntoView?.({ block: 'start' });
  }, [focusId]);

  return (
    <>
      <PageHeader
        title="Clinician Review"
        description={<>Findings from your recorded data that may merit professional attention, {formatWindow(window)}. This is a decision-support summary, not a diagnosis or validated clinical assessment.</>}
        actions={
          <>
            <PdfButton variant="review" label="Download review PDF" />
            <PrintButton />
          </>
        }
      />
      <Notice tone="sky" icon={<Info size={16} />}>
        <p>
          <strong>How flags work.</strong> <span className="font-semibold text-rose-800">Red</span> is used only for rules based on documented clinical guidance (currently: a recorded seizure lasting 5 minutes or longer). <span className="font-semibold text-amber-800">Amber</span> marks a pattern found by ConnectHealth’s prototype analytic rules – worth routine discussion, not urgent, and not a validated clinical rule. Flags never identify a disease.
        </p>
      </Notice>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Red</p>
          <p className="text-2xl font-semibold text-rose-700">{red.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Amber</p>
          <p className="text-2xl font-semibold text-amber-700">{amber.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Insufficient data</p>
          <p className="text-2xl font-semibold text-slate-700">{insufficient.length}</p>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        {flags.map((f) => {
          const points = seriesByOutcome.get(f.outcome) ?? [];
          return (
            <Card key={f.id} as="article" aria-labelledby={`t-${f.id}`} className={f.level === 'red' ? 'border-rose-200' : 'border-amber-200'}>
              <div id={`flag-${f.id}`} className="scroll-mt-24" />
              <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <FlagBadge flag={f} />
                    <Badge>{getOutcome(f.outcome).label}</Badge>
                    {state.data.reviewExcluded.includes(f.id) && <Badge>Left out of report</Badge>}
                  </div>
                  <h2 id={`t-${f.id}`} className="text-base font-semibold text-slate-900">
                    {f.title}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openEditor({ kind: 'task', defaults: taskDefaultsFromFlag(f), insightTitle: f.title })}>
                    <ClipboardPlus size={14} aria-hidden="true" /> Create task
                  </Button>
                  <a href="#/navigator" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
                    <Compass size={14} aria-hidden="true" /> Next steps
                  </a>
                </div>
              </header>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <SleepChart points={points} threshold={state.settings.sleepThresholdHours} flags={[f]} focusFlag={f} onFlagClick={(x) => setDialog(x)} height={220} eventLabel={`${getOutcome(f.outcome).label.replace(/s$/, '')}`} />
                  {f.id.includes('menstrual') && (
                    <div className="mt-4">
                      <CycleStrip points={points} eventLabel={getOutcome(f.outcome).label.replace(/s$/, '').replace(/ days?$/, '')} />
                    </div>
                  )}
                </div>
                <FlagDetails flag={f} />
              </div>
              <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-sm text-teal-900">
                <p className="flex items-center gap-1 font-semibold">
                  <HelpCircle size={14} aria-hidden="true" /> Questions you may wish to raise
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {f.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
        {!flags.length && <EmptyState>No findings are marked for clinician review in this period. That does not mean nothing is wrong – it means these records do not meet the flag rules.</EmptyState>}
      </div>

      <Card className="mt-8">
        <CardTitle sub="Shown instead of a flag when the data cannot support an assessment">Insufficient data to assess this pattern</CardTitle>
        <ul className="divide-y divide-slate-100 text-sm">
          {insufficient.map((i) => (
            <li key={i.findingId} className="py-2">
              <p className="font-medium text-slate-800">{i.title}</p>
              <p className="text-slate-600">{i.reason}</p>
            </li>
          ))}
          {!insufficient.length && <li className="py-2 text-slate-500">Every analysis had enough data in this period.</li>}
        </ul>
      </Card>

      {questions.length > 0 && (
        <Card className="mt-6">
          <CardTitle icon={<Flag size={18} />}>All questions for your appointment</CardTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </Card>
      )}
      <FlagDialog flag={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
