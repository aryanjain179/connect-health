/**
 * "How are you today?" – the main patient call to action. Two equally clear ways to record today:
 * talk (Voice Journal) or answer the short check-in form. Shows whether today is already done.
 */
import { CheckCircle2, ClipboardList, Mic, PencilLine } from 'lucide-react';
import type { HealthData, ISODate } from '../models/types';
import { checkinPlan } from '../conditions/checkin';
import { diffDays, formatDate, localToday, maxDate } from '../analysis/dates';
import { useHealthData } from '../store/HealthDataContext';
import { useEditor } from './forms/EditorContext';
import { cx } from './ui';

export interface TodayStatus {
  today: ISODate;
  checkedIn: boolean;
  journaledToday: boolean;
  lastCheckIn: ISODate | null;
  daysSinceLast: number | null;
}

export function todayStatus(data: HealthData, today: ISODate = localToday()): TodayStatus {
  const lastCheckIn = maxDate(data.observations.map((o) => o.date).filter((d) => d <= today));
  return {
    today,
    checkedIn: data.observations.some((o) => o.date === today),
    journaledToday: data.journal.some((j) => j.date === today),
    lastCheckIn,
    daysSinceLast: lastCheckIn ? diffDays(lastCheckIn, today) : null,
  };
}

/** Short, friendly list of what today's check-in will ask, based on the person's conditions. */
export function checkinTopics(data: HealthData): string {
  const plan = checkinPlan(data);
  const extras = [plan.seizures && 'seizures', ...plan.builtin.map((b) => b.label.toLowerCase().replace(' / concentration difficulty', '')), ...plan.measures.map((m) => m.def.label.replace(/\s*\(.*\)$/, '').toLowerCase()), plan.menstrual && 'menstrual bleeding']
    .filter(Boolean)
    .slice(0, 4) as string[];
  return ['sleep', 'stress', ...extras].join(', ');
}

export function TodayCard() {
  const { state } = useHealthData();
  const { openEditor } = useEditor();
  const p = state.data.profile;
  const s = todayStatus(state.data);
  const name = p.preferredName || (p.isSynthetic ? '' : p.displayName.split(' ')[0]);

  return (
    <section aria-labelledby="today-title" className={cx('mb-6 overflow-hidden rounded-2xl border shadow-sm', s.checkedIn ? 'border-emerald-200 bg-emerald-50/60' : 'border-teal-200 bg-gradient-to-br from-teal-700 to-teal-800 text-white')}>
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className={cx('text-xs font-semibold tracking-wide uppercase', s.checkedIn ? 'text-emerald-800' : 'text-teal-100')}>Today · {formatDate(s.today, true)}</p>
          <h2 id="today-title" className={cx('mt-1 text-xl font-semibold sm:text-2xl', s.checkedIn ? 'text-slate-900' : 'text-white')}>
            {s.checkedIn ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-600" aria-hidden="true" /> You’ve checked in today{name ? `, ${name}` : ''}
              </span>
            ) : (
              <>How are you today{name ? `, ${name}` : ''}?</>
            )}
          </h2>
          <p className={cx('mt-1 max-w-xl text-sm', s.checkedIn ? 'text-slate-600' : 'text-teal-50')}>
            {s.checkedIn
              ? 'You can add more at any time – for example if symptoms change later today.'
              : `Takes about a minute. Talk about your day, or answer a few quick questions (${checkinTopics(state.data)}).`}
          </p>
          {!s.checkedIn && s.lastCheckIn && (
            <p className="mt-2 text-xs text-teal-100">
              Last check-in: {formatDate(s.lastCheckIn, true)}
              {s.daysSinceLast !== null && s.daysSinceLast > 0 ? ` (${s.daysSinceLast} day${s.daysSinceLast === 1 ? '' : 's'} ago)` : ''}. Missed days are fine – they are simply left out of the calculations.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <a
            href="#/journal"
            className={cx(
              'inline-flex min-h-14 items-center justify-center gap-3 rounded-xl px-5 py-3 text-base font-semibold shadow-sm transition-colors',
              s.checkedIn ? 'bg-white text-teal-800 ring-1 ring-teal-200 ring-inset hover:bg-teal-50' : 'bg-white text-teal-800 hover:bg-teal-50',
            )}
          >
            <span className={cx('flex h-9 w-9 items-center justify-center rounded-full', s.checkedIn ? 'bg-teal-100' : 'bg-teal-700 text-white')} aria-hidden="true">
              <Mic size={18} />
            </span>
            <span className="text-left leading-tight">
              Speak about my day
              <span className="block text-xs font-normal opacity-75">Voice journal – you approve everything</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => openEditor({ kind: 'observation' })}
            className={cx(
              'inline-flex min-h-14 items-center justify-center gap-3 rounded-xl px-5 py-3 text-base font-semibold shadow-sm transition-colors',
              s.checkedIn ? 'bg-teal-700 text-white hover:bg-teal-800' : 'bg-amber-300 text-slate-900 hover:bg-amber-200',
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70" aria-hidden="true">
              {s.checkedIn ? <PencilLine size={18} /> : <ClipboardList size={18} />}
            </span>
            <span className="text-left leading-tight">
              {s.checkedIn ? 'Edit today’s check-in' : 'Start today’s check-in'}
              <span className="block text-xs font-normal opacity-75">Quick questions form</span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
