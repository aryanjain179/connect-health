import { useState, type ReactNode } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Compass,
  Database,
  FileText,
  Flag,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Mic,
  Search,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { cx } from './ui';
import { Logo } from './Logo';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { formatWindow } from '../analysis/dates';
import type { PeriodPreset } from '../analysis/context';
import { useEditor } from './forms/EditorContext';
import { todayStatus } from './TodayCard';

export type RouteId =
  | 'overview'
  | 'timeline'
  | 'patterns'
  | 'review'
  | 'connections'
  | 'ask'
  | 'journal'
  | 'navigator'
  | 'tasks'
  | 'summary'
  | 'records'
  | 'settings';

interface NavItem {
  id: RouteId;
  label: string;
  icon: ReactNode;
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Understand',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
      { id: 'timeline', label: 'Health Timeline', icon: <CalendarRange size={18} /> },
      { id: 'patterns', label: 'Pattern Discovery', icon: <Search size={18} /> },
      { id: 'review', label: 'Clinician Review', icon: <Flag size={18} /> },
      { id: 'connections', label: 'Clinical Connections', icon: <Link2 size={18} /> },
    ],
  },
  {
    label: 'Act',
    items: [
      { id: 'ask', label: 'Ask My Health Data', icon: <MessageCircleQuestion size={18} /> },
      { id: 'journal', label: 'Voice Journal', icon: <Mic size={18} /> },
      { id: 'navigator', label: 'Care Navigator', icon: <Compass size={18} /> },
      { id: 'tasks', label: 'Care Tasks', icon: <ClipboardList size={18} /> },
      { id: 'summary', label: 'Clinician Summary', icon: <FileText size={18} /> },
    ],
  },
  {
    label: 'Manage',
    items: [
      { id: 'records', label: 'Records', icon: <Database size={18} /> },
      { id: 'settings', label: 'Settings & Sharing', icon: <Settings size={18} /> },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const PERIODS: Array<{ value: PeriodPreset; label: string }> = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All records' },
];

export function Layout({ route, children }: { route: RouteId; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { root, rootDispatch, state, dispatch, isDemo, loadNotice, dismissNotice } = useHealthData();
  const { window, findings, connections, completeness, flags } = useAnalysis();
  const { openEditor } = useEditor();
  const today = todayStatus(state.data);
  const profile = state.data.profile;
    const badges: Partial<Record<RouteId, { n: number; tone: 'amber' | 'rose' }>> = {
    patterns: { n: findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change').length, tone: 'amber' },
    review: { n: flags.length, tone: flags.some((f) => f.level === 'red') ? 'rose' : 'amber' },
    connections: { n: connections.filter((c) => c.surfaced).length, tone: 'amber' },
    tasks: { n: state.data.tasks.filter((t) => t.status !== 'done').length, tone: 'amber' },
  };

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <a href="#/overview" className="mb-4 px-2" onClick={() => setMobileOpen(false)}>
        <Logo sub="Health intelligence & navigation" />
      </a>
      <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
        <p className="flex items-center justify-between text-xs font-semibold text-teal-900">
          Record today
          {today.checkedIn ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 size={13} aria-hidden="true" /> Done
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> Not done yet
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            openEditor({ kind: 'observation' });
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <ClipboardList size={16} aria-hidden="true" /> {today.checkedIn ? 'Edit today’s check-in' : 'Check in today'}
        </button>
        <a href="#/journal" onClick={() => setMobileOpen(false)} className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-300 ring-inset hover:bg-teal-50">
          <Mic size={16} aria-hidden="true" /> Speak about my day
        </a>
      </div>
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="mb-2">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{g.label}</p>
          {g.items.map((n) => {
            const b = badges[n.id];
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                onClick={() => setMobileOpen(false)}
                aria-current={route === n.id ? 'page' : undefined}
                className={cx('flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', route === n.id ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
              >
                <span aria-hidden="true">{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {b && b.n > 0 ? (
                  <span className={cx('rounded-full px-1.5 text-xs font-semibold', b.tone === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')} aria-label={`${b.n} items`}>
                    {b.n}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      ))}

      <div className="mt-auto space-y-2 border-t border-slate-200 pt-3">
        <div className="px-2 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">{isDemo ? 'Demo patient (synthetic)' : `${profile.preferredName || profile.displayName}`}</p>
          <p>{isDemo ? 'Fictional data for demonstration' : 'Your local profile'}</p>
        </div>
        <div className="flex flex-wrap gap-1 px-1">
          {isDemo && root.profiles.user && (
            <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50" onClick={() => rootDispatch({ type: 'switchProfile', slot: 'user' })}>
              <Users size={12} className="mr-1 inline" aria-hidden="true" />
              Switch to my profile
            </button>
          )}
          {!isDemo && (
            <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50" onClick={() => rootDispatch({ type: 'switchProfile', slot: 'demo' })}>
              <Users size={12} className="mr-1 inline" aria-hidden="true" />
              View demo patient
            </button>
          )}
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => {
              rootDispatch({ type: 'signOut' });
              globalThis.location.hash = '#/welcome';
            }}
          >
            <LogOut size={12} className="mr-1 inline" aria-hidden="true" />
            Exit to welcome
          </button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          <p className="flex items-center gap-1 font-semibold">
            <ShieldAlert size={13} aria-hidden="true" /> Not medical advice
          </p>
          <p className="mt-0.5">Patterns and suggestions are for discussion with a clinician – not diagnoses.</p>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="no-print hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button type="button" className="absolute top-4 right-3 rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className={cx('no-print px-4 py-1.5 text-center text-xs font-medium', isDemo ? 'bg-amber-100/70 text-amber-900' : 'bg-teal-50 text-teal-900')} role="note">
          {isDemo
            ? 'Demo mode · Synthetic data only · fictional patient · findings are illustrative and calculated from demo records'
            : 'Your profile · stored only in this browser (not secure storage for real medical records) · nothing is sent to anyone'}
        </div>
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="period" className="text-sm text-slate-600">
              Period
            </label>
            <select id="period" value={state.period} onChange={(e) => dispatch({ type: 'setPeriod', period: e.target.value as PeriodPreset })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="hidden text-xs text-slate-500 xl:inline">
              {formatWindow(window)} · {completeness.checkInDays}/{completeness.calendarDays} days with check-ins
            </span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <a href="#/journal" aria-label="Voice journal" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 ring-2 ring-teal-600 ring-inset hover:bg-teal-50 sm:inline-flex">
              <Mic size={16} aria-hidden="true" /> Voice journal
            </a>
            <button type="button" onClick={() => openEditor({ kind: 'observation' })} className="relative hidden items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 sm:inline-flex">
              <ClipboardList size={16} aria-hidden="true" /> Daily check-in
              {!today.checkedIn && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                </span>
              )}
              <span className="sr-only">{today.checkedIn ? '(done today)' : '(not done today)'}</span>
            </button>
          </div>
        </header>
        {loadNotice && (
          <div className="mx-4 mt-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-6" role="status">
            {loadNotice}
            <button type="button" className="text-xs underline" onClick={dismissNotice}>
              Dismiss
            </button>
          </div>
        )}
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:pb-6 lg:px-8">
          {children}
        </main>
        {/* Phone: always-visible bar so recording today is one tap away. */}
        <nav aria-label="Record today" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden">
          <div className="grid grid-cols-2 gap-2">
            <a href="#/journal" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-teal-800 ring-2 ring-teal-600 ring-inset">
              <Mic size={18} aria-hidden="true" /> Speak
            </a>
            <button type="button" onClick={() => openEditor({ kind: 'observation' })} className="relative flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 text-sm font-semibold text-white">
              <ClipboardList size={18} aria-hidden="true" /> {today.checkedIn ? 'Edit check-in' : 'Check in'}
              {!today.checkedIn && <span className="absolute top-2 right-3 h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
