import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Pencil, Plus, Search, X } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { Badge, Button, Notice, cx, inputClass } from '../components/ui';
import { TextInput } from '../components/forms/fields';
import { useHealthData } from '../store/HealthDataContext';
import { CATEGORIES, GOALS, STATUS_LABELS, searchConditions, type ConditionStatus } from '../conditions/catalog';
import {
  addAllergy,
  setNoKnownAllergies,
  toggleAllergen,
  updateAllergy,
  addCustomCondition,
  createUserState,
  emptyDraft,
  setConditionStatus,
  setNoKnownConditions,
  suggestedTrackers,
  toggleCondition,
  validateAbout,
  type OnboardingDraft,
} from '../onboarding/profileDraft';
import { DRAFT_KEY } from '../store/storage';
import { planForConditions } from '../conditions/checkin';
import { localToday } from '../analysis/dates';
import { ALLERGY_CATEGORY_LABELS, SEX_LABELS, type AllergyCategory, type Sex } from '../models/types';
import { COMMON_ALLERGENS, SEVERITY_LABELS, type AllergyDraft } from '../conditions/allergies';
import { navigate } from './WelcomePage';

const STEPS = ['About you', 'Your health conditions', 'Your allergies', 'Your health goals', 'Review and enter'];

function loadDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft(), ...(JSON.parse(raw) as OnboardingDraft) };
  } catch {
    /* ignore */
  }
  return emptyDraft();
}

export function OnboardingPage() {
  const { root, rootDispatch } = useHealthData();
  const [draft, setDraft] = useState<OnboardingDraft>(loadDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = localToday();

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable – the form still works in memory */
    }
  }, [draft]);

  const go = (step: number) => {
    if (step > draft.step && draft.step === 0) {
      const e = validateAbout(draft.about, today);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setDraft((d) => ({ ...d, step }));
    window.scrollTo?.({ top: 0 });
  };

  const finish = () => {
    const e = validateAbout(draft.about, today);
    if (Object.keys(e).length) {
      setErrors(e);
      setDraft((d) => ({ ...d, step: 0 }));
      return;
    }
    rootDispatch({ type: 'createUserProfile', state: createUserState(draft, today) });
    localStorage.removeItem(DRAFT_KEY);
    navigate('overview');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button type="button" onClick={() => navigate('welcome')} className="flex items-center gap-2 text-sm font-semibold text-slate-900" aria-label="Back to welcome screen">
            <LogoMark size={28} /> Connect<span className="-ml-2 text-teal-700">Health</span>
          </button>
          <span className="text-xs text-slate-500">Progress is saved in this browser</span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s}>
              <div className={cx('h-1.5 rounded-full', i <= draft.step ? 'bg-teal-600' : 'bg-slate-200')} />
              <p className={cx('mt-1 hidden text-xs sm:block', i === draft.step ? 'font-semibold text-teal-800' : 'text-slate-500')} aria-current={i === draft.step ? 'step' : undefined}>
                {i + 1}. {s}
              </p>
            </li>
          ))}
        </ol>
        <p className="mb-1 text-xs font-medium text-slate-500 sm:hidden">
          Step {draft.step + 1} of {STEPS.length} · {STEPS[draft.step]}
        </p>
        {root.profiles.user && (
          <div className="mb-4">
            <Notice tone="amber">A local profile already exists. Creating a new one will replace it on this device (the demo patient is not affected).</Notice>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {draft.step === 0 && <AboutStep draft={draft} setDraft={setDraft} errors={errors} />}
          {draft.step === 1 && <ConditionsStep draft={draft} setDraft={setDraft} />}
          {draft.step === 2 && <AllergiesStep draft={draft} setDraft={setDraft} />}
          {draft.step === 3 && <GoalsStep draft={draft} setDraft={setDraft} />}
          {draft.step === 4 && <ReviewStep draft={draft} onEdit={(s) => setDraft((d) => ({ ...d, step: s }))} />}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5">
            <Button onClick={() => (draft.step === 0 ? navigate('welcome') : go(draft.step - 1))}>
              <ArrowLeft size={16} aria-hidden="true" /> {draft.step === 0 ? 'Back' : 'Previous'}
            </Button>
            <div className="flex gap-2">
              {(draft.step === 1 || draft.step === 2) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft((d) => (d.step === 1 ? { ...d, conditionsSkipped: true } : { ...d, allergiesSkipped: true, noKnownAllergies: false, allergies: [] }));
                    go(draft.step + 1);
                  }}
                >
                  Skip for now
                </Button>
              )}
              {draft.step < 4 ? (
                <Button variant="primary" onClick={() => go(draft.step + 1)}>
                  Continue <ArrowRight size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Button variant="primary" onClick={finish}>
                  <Check size={16} aria-hidden="true" /> Create My Profile
                </Button>
              )}
            </div>
          </div>
        </section>
        <p className="mt-4 text-center text-xs text-slate-500">Stored only in this browser · not secure storage for real medical records · nothing is sent anywhere.</p>
      </main>
    </div>
  );
}

type StepProps = { draft: OnboardingDraft; setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft>> };

function AboutStep({ draft, setDraft, errors }: StepProps & { errors: Record<string, string> }) {
  const a = draft.about;
  const set = (patch: Partial<typeof a>) => setDraft((d) => ({ ...d, about: { ...d.about, ...patch } }));
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">About you</h1>
      <p className="mt-1 text-sm text-slate-600">Only your name, age and sex are required. Everything else is optional and can be changed later in Settings.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextInput label="Full name *" value={a.fullName} onChange={(v) => set({ fullName: v })} error={errors.fullName} />
        <TextInput label="Preferred name (optional)" value={a.preferredName} onChange={(v) => set({ preferredName: v })} hint="Used in greetings." />
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Age or date of birth *</legend>
          <div className="mt-1 flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="ageMode" className="accent-teal-700" checked={a.ageMode === 'age'} onChange={() => set({ ageMode: 'age' })} /> Age
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="ageMode" className="accent-teal-700" checked={a.ageMode === 'dob'} onChange={() => set({ ageMode: 'dob' })} /> Date of birth
            </label>
          </div>
          <div className="mt-2 max-w-xs">
            {a.ageMode === 'age' ? (
              <TextInput label="Age in years" type="number" value={a.age} onChange={(v) => set({ age: v })} error={errors.age} />
            ) : (
              <TextInput label="Date of birth" type="date" value={a.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} error={errors.dateOfBirth} />
            )}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Sex *</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['female', 'male', 'intersex', 'unspecified'] as Sex[]).map((s) => (
              <label key={s} className={cx('cursor-pointer rounded-full px-3 py-1.5 text-sm ring-1 ring-inset has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-600', a.sex === s ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}>
                <input type="radio" name="sex" value={s} className="sr-only" checked={a.sex === s} onChange={() => set({ sex: s })} />
                {SEX_LABELS[s]}
              </label>
            ))}
          </div>
          {errors.sex && <p role="alert" className="mt-1 text-xs font-medium text-rose-700">{errors.sex}</p>}
        </fieldset>
        <TextInput label="Gender identity (optional)" value={a.genderIdentity} onChange={(v) => set({ genderIdentity: v })} hint="Separate from sex. Leave blank to skip." />
        <TextInput label="Pronouns (optional)" value={a.pronouns} onChange={(v) => set({ pronouns: v })} placeholder="e.g. she/her, they/them" />
      </div>
    </>
  );
}

function ConditionsStep({ draft, setDraft }: StepProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ Neurological: true });
  const [custom, setCustom] = useState('');
  const results = useMemo(() => searchConditions(query), [query]);
  const selected = new Map(draft.conditions.map((c) => [c.id, c]));
  const searching = query.trim().length > 0;

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Your health conditions</h1>
      <p className="mt-1 text-sm text-slate-600">
        Select everything that applies, then mark each as <strong>diagnosed</strong>, <strong>suspected</strong> or a <strong>symptom only</strong>. ConnectHealth never turns a symptom into a diagnosis.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-2.5 left-3 text-slate-400" aria-hidden="true" />
          <label htmlFor="cond-search" className="sr-only">Search conditions</label>
          <input id="cond-search" className={`${inputClass} pl-9`} placeholder="Search conditions (e.g. migraine, asthma)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Badge tone="teal" className="self-start sm:self-auto">{draft.conditions.length} selected</Badge>
      </div>

      <label className={cx('mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm', draft.noKnownConditions ? 'border-teal-300 bg-teal-50' : 'border-slate-200')}>
        <input type="checkbox" className="mt-0.5 accent-teal-700" checked={draft.noKnownConditions} onChange={(e) => setDraft((d) => setNoKnownConditions(d, e.target.checked))} />
        <span>
          <span className="font-medium">No known diagnosed conditions</span>
          <span className="block text-xs text-slate-500">You can still add symptoms or suspected conditions. This clears any “diagnosed” selections.</span>
        </span>
      </label>

      <div className="mt-4 space-y-2">
        {CATEGORIES.map((cat) => {
          const items = results.filter((r) => r.category === cat);
          if (!items.length) return null;
          const isOpen = searching || open[cat];
          const count = items.filter((i) => selected.has(i.id)).length;
          return (
            <div key={cat} className="rounded-lg border border-slate-200">
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}>
                <span>
                  {cat} {count > 0 && <Badge tone="teal" className="ml-1">{count}</Badge>}
                </span>
                <ChevronDown size={16} className={cx('transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                  {items.map((item) => {
                    const on = selected.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft((d) => toggleCondition(d, item.id, item.label))}
                        className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 ring-inset', on ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}
                      >
                        {on && <Check size={14} aria-hidden="true" />} {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {!results.length && <p className="text-sm text-slate-500">No match in the starter list – add it below.</p>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setDraft((d) => addCustomCondition(d, custom));
          setCustom('');
        }}
      >
        <label htmlFor="custom-cond" className="sr-only">Add another condition</label>
        <input id="custom-cond" className={inputClass} placeholder="Add another condition" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <Button type="submit" disabled={!custom.trim()}>
          <Plus size={16} aria-hidden="true" /> Add
        </Button>
      </form>

      {draft.conditions.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-slate-800">Your selections</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {draft.conditions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{c.label}</span>
                <div className="flex items-center gap-2">
                  <label htmlFor={`st-${c.id}`} className="sr-only">Status for {c.label}</label>
                  <select id={`st-${c.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={c.status} onChange={(e) => setDraft((d) => setConditionStatus(d, c.id, e.target.value as ConditionStatus))}>
                    {(['diagnosed', 'suspected', 'symptom'] as ConditionStatus[]).map((s) => (
                      <option key={s} value={s} disabled={s === 'diagnosed' && draft.noKnownConditions}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={`Remove ${c.label}`} onClick={() => setDraft((d) => toggleCondition(d, c.id, c.label))}>
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function AllergiesStep({ draft, setDraft }: StepProps) {
  const [custom, setCustom] = useState('');
  const [category, setCategory] = useState<AllergyCategory>('medication');
  const selected = new Set(draft.allergies.map((a) => a.substance.toLowerCase()));
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Your allergies</h1>
      <p className="mt-1 text-sm text-slate-600">List allergies or intolerances to medications, foods or anything else, with the reaction if you know it. If you are not sure, skip this – leaving it blank is recorded as “not recorded”, not as “no allergies”.</p>

      <label className={cx('mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm', draft.noKnownAllergies ? 'border-teal-300 bg-teal-50' : 'border-slate-200')}>
        <input type="checkbox" className="mt-0.5 accent-teal-700" checked={draft.noKnownAllergies} onChange={(e) => setDraft((d) => setNoKnownAllergies(d, e.target.checked))} />
        <span>
          <span className="font-medium">No known allergies</span>
          <span className="block text-xs text-slate-500">Clears any allergies listed below.</span>
        </span>
      </label>

      <h2 className="mt-5 text-sm font-semibold text-slate-800">Common allergies</h2>
      {(['medication', 'food', 'environmental', 'insect', 'latex'] as AllergyCategory[]).map((cat) => (
        <div key={cat} className="mt-2">
          <p className="text-xs font-medium text-slate-500">{ALLERGY_CATEGORY_LABELS[cat]}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {COMMON_ALLERGENS.filter((a) => a.category === cat).map((a) => {
              const on = selected.has(a.substance.toLowerCase());
              return (
                <button
                  key={a.substance}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft((d) => toggleAllergen(d, a.substance, a.category))}
                  className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 ring-inset', on ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}
                >
                  {on && <Check size={14} aria-hidden="true" />} {a.substance}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setDraft((d) => addAllergy(d, custom, category));
          setCustom('');
        }}
      >
        <label htmlFor="custom-allergy" className="sr-only">Add another allergy</label>
        <input id="custom-allergy" className={`${inputClass} min-w-48 flex-1`} placeholder="Add another allergy (e.g. a specific medication)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <label htmlFor="custom-allergy-cat" className="sr-only">Allergy type</label>
        <select id="custom-allergy-cat" className={`${inputClass} w-auto`} value={category} onChange={(e) => setCategory(e.target.value as AllergyCategory)}>
          {(Object.keys(ALLERGY_CATEGORY_LABELS) as AllergyCategory[]).map((c) => (
            <option key={c} value={c}>
              {ALLERGY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!custom.trim()}>
          <Plus size={16} aria-hidden="true" /> Add allergy
        </Button>
      </form>

      {draft.allergies.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-slate-800">Your allergies ({draft.allergies.length})</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {draft.allergies.map((a) => (
              <li key={a.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[1fr_1.5fr_auto_auto] sm:items-center">
                <span className="font-medium text-slate-800">
                  {a.substance} <span className="text-xs font-normal text-slate-500">· {ALLERGY_CATEGORY_LABELS[a.category]}</span>
                </span>
                <label className="sr-only" htmlFor={`rx-${a.id}`}>Reaction to {a.substance}</label>
                <input id={`rx-${a.id}`} className={`${inputClass} py-1`} placeholder="Reaction (optional), e.g. hives" value={a.reaction} onChange={(e) => setDraft((d) => updateAllergy(d, a.id, { reaction: e.target.value }))} />
                <label className="sr-only" htmlFor={`sev-${a.id}`}>Severity for {a.substance}</label>
                <select id={`sev-${a.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={a.severity} onChange={(e) => setDraft((d) => updateAllergy(d, a.id, { severity: e.target.value as AllergyDraft['severity'] }))}>
                  {(Object.keys(SEVERITY_LABELS) as Array<keyof typeof SEVERITY_LABELS>).map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button type="button" className="justify-self-end rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={`Remove ${a.substance}`} onClick={() => setDraft((d) => ({ ...d, allergies: d.allergies.filter((x) => x.id !== a.id) }))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">If you have had a severe reaction (for example trouble breathing or swelling of the face or throat), make sure your clinicians and pharmacist know.</p>
        </div>
      )}
    </>
  );
}

function GoalsStep({ draft, setDraft }: StepProps) {
  const suggested = suggestedTrackers(draft);
  const toggleGoal = (id: (typeof GOALS)[number]['id']) => setDraft((d) => ({ ...d, goals: d.goals.includes(id) ? d.goals.filter((g) => g !== id) : [...d.goals, id] }));
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Your health goals</h1>
      <p className="mt-1 text-sm text-slate-600">Choose what you want help with. This personalises your dashboard – you can change it later.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {GOALS.map((g) => {
          const on = draft.goals.includes(g.id);
          return (
            <label key={g.id} className={cx('flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm', on ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:bg-slate-50')}>
              <input type="checkbox" className="mt-0.5 accent-teal-700" checked={on} onChange={() => toggleGoal(g.id)} />
              {g.label}
            </label>
          );
        })}
      </div>
      <CheckinPreview draft={draft} />
      <h2 className="mt-6 text-sm font-semibold text-slate-800">Optional tracker</h2>
      <label className={cx('mt-2 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm', draft.trackers.menstrual ? 'border-teal-400 bg-teal-50' : 'border-slate-200')}>
        <input type="checkbox" className="mt-0.5 accent-teal-700" checked={draft.trackers.menstrual} onChange={(e) => setDraft((d) => ({ ...d, trackers: { ...d.trackers, menstrual: e.target.checked } }))} />
        <span>
          Menstrual-cycle tracking
          <span className="block text-xs text-slate-500">{suggested.menstrual ? 'Suggested by a selected reproductive or endocrine condition.' : 'Optional – only if it is relevant to you.'} Adds a daily “menstrual bleeding” question to the check-in.</span>
        </span>
      </label>
    </>
  );
}

/** Shows which questions the daily check-in will include, based on the selected conditions. */
function CheckinPreview({ draft }: { draft: OnboardingDraft }) {
  const plan = planForConditions(draft.conditions.map((c) => c.id));
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <h2 className="font-semibold text-slate-800">Your daily check-in</h2>
      <p className="mt-0.5 text-xs text-slate-500">Everyone is asked about sleep, stress, illness and other symptoms. Extra questions come from your conditions – you can change conditions later in Records.</p>
      {plan.length ? (
        <ul className="mt-2 space-y-1">
          {plan.map((p) => (
            <li key={p.label} className="flex flex-wrap items-center gap-1.5">
              <Check size={14} className="text-teal-700" aria-hidden="true" /> {p.label}
              <span className="text-xs text-slate-500">· for {p.reasons.join(', ')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-600">No condition-specific questions for your selections – just the core check-in.</p>
      )}
    </div>
  );
}

function ReviewStep({ draft, onEdit }: { draft: OnboardingDraft; onEdit: (step: number) => void }) {
  const a = draft.about;
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value || '—'}</dd>
    </div>
  );
  const Section = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <Button size="sm" variant="ghost" onClick={() => onEdit(step)}>
          <Pencil size={13} aria-hidden="true" /> Edit
        </Button>
      </div>
      {children}
    </div>
  );
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Review and enter</h1>
      <p className="mt-1 text-sm text-slate-600">Check your details. Your profile is separate from the synthetic demo patient.</p>
      <div className="mt-4 space-y-3">
        <Section title="About you" step={0}>
          <dl>
            <Row label="Name" value={a.fullName} />
            <Row label="Preferred name" value={a.preferredName} />
            <Row label={a.ageMode === 'age' ? 'Age' : 'Date of birth'} value={a.ageMode === 'age' ? a.age : a.dateOfBirth} />
            <Row label="Sex" value={a.sex ? SEX_LABELS[a.sex] : ''} />
            <Row label="Gender identity" value={a.genderIdentity} />
            <Row label="Pronouns" value={a.pronouns} />
          </dl>
        </Section>
        <Section title="Health conditions" step={1}>
          {draft.noKnownConditions && <p className="mb-2 text-sm text-slate-700">No known diagnosed conditions.</p>}
          {draft.conditions.length ? (
            <ul className="flex flex-wrap gap-2">
              {draft.conditions.map((c) => (
                <li key={c.id}>
                  <Badge tone={c.status === 'diagnosed' ? 'teal' : c.status === 'suspected' ? 'amber' : 'sky'}>
                    {c.label} · {STATUS_LABELS[c.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{draft.conditionsSkipped ? 'Skipped for now – you can add conditions later in Records.' : 'None selected.'}</p>
          )}
        </Section>
        <Section title="Allergies" step={2}>
          {draft.noKnownAllergies ? (
            <p className="text-sm text-slate-700">No known allergies.</p>
          ) : draft.allergies.length ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {draft.allergies.map((a) => (
                <li key={a.id}>
                  {a.substance}
                  {a.reaction && ` – ${a.reaction}`} <span className="text-xs text-slate-500">({SEVERITY_LABELS[a.severity].toLowerCase()})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Not recorded yet – you can add allergies later in Records.</p>
          )}
        </Section>
        <Section title="Goals and trackers" step={3}>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {draft.goals.map((g) => (
              <li key={g}>{GOALS.find((x) => x.id === g)?.label}</li>
            ))}
            {!draft.goals.length && <li className="list-none pl-0 text-slate-500">No goals selected.</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Check-in extras: {planForConditions(draft.conditions.map((c) => c.id)).map((p) => p.label).join(', ') || 'none'} · menstrual tracking {draft.trackers.menstrual ? 'on' : 'off'}
          </p>
        </Section>
      </div>
    </>
  );
}
