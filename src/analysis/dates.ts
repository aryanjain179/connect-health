/**
 * UTC-based helpers for ISO calendar dates (`YYYY-MM-DD`).
 * Using UTC avoids daylight-saving and time-zone shifts when counting days.
 */
import type { ISODate } from '../models/types';
import type { DateWindow } from '../models/analysis';

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toUTC(date: ISODate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** Inclusive list of dates from start to end. Empty if end < start. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function inWindow(date: ISODate, w: DateWindow): boolean {
  return date >= w.start && date <= w.end;
}

export function windowDays(w: DateWindow): number {
  return Math.max(0, diffDays(w.start, w.end) + 1);
}

export function minDate(dates: ISODate[]): ISODate | null {
  return dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : null;
}

export function maxDate(dates: ISODate[]): ISODate | null {
  return dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 5" or "Oct 5, 2026". */
export function formatDate(date: ISODate, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}

export function formatWindow(w: DateWindow): string {
  return `${formatDate(w.start, true)} – ${formatDate(w.end, true)}`;
}

/** Local "today" as ISO date – UI use only (never inside analysis functions). */
export function localToday(): ISODate {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
