import { AlertTriangle, ClipboardPlus, ExternalLink, Flag } from 'lucide-react';
import type { ReviewFlag } from '../../review/flags';
import { Badge, Button, Modal, Notice, cx } from '../ui';
import { EvidenceLinks } from '../InsightCard';
import { formatDate, formatWindow } from '../../analysis/dates';
import { useHealthData } from '../../store/HealthDataContext';
import { useEditor } from '../forms/EditorContext';

export function FlagBadge({ flag }: { flag: ReviewFlag }) {
  return (
    <Badge tone={flag.level === 'red' ? 'rose' : 'amber'}>
      <Flag size={11} aria-hidden="true" /> {flag.level === 'red' ? 'Red · prompt review' : 'Amber · routine discussion'}
    </Badge>
  );
}

export function taskDefaultsFromFlag(f: ReviewFlag) {
  return {
    title: f.level === 'red' ? 'Tell my care team about the recorded prolonged seizure' : `Discuss at my next appointment: ${f.title}`,
    reason: `${f.patientMessage} (${f.observation})`,
    kind: f.level === 'red' ? 'ask-assessment' : 'discuss-pattern',
    insightId: f.id,
    links: [{ kind: 'flag', id: f.id, label: f.title }],
  };
}

/** Body shared by the dialog and the Clinician Review page. */
export function FlagDetails({ flag: f, compact }: { flag: ReviewFlag; compact?: boolean }) {
  const { state, dispatch } = useHealthData();
  const included = !state.data.reviewExcluded.includes(f.id);
  return (
    <div className="space-y-3 text-sm">
      <div className={cx('rounded-lg border p-3', f.level === 'red' ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-amber-200 bg-amber-50 text-amber-950')}>
        <p className="font-semibold">Pattern identified for clinician review.</p>
        <p className="mt-1">A change or correlation was observed in your recorded health data during this period. The significance is uncertain. Please discuss this finding with a qualified healthcare professional.</p>
      </div>
      {f.urgentGuidance && (
        <Notice tone="rose" icon={<AlertTriangle size={16} />}>
          {f.urgentGuidance}
        </Notice>
      )}
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">What was observed</dt>
          <dd>{f.observation}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Observation window</dt>
          <dd>{formatWindow(f.window)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Observations used</dt>
          <dd>{f.observations} days / records</dd>
        </div>
        {!compact && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Data compared</dt>
            <dd className="text-slate-700">{f.dataCompared}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Comparison</dt>
          <dd className="text-slate-700">{f.comparison}</dd>
        </div>
        {f.ranges.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Comparison periods</dt>
            <dd>{f.ranges.map((r) => `${r.label}: ${formatDate(r.start, true)} – ${formatDate(r.end, true)}`).join(' · ')}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Dates involved (open in timeline)</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {f.involvedDates.length ? (
              f.involvedDates.map((d) => (
                <a key={d} href={`#/timeline?date=${d}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800">
                  {formatDate(d, true)}
                </a>
              ))
            ) : (
              <span className="text-slate-500">No individual dates (comparison of periods).</span>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Missing or incomplete data</dt>
          <dd>
            <ul className="list-disc pl-5 text-slate-700">
              {f.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Why it was flagged ({f.rule.basis === 'clinically-reviewed-guidance' ? 'documented guidance' : 'prototype rule – not clinically validated'})</dt>
          <dd className="text-slate-700">{f.rule.description}</dd>
          {f.rule.evidenceIds.length > 0 && (
            <div className="mt-1">
              <EvidenceLinks ids={f.rule.evidenceIds} />
            </div>
          )}
        </div>
      </dl>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
        <input type="checkbox" className="accent-teal-700" checked={included} onChange={() => dispatch({ type: 'toggleReviewExcluded', id: f.id })} />
        Include this finding in the clinician report and PDF
      </label>
    </div>
  );
}

export function FlagDialog({ flag, onClose }: { flag: ReviewFlag | null; onClose: () => void }) {
  const { openEditor } = useEditor();
  return (
    <Modal
      open={!!flag}
      title={flag?.title ?? ''}
      onClose={onClose}
      wide
      footer={
        flag && (
          <>
            <a href={`#/review?flag=${encodeURIComponent(flag.id)}`} onClick={onClose} className="inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
              <ExternalLink size={14} aria-hidden="true" /> Open in Clinician Review
            </a>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                openEditor({ kind: 'task', defaults: taskDefaultsFromFlag(flag), insightTitle: flag.title });
              }}
            >
              <ClipboardPlus size={14} aria-hidden="true" /> Create follow-up task
            </Button>
          </>
        )
      }
    >
      {flag && (
        <>
          <div className="mb-3">
            <FlagBadge flag={flag} />
          </div>
          <FlagDetails flag={flag} compact />
        </>
      )}
    </Modal>
  );
}

/** Keyboard-accessible list of markers shown under a chart. */
export function FlagMarkerList({ flags, onOpen }: { flags: ReviewFlag[]; onOpen: (f: ReviewFlag) => void }) {
  if (!flags.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-700">Markers on this chart</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {flags.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onOpen(f)}
              className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', f.level === 'red' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}
            >
              <Flag size={11} aria-hidden="true" /> {f.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
