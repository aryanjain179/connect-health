import { useMemo, useState } from 'react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { buildClinicianSummary, summaryToMarkdown, type SummaryLabel } from '../summary/clinicianSummary';
import { formatWindow } from '../analysis/dates';

const LABEL_TONE: Record<SummaryLabel, 'teal' | 'sky' | 'emerald' | 'violet' | 'amber' | 'slate' | 'rose'> = {
  'Established diagnosis': 'teal',
  'Patient-reported': 'sky',
  'Recorded observation': 'emerald',
  'Calculated pattern': 'violet',
  'Potential hypothesis': 'amber',
  Evidence: 'slate',
  Limitation: 'slate',
  Question: 'teal',
  Task: 'sky',
  Context: 'slate',
};

export function SummaryPage() {
  const { state } = useHealthData();
  const { findings, connections, window } = useAnalysis();
  const report = useMemo(() => buildClinicianSummary(state.data, findings, connections, window, state.settings), [state.data, findings, connections, window, state.settings]);
  const markdown = useMemo(() => summaryToMarkdown(report), [report]);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 2500);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healthconnect-summary-${window.start}_to_${window.end}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Clinician Summary"
        description="Generated from the current records and calculations. Edit records or change the analysis period and the summary updates automatically."
        actions={
          <>
            <Button onClick={copy} aria-live="polite">
              {copied === 'ok' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed – use Download' : 'Copy as text'}
            </Button>
            <Button onClick={download}>
              <Download size={16} aria-hidden="true" /> Download .md
            </Button>
            <Button variant="primary" onClick={() => globalThis.print()}>
              <Printer size={16} aria-hidden="true" /> Print / PDF
            </Button>
          </>
        }
      />
      <Card className="print-area">
        <header className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold text-slate-900">{report.title}</h2>
          <p className="text-sm text-slate-600">
            {report.patient} · {formatWindow(report.window)}
          </p>
          <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">{report.disclaimer}</p>
        </header>
        {report.sections.map((s) => (
          <section key={s.id} className="border-b border-slate-100 py-4 last:border-0">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-800 uppercase">{s.heading}</h3>
            <ul className="space-y-1.5">
              {s.items.map((i, idx) => (
                <li key={idx} className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
                  <Badge tone={LABEL_TONE[i.label]} className="shrink-0 self-start">
                    {i.label}
                  </Badge>
                  <span className="text-slate-700">{i.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Card>
    </>
  );
}
