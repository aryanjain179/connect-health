/**
 * Client-side PDF report (jsPDF, MIT licence – no paid service). Built from the same SummaryReport model as the
 * on-screen report, so it always reflects current data. Text is laid out (not a screenshot); blocks are kept together
 * across page breaks and the chart is drawn as vector graphics with its legend.
 */
import type { jsPDF as JsPDF } from 'jspdf';
import type { SummaryReport } from '../summary/clinicianSummary';
import type { ReviewFlag } from '../review/flags';
import type { DayPoint } from '../analysis/series';
import { formatWindow } from '../analysis/dates';

export interface PdfChart {
  title: string;
  points: DayPoint[];
  threshold: number;
  flags: ReviewFlag[];
  eventLabel: string;
}

export type ReportVariant = 'full' | 'review';

/** Helvetica in jsPDF only covers WinAnsi; map common Unicode punctuation to safe equivalents. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '|')
    .replace(/[→]/g, '->')
    .replace(/[↔]/g, '<->')
    .replace(/[×]/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

const REVIEW_SECTIONS = ['history', 'review', 'timeline', 'missing', 'questions', 'tasks'];

export function renderReport(doc: JsPDF, report: SummaryReport, chart: PdfChart | null, variant: ReportVariant = 'full'): JsPDF {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = W - 2 * M;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M - 20) {
      doc.addPage();
      y = M;
    }
  };
  const lines = (text: string, size: number, width = contentW) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(pdfSafe(text), width) as string[];
  };
  const write = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number]; x?: number; width?: number; gap?: number } = {}) => {
    const ls = lines(text, size, opts.width ?? contentW);
    const lh = size * 1.3;
    ensure(ls.length * lh);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.color ?? [30, 41, 59]));
    doc.text(ls, opts.x ?? M, y + size);
    y += ls.length * lh + (opts.gap ?? 4);
  };

  // Title block
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, W, 6, 'F');
  write(variant === 'review' ? 'ConnectHealth clinician review report' : report.title, 18, { bold: true, color: [15, 23, 42] });
  write(`Patient: ${report.patient}`, 10);
  write(`Observation period: ${formatWindow(report.window)}`, 10);
  write(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 10, { gap: 8 });
  const disc = lines(report.disclaimer, 9, contentW - 16);
  ensure(disc.length * 11.7 + 16);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.rect(M, y, contentW, disc.length * 11.7 + 12, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15);
  doc.text(disc, M + 8, y + 15);
  y += disc.length * 11.7 + 22;

  const sections = variant === 'review' ? report.sections.filter((s) => REVIEW_SECTIONS.includes(s.id)) : report.sections;
  const ordered = variant === 'review' ? [...sections].sort((a, b) => (a.id === 'review' ? -1 : b.id === 'review' ? 1 : 0)) : sections;

  for (const s of ordered) {
    // Keep a heading with its first item.
    const first = s.items[0];
    const firstH = first ? lines(first.text, 9.5, contentW - 110).length * 12.4 : 0;
    ensure(30 + firstH);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y, W - M, y);
    y += 6;
    write(s.heading.toUpperCase(), 10.5, { bold: true, color: [15, 118, 110], gap: 6 });

    if (s.id === 'review' && chart) drawChart(doc, chart, M, contentW, () => y, (v) => (y = v), ensure);

    for (const item of s.items) {
      const ls = lines(item.text, 9.5, contentW - 110);
      const h = ls.length * 12.4 + 4;
      ensure(h); // never split an item across pages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const isFlag = item.label === 'Review flag';
      doc.setTextColor(...((isFlag ? (item.text.startsWith('[RED]') ? [190, 18, 60] : [180, 83, 9]) : [71, 85, 105]) as [number, number, number]));
      doc.text(pdfSafe(item.label), M, y + 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(ls, M + 110, y + 9.5);
      y += h;
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafe(`ConnectHealth | decision-support summary, not a diagnosis | ${report.patient} | page ${i} of ${pages}`), M, H - 24);
  }
  return doc;
}

function drawChart(doc: JsPDF, c: PdfChart, x: number, w: number, getY: () => number, setY: (y: number) => void, ensure: (h: number) => void) {
  const h = 130;
  ensure(h + 70);
  let y = getY();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(pdfSafe(c.title), x, y + 10);
  y += 18;
  const left = x + 28;
  const plotW = w - 36;
  const top = y;
  const bottom = y + h;
  const n = Math.max(1, c.points.length - 1);
  const px = (i: number) => left + (i / n) * plotW;
  const py = (v: number) => bottom - (v / 12) * h;

  // Axes and grid
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  for (const v of [0, 3, 6, 9, 12]) {
    doc.line(left, py(v), left + plotW, py(v));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${v}h`, x, py(v) + 2);
  }
  // Highlight ranges of flags (e.g. before/after windows)
  const idx = new Map(c.points.map((p, i) => [p.date, i]));
  // Threshold
  doc.setDrawColor(217, 119, 6);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(left, py(c.threshold), left + plotW, py(c.threshold));
  doc.setLineDashPattern([], 0);
  // Sleep line (breaks at missing nights)
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(1);
  for (let i = 1; i < c.points.length; i++) {
    const a = c.points[i - 1].sleepHours;
    const b = c.points[i].sleepHours;
    if (a !== null && b !== null) doc.line(px(i - 1), py(a), px(i), py(b));
  }
  // Events (diamonds near top)
  doc.setFillColor(30, 41, 59);
  c.points.forEach((p, i) => {
    if (!p.seizures.length) return;
    const cx = px(i);
    const cy = top + 6;
    doc.triangle(cx - 2.5, cy, cx, cy - 3, cx + 2.5, cy, 'F');
    doc.triangle(cx - 2.5, cy, cx, cy + 3, cx + 2.5, cy, 'F');
  });
  // Review markers (triangles along the bottom)
  for (const f of c.flags) {
    if (f.level === 'red') doc.setFillColor(225, 29, 72);
    else doc.setFillColor(217, 119, 6);
    for (const d of f.involvedDates) {
      const i = idx.get(d);
      if (i === undefined) continue;
      const cx = px(i);
      doc.triangle(cx - 3, bottom - 1, cx + 3, bottom - 1, cx, bottom - 7, 'F');
    }
  }
  // X labels
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  if (c.points.length) {
    doc.text(c.points[0].date, left, bottom + 10);
    doc.text(c.points[c.points.length - 1].date, left + plotW - 40, bottom + 10);
  }
  // Legend
  y = bottom + 22;
  const legend: Array<[string, [number, number, number]]> = [
    ['Sleep (h, night before; gaps = not recorded)', [15, 118, 110]],
    [`${c.eventLabel} (diamond)`, [30, 41, 59]],
    [`Short-sleep threshold (${c.threshold} h, dashed)`, [217, 119, 6]],
    ['Amber triangle: pattern for routine clinician discussion (prototype rule)', [217, 119, 6]],
    ['Red triangle: prompt review under documented guidance', [225, 29, 72]],
  ];
  doc.setFontSize(7.5);
  for (const [label, col] of legend) {
    doc.setFillColor(...col);
    doc.rect(x, y - 5, 6, 6, 'F');
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafe(label), x + 10, y);
    y += 10;
  }
  setY(y + 6);
}

/** Lazily loads jsPDF and builds the document. */
export async function createReportPdf(report: SummaryReport, chart: PdfChart | null, variant: ReportVariant = 'full'): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title: report.title, subject: 'Decision-support summary – not a diagnosis', creator: 'ConnectHealth prototype' });
  return renderReport(doc, report, chart, variant);
}

export function reportFileName(report: SummaryReport, variant: ReportVariant): string {
  const who = report.patient.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patient';
  return `connecthealth-${variant === 'review' ? 'review' : 'report'}-${who}-${report.window.start}_to_${report.window.end}.pdf`;
}
