import { useState, type ReactNode } from 'react';
import {
  Activity,
  CalendarRange,
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  Link2,
  Menu,
  Plus,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cx } from './ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { formatWindow } from '../analysis/dates';
import type { PeriodPreset } from '../analysis/context';
import { useEditor } from './forms/EditorContext';

export type RouteId = 'overview' | 'timeline' | 'patterns' | 'connections' | 'summary' | 'tasks' | 'records';

export const NAV: Array<{ id: RouteId; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'timeline', label: 'Health Timeline', icon: <CalendarRange size={18} /> },
  { id: 'patterns', label: 'Pattern Discovery', icon: <Search size={18} /> },
  { id: 'connections', label: 'Clinical Connections', icon: <Link2 size={18} /> },
  { id: 'summary', label: 'Clinician Summary', icon: <FileText size={18} /> },
  { id: 'tasks', label: 'Care Tasks', icon: <ClipboardList size={18} /> },
];

const PERIODS: Array<{ value: PeriodPreset; label: string }> = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All records' },
];

function NavLink({ id, label, icon, active, onNavigate, badge }: { id: RouteId; label: string; icon: ReactNode; active: boolean; onNavigate: (id: RouteId) => void; badge?: number }) {
  return (
    <a
      href={`#/${id}`}
      onClick={() => onNavigate(id)}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800" aria-label={`${badge} items need review`}>{badge}</span> : null}
    </a>
  );
}

export function Layout({ route, children }: { route: RouteId; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { state, dispatch, loadNotice, dismissNotice } = useHealthData();
  const { window, findings, connections, completeness } = useAnalysis();
  const { openEditor } = useEditor();
  const patternCount = findings.filter((f) => f.status === 'possible-pattern' || f.status === 'notable-change').length;
  const connCount = connections.filter((c) => c.surfaced).length;
  const openTasks = state.data.tasks.filter((t) => t.status !== 'done').length;
  const badges: Partial<Record<RouteId, number>> = { patterns: patternCount, connections: connCount, tasks: openTasks };

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white" aria-hidden="true">
          <Activity size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">HealthConnect</p>
          <p className="text-xs text-slate-500">Health intelligence prototype</p>
        </div>
      </div>
      {NAV.map((n) => (
        <NavLink key={n.id} {...n} active={route === n.id} onNavigate={() => setMobileOpen(false)} badge={badges[n.id]} />
      ))}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Data</p>
        <NavLink id="records" label="Records" icon={<Database size={18} />} active={route === 'records'} onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="mt-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="flex items-center gap-1 font-semibold">
          <ShieldAlert size={14} aria-hidden="true" /> Not medical advice
        </p>
        <p className="mt-1">Fictional data and exploratory calculations for discussion with a clinician.</p>
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
        <div className="bg-amber-100/70 px-4 py-1.5 text-center text-xs font-medium text-amber-900" role="note">
          Synthetic data only · fictional patient · findings are illustrative and calculated from demo records
        </div>
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="period" className="text-sm text-slate-600">
              Analysis period
            </label>
            <select id="period" value={state.period} onChange={(e) => dispatch({ type: 'setPeriod', period: e.target.value as PeriodPreset })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="hidden text-xs text-slate-500 md:inline">{formatWindow(window)} · anchored to latest record · {completeness.checkInDays}/{completeness.calendarDays} days with check-ins</span>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => openEditor({ kind: 'observation' })} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
              <Plus size={16} aria-hidden="true" /> Daily check-in
            </button>
            <button type="button" onClick={() => openEditor({ kind: 'seizure' })} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
              <Plus size={16} aria-hidden="true" /> Log seizure
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
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
