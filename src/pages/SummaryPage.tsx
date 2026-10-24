import { useMemo, useState } from 'react';
import { Check, Copy, Download, Info } from 'lucide-react';
import { Badge, Button, Card, Notice, PageHeader } from '../components/ui';
import { summaryToMarkdown, type SummaryLabel } from '../summary/clinicianSummary';
import { formatWindow } from '../analysis/dates';
import { PdfButton, PrintButton, useReport } from '../report/ReportActions';
import { SleepChart } from '../components/charts/SleepChart';

export const LABEL_TONE: Record<SummaryLabel, 'teal' | 'sky' | 'emerald' | 'violet' | 'amber' | 'slate' | 'rose'> = {
  'Established diagnosis': 'teal',
  'Patient-reported': 'sky',
  'Recorded observation': 'emerald',
  'Calculated pattern': 'violet',
  'Potential hypothesis': 'amber',
  'Review flag': 'rose',
  Evidence: 'slate',
  Limitation: 'slate',
  Question: 'teal',
  Task: 'sky',
  Context: 'slate',
};

export function SummaryPage() {
  const { report, chart } = useReport();
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
    a.download = `connecthealth-summary-${report.window.start}_to_${report.window.end}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Clinician Summary"
        description="Generated from your current records, calculations and review flags. Edit records or change the period and the report updates automatically."
        actions={
          <>
            <PdfButton />
            <PrintButton />
            <Button onClick={copy} aria-live="polite">
              {copied === 'ok' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed – use Download' : 'Copy as text'}
            </Button>
            <Button onClick={download}>
              <Download size={16} aria-hidden="true" /> .md
            </Button>
          </>
        }
      />
      <div className="no-print mb-4">
        <Notice tone="slate" icon={<Info size={16} />}>
          Downloading or printing only creates a file on this device. Nothing is sent to a clinician, insurer or anyone else – you decide who to share it with.
        </Notice>
      </div>
      <Card className="print-area">
        <header className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold text-slate-900">{report.title}</h2>
          <p className="text-sm text-slate-600">
            {report.patient} · {formatWindow(report.window)} · generated {new Date(report.generatedAt).toLocaleString()}
          </p>
          <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">{report.disclaimer}</p>
        </header>
        {report.sections.map((s) => (
          <section key={s.id} className="break-inside-avoid-page border-b border-slate-100 py-4 last:border-0">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-800 uppercase break-after-avoid">{s.heading}</h3>
            {s.id === 'review' && chart && chart.flags.length > 0 && (
              <div className="mb-3 break-inside-avoid">
                <SleepChart points={chart.points} threshold={chart.threshold} flags={chart.flags} height={200} eventLabel={chart.eventLabel} />
              </div>
            )}
            <ul className="space-y-1.5">
              {s.items.map((i, idx) => (
                <li key={idx} className="flex break-inside-avoid flex-col gap-1 text-sm sm:flex-row sm:gap-3">
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
