import type { FindingStatus } from '../models/analysis';
import type { HistoryStatus, RecordSource } from '../models/types';
import { STATUS_LABELS } from '../analysis';
import { Badge } from './ui';

export function StatusBadge({ status }: { status: FindingStatus }) {
  const tone = status === 'possible-pattern' ? 'amber' : status === 'notable-change' ? 'rose' : status === 'no-clear-pattern' ? 'teal' : 'slate';
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}

export function historyStatusTone(s: HistoryStatus) {
  return s === 'confirmed' ? 'teal' : s === 'patient-reported' ? 'sky' : s === 'pending' || s === 'suspected' ? 'amber' : 'slate';
}

export function sourceLabel(s: RecordSource): string {
  return s === 'clinician-documented' ? 'Clinician-documented' : s === 'patient-reported' ? 'Patient-reported' : 'External record';
}
