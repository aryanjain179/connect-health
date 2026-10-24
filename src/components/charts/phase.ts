import type { CyclePhase, PhaseBasis } from '../../analysis/cycle';

export const PHASE_COLORS: Record<CyclePhase, string> = {
  perimenstrual: 'bg-rose-300',
  follicular: 'bg-sky-200',
  periovulatory: 'bg-violet-300',
  luteal: 'bg-amber-200',
};

export const BASIS_LABELS: Record<PhaseBasis, string> = {
  recorded: 'recorded period',
  estimated: 'estimated (calendar)',
  projected: 'projected (next start not recorded)',
};
