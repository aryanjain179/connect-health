import { useMemo, useState } from 'react';
import { Check, ClipboardPlus, Copy, Info, Phone, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardTitle, EmptyState, Notice, PageHeader, cx, inputClass } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { useEditor } from '../components/forms/EditorContext';
import { INSURANCE_CHECKLIST, TEMPLATES, buildPathway, fillTemplate, suggestSpecialties, type SpecialtySuggestion } from '../navigator/navigator';
import { SPECIALTY_LABELS } from '../conditions/catalog';
import { newId } from '../store/reducer';
import type { ContactLogEntry, NavigatorState } from '../models/types';
import { localToday } from '../analysis/dates';
import { TaskStatusBadge } from './TasksPage';

export function NavigatorPage() {
  const { state, dispatch } = useHealthData();
  const { flags, connections } = useAnalysis();
  const { openEditor } = useEditor();
  const nav = state.data.navigator;
  const setNav = (n: NavigatorState) => dispatch({ type: 'setNavigator', navigator: n });
  const suggestions = useMemo(() => suggestSpecialties(state.data, flags, connections), [state.data, flags, connections]);
  const questionCount = new Set(flags.flatMap((f) => f.questions)).size;
  const pathway = buildPathway(state.data, flags, questionCount);
  const openTasks = state.data.tasks.filter((t) => t.status !== 'done');

  const taskFor = (s: SpecialtySuggestion) =>
    openEditor({
      kind: 'task',
      insightTitle: `${s.label} (Care Navigator suggestion)`,
      defaults: {
        title: s.specialty === 'primary-care' ? 'Ask primary care to review my recorded concerns' : `Ask whether seeing ${s.label.toLowerCase()} would be useful`,
        reason: `${s.why} ${s.sources.map((x) => x.label).join('; ')}`.trim(),
        kind: s.specialty === 'primary-care' ? 'discuss-pattern' : 'ask-assessment',
        insightId: `specialty:${s.specialty}`,
        links: [{ kind: 'specialty', id: s.specialty, label: s.label }],
      },
    });

  return (
    <>
      <PageHeader title="Care Navigator" description="Move from a health observation to a practical next step: who to talk to, what to ask, and how to handle referrals and insurance." />
      <Notice tone="slate" icon={<Info size={16} />}>
        ConnectHealth does not make referrals, book appointments, verify coverage or contact anyone. Suggestions below are prompts to discuss with your clinicians, based on what you recorded. Only you can record that a call or booking happened.
      </Notice>

      <section className="mt-6" aria-labelledby="specialties-h">
        <h2 id="specialties-h" className="mb-3 text-lg font-semibold text-slate-900">
          Specialties and services that may be worth discussing
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {suggestions.map((s) => (
            <Card key={s.specialty} as="article" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Stethoscope size={16} className="text-teal-700" aria-hidden="true" /> {s.label}
                </h3>
                <div className="flex gap-1">
                  <Badge tone={s.sources.length ? 'violet' : 'slate'}>{s.sources.length ? 'Personalised' : 'Generic'}</Badge>
                  {s.inCareTeam && <Badge tone="teal">In your care team</Badge>}
                </div>
              </div>
              <p className="text-sm text-slate-700">{s.why}</p>
              {s.sources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600">Informed by</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {s.sources.map((src) => (
                      <li key={src.kind + src.label}>
                        <Badge tone={src.kind === 'flag' ? 'amber' : src.kind === 'connection' ? 'violet' : src.kind === 'condition' ? 'teal' : 'sky'}>
                          {src.kind}: {src.label.length > 60 ? `${src.label.slice(0, 57)}…` : src.label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">
                <span className="font-semibold">Uncertain: </span>
                {s.uncertainty}
              </p>
              <p className="rounded-md bg-teal-50/70 p-2 text-sm text-teal-900">{s.question}</p>
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Referral: </span>
                {s.referralNote}
              </p>
              <div className="mt-auto pt-1">
                <Button size="sm" onClick={() => taskFor(s)}>
                  <ClipboardPlus size={14} aria-hidden="true" /> Add next step to tasks
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Tick steps as you complete them. “For you” notes come from your records; the rest is general guidance.">Next-step pathway</CardTitle>
          <ol className="space-y-3">
            {pathway.map((p, i) => (
              <li key={p.id} className="flex gap-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-teal-700"
                  aria-label={`Step ${i + 1} done: ${p.title}`}
                  checked={!!nav.pathway[p.id]}
                  onChange={(e) => setNav({ ...nav, pathway: { ...nav.pathway, [p.id]: e.target.checked } })}
                />
                <div className="text-sm">
                  <p className={cx('font-medium', nav.pathway[p.id] ? 'text-slate-400 line-through' : 'text-slate-900')}>
                    {i + 1}. {p.title}
                  </p>
                  <p className="text-slate-600">
                    <Badge className="mr-1">General</Badge>
                    {p.generic}
                  </p>
                  {p.personal && (
                    <p className="mt-0.5 text-slate-700">
                      <Badge tone="violet" className="mr-1">For you</Badge>
                      {p.personal}
                    </p>
                  )}
                  {p.link && (
                    <a href={p.link.href} className="text-xs font-medium text-teal-800 underline">
                      {p.link.label}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardTitle sub="Ask these questions and note the answers exactly as given. ConnectHealth does not know your coverage.">Insurance and access checklist</CardTitle>
          <ul className="space-y-2">
            {INSURANCE_CHECKLIST.map((c) => (
              <li key={c.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 accent-teal-700" checked={!!nav.checklist[c.id]} onChange={(e) => setNav({ ...nav, checklist: { ...nav.checklist, [c.id]: e.target.checked } })} />
                  <span>
                    <span className={nav.checklist[c.id] ? 'text-slate-400 line-through' : 'text-slate-800'}>{c.label}</span>
                    <span className="block text-xs text-slate-500">{c.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-800">Insurance details (optional, stored locally)</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="ins-name" className="text-xs font-medium text-slate-600">Insurer</label>
              <input id="ins-name" className={inputClass} value={nav.insurance.insurer} onChange={(e) => setNav({ ...nav, insurance: { ...nav.insurance, insurer: e.target.value } })} />
            </div>
            <div>
              <label htmlFor="ins-phone" className="text-xs font-medium text-slate-600">Member services phone</label>
              <input id="ins-phone" className={inputClass} value={nav.insurance.phone} onChange={(e) => setNav({ ...nav, insurance: { ...nav.insurance, phone: e.target.value } })} />
            </div>
            <div>
              <label htmlFor="ins-plan" className="text-xs font-medium text-slate-600">Plan type</label>
              <select id="ins-plan" className={inputClass} value={nav.insurance.planType} onChange={(e) => setNav({ ...nav, insurance: { ...nav.insurance, planType: e.target.value as NavigatorState['insurance']['planType'] } })}>
                {['', 'HMO', 'PPO', 'EPO', 'POS', 'Medicaid', 'Medicare', 'Other', 'Unknown'].map((p) => (
                  <option key={p} value={p}>
                    {p || 'Not recorded'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Avoid storing full member IDs on shared devices – browser storage is not secure.</p>
        </Card>
      </div>

      <ContactLog nav={nav} setNav={setNav} />

      <Templates suggestions={suggestions} />

      <Card className="mt-8">
        <CardTitle action={<Button size="sm" onClick={() => openEditor({ kind: 'task' })}><Plus size={14} aria-hidden="true" /> New task</Button>} sub="Statuses: started, waiting, blocked, completed. Only what you record is shown.">
          Outstanding care-coordination tasks ({openTasks.length})
        </CardTitle>
        <ul className="divide-y divide-slate-100">
          {openTasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <button type="button" className="text-left font-medium text-slate-800 hover:text-teal-800" onClick={() => openEditor({ kind: 'task', record: t })}>
                {t.title}
              </button>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {t.contactedWho && `Contacted ${t.contactedWho}${t.contactedOn ? ` on ${t.contactedOn}` : ''} · `}
                {t.followUpDate && `Follow up ${t.followUpDate} · `}
                <TaskStatusBadge status={t.status} />
              </span>
            </li>
          ))}
          {!openTasks.length && <li className="py-2 text-sm text-slate-500">No outstanding tasks.</li>}
        </ul>
      </Card>
    </>
  );
}

function ContactLog({ nav, setNav }: { nav: NavigatorState; setNav: (n: NavigatorState) => void }) {
  const blank = (): ContactLogEntry => ({ id: newId('contact'), date: localToday(), party: 'insurer', name: '', referenceNumber: '', notes: '', followUpDate: null });
  const [draft, setDraft] = useState<ContactLogEntry>(blank);
  const [error, setError] = useState<string | null>(null);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() && !draft.notes.trim()) {
      setError('Add who you spoke to or a note.');
      return;
    }
    setNav({ ...nav, contacts: [...nav.contacts, draft] });
    setDraft(blank());
    setError(null);
  };
  return (
    <Card className="mt-8">
      <CardTitle icon={<Phone size={18} />} sub="Record calls and messages you made – who, when, reference numbers and follow-ups.">
        Contact log
      </CardTitle>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-6" noValidate>
        <div>
          <label htmlFor="c-date" className="text-xs font-medium text-slate-600">Date</label>
          <input id="c-date" type="date" className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </div>
        <div>
          <label htmlFor="c-party" className="text-xs font-medium text-slate-600">Contacted</label>
          <select id="c-party" className={inputClass} value={draft.party} onChange={(e) => setDraft({ ...draft, party: e.target.value as ContactLogEntry['party'] })}>
            <option value="insurer">Insurer</option>
            <option value="primary-care">Primary care office</option>
            <option value="specialist-office">Specialist office</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-name" className="text-xs font-medium text-slate-600">Name / office</label>
          <input id="c-name" className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="c-ref" className="text-xs font-medium text-slate-600">Reference #</label>
          <input id="c-ref" className={inputClass} value={draft.referenceNumber} onChange={(e) => setDraft({ ...draft, referenceNumber: e.target.value })} />
        </div>
        <div>
          <label htmlFor="c-follow" className="text-xs font-medium text-slate-600">Follow-up date</label>
          <input id="c-follow" type="date" className={inputClass} value={draft.followUpDate ?? ''} onChange={(e) => setDraft({ ...draft, followUpDate: e.target.value || null })} />
        </div>
        <div className="sm:col-span-6">
          <label htmlFor="c-notes" className="text-xs font-medium text-slate-600">What was said / decided</label>
          <input id="c-notes" className={inputClass} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-6">
          <Button type="submit" variant="primary">
            <Plus size={14} aria-hidden="true" /> Add to log
          </Button>
          {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
        </div>
      </form>
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {[...nav.contacts].sort((a, b) => (a.date < b.date ? 1 : -1)).map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-slate-800">
                {c.date} · {c.party.replace('-', ' ')} {c.name && `· ${c.name}`}
              </span>
              <span className="block text-slate-600">
                {c.referenceNumber && `Ref ${c.referenceNumber}. `}
                {c.notes}
                {c.followUpDate && ` Follow up: ${c.followUpDate}.`}
              </span>
            </span>
            <button type="button" className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete contact entry" onClick={() => setNav({ ...nav, contacts: nav.contacts.filter((x) => x.id !== c.id) })}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {!nav.contacts.length && <li className="py-2"><EmptyState>No contacts recorded yet.</EmptyState></li>}
      </ul>
    </Card>
  );
}

function Templates({ suggestions }: { suggestions: SpecialtySuggestion[] }) {
  const { state } = useHealthData();
  const { flags } = useAnalysis();
  const p = state.data.profile;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    'your name': p.isSynthetic ? '' : p.displayName,
    specialty: suggestions.find((s) => s.specialty !== 'primary-care')?.label ?? '',
    insurer: state.data.navigator.insurance.insurer,
    'pattern summary': flags[0] ? `${flags[0].title} (${flags[0].window.start} to ${flags[0].window.end})` : '',
  }));
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const fields = ['your name', 'specialty', 'insurer', 'clinician name', 'concern', 'pattern summary'];

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied(`${id}:fail`);
    }
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="mt-8">
      <CardTitle sub="Fill in the common fields, edit the text, then copy. Anything left in [brackets] still needs your input. Templates do not state your coverage or legal rights.">Communication templates</CardTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f}>
            <label htmlFor={`tpl-${f}`} className="text-xs font-medium text-slate-600 capitalize">{f}</label>
            {f === 'specialty' ? (
              <select id={`tpl-${f}`} className={inputClass} value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })}>
                <option value="">[specialty]</option>
                {Object.values(SPECIALTY_LABELS).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <input id={`tpl-${f}`} className={inputClass} value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {TEMPLATES.map((t) => {
          const text = edited[t.id] ?? fillTemplate(t.body, values);
          return (
            <div key={t.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={`tpl-body-${t.id}`} className="text-sm font-semibold text-slate-800">{t.title}</label>
                <Button size="sm" onClick={() => copy(t.id, text)} aria-label={`Copy template: ${t.title}`}>
                  {copied === t.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied === t.id ? 'Copied' : copied === `${t.id}:fail` ? 'Copy failed' : 'Copy'}
                </Button>
              </div>
              <textarea id={`tpl-body-${t.id}`} rows={6} className={inputClass} value={text} onChange={(e) => setEdited({ ...edited, [t.id]: e.target.value })} />
              {edited[t.id] !== undefined && (
                <button type="button" className="mt-1 text-xs text-teal-800 underline" onClick={() => setEdited(({ [t.id]: _drop, ...rest }) => rest)}>
                  Reset to template
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
