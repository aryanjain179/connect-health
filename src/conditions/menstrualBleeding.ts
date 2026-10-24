/**
 * Daily "menstrual bleeding" answers and how they keep period records up to date.
 *
 * The check-in asks "Menstrual bleeding on this day?" (yes / no / not recorded). The answer is stored on the
 * check-in (`measures['menstrual-bleeding']`). Period records – used by the cycle-phase analysis – are kept in step:
 *
 *   Yes → if the day is already inside a period, nothing changes; if it is within 2 days after a period's last day
 *         the period is extended; if it is within 2 days before a period's first day the start moves earlier;
 *         otherwise a new one-day period starts.
 *   No  → a one-day period on that date is removed; a period ending or starting on that date is trimmed by one day.
 *         A "no" in the middle of a period (e.g. a light day) does not split it.
 *   Not recorded → no change.
 *
 * Bleeding days are recorded as the person reports them; they are never inferred from cycle estimates.
 */
import type { ISODate, MenstrualRecord } from '../models/types';
import type { Action } from '../store/reducer';
import { addDays, diffDays } from '../analysis/dates';

export const BLEEDING_KEY = 'menstrual-bleeding';
const GAP_DAYS = 2;

const endOf = (r: MenstrualRecord) => r.periodEnd ?? r.periodStart;

export interface BleedingChanges {
  actions: Action[];
  createdIds: string[];
  /** Previous versions of records that were changed or deleted (for undo). */
  previous: MenstrualRecord[];
}

export function periodCovering(records: MenstrualRecord[], date: ISODate): MenstrualRecord | undefined {
  return records.find((r) => r.periodStart <= date && date <= endOf(r));
}

export function reconcileBleeding(records: MenstrualRecord[], date: ISODate, bleeding: boolean | null, newId: () => string): BleedingChanges {
  const out: BleedingChanges = { actions: [], createdIds: [], previous: [] };
  if (bleeding === null) return out;
  const sorted = [...records].sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));

  if (bleeding) {
    if (periodCovering(sorted, date)) return out;
    const before = sorted.filter((r) => endOf(r) < date && diffDays(endOf(r), date) <= GAP_DAYS).pop();
    if (before) {
      out.previous.push(before);
      out.actions.push({ type: 'upsert', collection: 'menstrual', record: { ...before, periodEnd: date } });
      return out;
    }
    const after = sorted.find((r) => r.periodStart > date && diffDays(date, r.periodStart) <= GAP_DAYS);
    if (after) {
      out.previous.push(after);
      out.actions.push({ type: 'upsert', collection: 'menstrual', record: { ...after, periodStart: date, periodEnd: endOf(after) } });
      return out;
    }
    const id = newId();
    out.createdIds.push(id);
    out.actions.push({ type: 'upsert', collection: 'menstrual', record: { id, periodStart: date, periodEnd: date, startCertainty: 'exact', notes: 'From daily bleeding answers.', isSynthetic: false } });
    return out;
  }

  const r = periodCovering(sorted, date);
  if (!r) return out;
  out.previous.push(r);
  if (r.periodStart === date && endOf(r) === date) out.actions.push({ type: 'delete', collection: 'menstrual', id: r.id });
  else if (endOf(r) === date) out.actions.push({ type: 'upsert', collection: 'menstrual', record: { ...r, periodEnd: addDays(date, -1) } });
  else if (r.periodStart === date) out.actions.push({ type: 'upsert', collection: 'menstrual', record: { ...r, periodStart: addDays(date, 1) } });
  else out.previous.pop(); // middle day: leave the period intact
  return out;
}
