import { useMemo, useState } from 'react';
import { Download, FileDown, Loader2, Printer } from 'lucide-react';
import { Button } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { buildClinicianSummary, type SummaryReport } from '../summary/clinicianSummary';
import { buildDailySeries } from '../analysis/series';
import { getOutcome } from '../analysis/outcomes';
import { createReportPdf, reportFileName, type PdfChart, type ReportVariant } from './pdf';

/** Current report + chart model, built from the active profile's live data. */
export function useReport(): { report: SummaryReport; chart: PdfChart | null } {
  const { state } = useHealthData();
  const a = useAnalysis();
  return useMemo(() => {
    const report = buildClinicianSummary(state.data, a.findings, a.connections, a.window, state.settings, { flags: a.flags, insufficient: a.insufficient });
    const outcome = a.outcome ?? 'seizures';
    const included = a.flags.filter((f) => !state.data.reviewExcluded.includes(f.id));
    const points = buildDailySeries(state.data, a.window, outcome);
    const chart: PdfChart | null = points.some((p) => p.sleepHours !== null || p.seizures.length)
      ? { title: `Sleep and ${getOutcome(outcome).label.toLowerCase()} with clinician-review markers`, points, threshold: state.settings.sleepThresholdHours, flags: included, eventLabel: getOutcome(outcome).label.replace(/s$/, '') }
      : null;
    return { report, chart };
  }, [state, a]);
}

export function PdfButton({ variant = 'full', label }: { variant?: ReportVariant; label?: string }) {
  const { report, chart } = useReport();
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const download = async () => {
    setStatus('working');
    try {
      const doc = await createReportPdf(report, chart, variant);
      doc.save(reportFileName(report, variant));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };
  return (
    <span className="inline-flex flex-col items-start">
      <Button variant="primary" onClick={download} disabled={status === 'working'} aria-live="polite">
        {status === 'working' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileDown size={16} aria-hidden="true" />}
        {status === 'working' ? 'Generating PDF…' : (label ?? 'Download PDF')}
      </Button>
      {status === 'error' && (
        <span role="alert" className="mt-1 text-xs text-rose-700">
          PDF generation failed – use Print / Save as PDF instead.
        </span>
      )}
    </span>
  );
}

export function PrintButton() {
  return (
    <Button onClick={() => globalThis.print()}>
      <Printer size={16} aria-hidden="true" /> Print / Save as PDF
    </Button>
  );
}

export { Download };
