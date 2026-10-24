import { useState } from 'react';
import { Eye, Lock, Plus, ShieldOff, Trash2, UserPlus, Users } from 'lucide-react';
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Notice, PageHeader, cx, inputClass } from '../components/ui';
import { TextInput } from '../components/forms/fields';
import { useHealthData } from '../store/HealthDataContext';
import { GOALS, SPECIALTY_LABELS, type SpecialtyId } from '../conditions/catalog';
import { SEX_LABELS, type CareTeamMember, type GoalId, type SharedPerson, type Sex } from '../models/types';
import { PERMISSIONS, allPermissions, noPermissions } from '../sharing/permissions';
import { newId } from '../store/reducer';
import { checkinPlan } from '../conditions/checkin';
import { localToday } from '../analysis/dates';

export function SettingsPage() {
  const { state, dispatch, root, rootDispatch, isDemo } = useHealthData();
  const p = state.data.profile;
  const [draft, setDraft] = useState({ displayName: p.displayName, preferredName: p.preferredName ?? '', age: String(p.age), sex: p.sex, genderIdentity: p.genderIdentity ?? '', pronouns: p.pronouns ?? '' });
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!draft.displayName.trim()) err.displayName = 'Name is required.';
    const age = Number(draft.age);
    if (!Number.isInteger(age) || age < 0 || age > 120) err.age = 'Enter a whole number between 0 and 120.';
    setErrors(err);
    if (Object.keys(err).length) return;
    dispatch({ type: 'updateProfile', profile: { displayName: draft.displayName.trim(), preferredName: draft.preferredName.trim() || undefined, age, sex: draft.sex, genderIdentity: draft.genderIdentity.trim() || undefined, pronouns: draft.pronouns.trim() || undefined } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const goals = p.goals ?? [];
  const toggleGoal = (g: GoalId) => dispatch({ type: 'updateProfile', profile: { goals: goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g] } });
  const trackers = p.trackers ?? { seizures: false, menstrual: false };
  const plan = checkinPlan(state.data);

  return (
    <>
      <PageHeader title="Settings & Sharing" description={isDemo ? 'You are viewing the synthetic demo patient. Changes apply to the demo profile only.' : 'Manage your local profile, trackers, care team and who can see what.'} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Stored only in this browser.">Profile</CardTitle>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2" noValidate>
            <TextInput label="Full name" value={draft.displayName} onChange={(v) => setDraft({ ...draft, displayName: v })} error={errors.displayName} />
            <TextInput label="Preferred name" value={draft.preferredName} onChange={(v) => setDraft({ ...draft, preferredName: v })} />
            <TextInput label="Age" type="number" value={draft.age} onChange={(v) => setDraft({ ...draft, age: v })} error={errors.age} />
            <div>
              <label htmlFor="set-sex" className="text-sm font-medium text-slate-700">Sex</label>
              <select id="set-sex" className={inputClass} value={draft.sex} onChange={(e) => setDraft({ ...draft, sex: e.target.value as Sex })}>
                {(Object.keys(SEX_LABELS) as Sex[]).map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <TextInput label="Gender identity (optional)" value={draft.genderIdentity} onChange={(v) => setDraft({ ...draft, genderIdentity: v })} />
            <TextInput label="Pronouns (optional)" value={draft.pronouns} onChange={(v) => setDraft({ ...draft, pronouns: v })} />
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" variant="primary">Save profile</Button>
              {saved && <span role="status" className="text-sm text-teal-800">Saved.</span>}
              <a href="#/records" className="text-sm text-teal-800 underline">Edit conditions & history in Records</a>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle sub="Extra check-in questions follow your conditions. Change conditions in Records → Symptoms & history.">Daily check-in and goals</CardTitle>
          <ul className="space-y-1 text-sm">
            {[plan.seizures, ...plan.builtin, ...plan.measures].filter(Boolean).map((item) => (
              <li key={item!.key} className="flex flex-wrap items-center gap-1.5">
                <Badge tone="teal">{item!.label}</Badge>
                <span className="text-xs text-slate-500">for {item!.reasons.join(', ')}</span>
              </li>
            ))}
            {!plan.seizures && !plan.builtin.length && !plan.measures.length && <li className="text-slate-500">Core questions only (sleep, stress, illness, other symptoms).</li>}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-teal-700" checked={trackers.menstrual} onChange={(e) => dispatch({ type: 'updateProfile', profile: { trackers: { ...trackers, menstrual: e.target.checked } } })} />
            Menstrual-cycle tracking (adds a daily “menstrual bleeding” question to the check-in)
          </label>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-800">Goals</h3>
          <div className="grid gap-1.5">
            {GOALS.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-teal-700" checked={goals.includes(g.id)} onChange={() => toggleGoal(g.id)} />
                {g.label}
              </label>
            ))}
          </div>
        </Card>
      </div>

      <CareTeam members={p.careTeam ?? []} onChange={(careTeam) => dispatch({ type: 'updateProfile', profile: { careTeam } })} />

      <Sharing />

      <Card className="mt-6">
        <CardTitle icon={<Users size={18} />}>Profiles on this device</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => rootDispatch({ type: 'switchProfile', slot: 'demo' })} disabled={isDemo}>
            Use demo patient
          </Button>
          {root.profiles.user ? (
            <Button onClick={() => rootDispatch({ type: 'switchProfile', slot: 'user' })} disabled={!isDemo}>
              Use my profile
            </Button>
          ) : (
            <a href="#/onboarding" className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
              Create my profile
            </a>
          )}
          {root.profiles.user && (
            <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" /> Delete my profile from this device
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete your profile?"
        message="This permanently removes your profile and all of its records from this browser. The demo patient is not affected. Export your data from Records first if you want a copy."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          rootDispatch({ type: 'deleteUserProfile' });
          setConfirmDelete(false);
          globalThis.location.hash = isDemo ? '#/settings' : '#/welcome';
        }}
      />
    </>
  );
}

function CareTeam({ members, onChange }: { members: CareTeamMember[]; onChange: (m: CareTeamMember[]) => void }) {
  const [specialty, setSpecialty] = useState<SpecialtyId>('primary-care');
  const [name, setName] = useState('');
  return (
    <Card className="mt-6">
      <CardTitle sub="Used by the Care Navigator to suggest who to ask first. Never contacted by ConnectHealth.">Care team</CardTitle>
      <ul className="divide-y divide-slate-100 text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2">
            <span>
              <span className="font-medium">{m.name}</span> <Badge>{SPECIALTY_LABELS[m.specialty as SpecialtyId] ?? m.specialty}</Badge>
            </span>
            <button type="button" aria-label={`Remove ${m.name}`} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => onChange(members.filter((x) => x.id !== m.id))}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {!members.length && <li className="py-2 text-slate-500">No care team recorded.</li>}
      </ul>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onChange([...members, { id: newId('ct'), specialty, name: name.trim(), notes: '' }]);
          setName('');
        }}
      >
        <label htmlFor="ct-spec" className="sr-only">Specialty</label>
        <select id="ct-spec" className={`${inputClass} w-auto`} value={specialty} onChange={(e) => setSpecialty(e.target.value as SpecialtyId)}>
          {Object.entries(SPECIALTY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label htmlFor="ct-name" className="sr-only">Clinician or practice name</label>
        <input id="ct-name" className={`${inputClass} w-auto flex-1`} placeholder="Clinician or practice name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim()}>
          <Plus size={14} aria-hidden="true" /> Add
        </Button>
      </form>
    </Card>
  );
}

function Sharing() {
  const { state, dispatch, isDemo } = useHealthData();
  const people = state.data.sharing;
  const [form, setForm] = useState({ name: '', relationship: '', contact: '', role: 'caregiver' as SharedPerson['role'] });
  const [error, setError] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<SharedPerson | null>(null);
  const save = (p: SharedPerson) => dispatch({ type: 'upsert', collection: 'sharing', record: p });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Enter a name.');
      return;
    }
    if (form.contact && !/^\S+@\S+\.\S+$/.test(form.contact) && !/^[+\d][\d\s()-]{6,}$/.test(form.contact)) {
      setError('Contact should be an email address or phone number (or leave it blank).');
      return;
    }
    save({ id: newId('share'), name: form.name.trim(), relationship: form.relationship.trim(), contact: form.contact.trim(), role: form.role, status: 'pending', permissions: noPermissions(), createdOn: localToday(), confirmedOn: null, revokedOn: null });
    setForm({ name: '', relationship: '', contact: '', role: 'caregiver' });
    setError(null);
  };

  return (
    <Card className="mt-6" aria-labelledby="sharing-h">
      <CardTitle id="sharing-h" icon={<Users size={18} />} sub="Choose exactly what each person could see. Sharing is off until you select permissions and confirm.">
        People & Data Sharing
      </CardTitle>
      <Notice tone="amber" icon={<Lock size={16} />}>
        Local prototype only: no invitation is sent and nobody gains remote access. Real sharing needs authentication, secure servers and encrypted storage, which this prototype does not have. Browser storage is not secure storage for health information. Use “Preview shared view” to see exactly what a person would be able to access.
      </Notice>

      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-5" noValidate>
        <div>
          <label htmlFor="sh-name" className="text-xs font-medium text-slate-600">Name *</label>
          <input id="sh-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="sh-rel" className="text-xs font-medium text-slate-600">Relationship</label>
          <input id="sh-rel" className={inputClass} placeholder="e.g. partner, parent" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
        </div>
        <div>
          <label htmlFor="sh-contact" className="text-xs font-medium text-slate-600">Email or phone {isDemo ? '(optional in demo)' : '(optional)'}</label>
          <input id="sh-contact" className={inputClass} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </div>
        <div>
          <label htmlFor="sh-role" className="text-xs font-medium text-slate-600">Role</label>
          <select id="sh-role" className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SharedPerson['role'] })}>
            <option value="caregiver">Caregiver</option>
            <option value="family-member">Family member</option>
            <option value="support-person">Support person</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" className="w-full">
            <UserPlus size={14} aria-hidden="true" /> Add person
          </Button>
        </div>
        {error && <p role="alert" className="text-xs text-rose-700 sm:col-span-5">{error}</p>}
      </form>

      <div className="mt-5 space-y-4">
        {people.map((person) => {
          const count = Object.values(person.permissions).filter(Boolean).length;
          const setPerm = (perms: SharedPerson['permissions']) => save({ ...person, permissions: perms, status: person.status === 'revoked' ? 'revoked' : person.status });
          return (
            <article key={person.id} className={cx('rounded-xl border p-4', person.status === 'revoked' ? 'border-slate-200 bg-slate-50' : 'border-slate-200')} aria-labelledby={`p-${person.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 id={`p-${person.id}`} className="font-semibold text-slate-900">
                    {person.name} <span className="text-sm font-normal text-slate-500">{person.relationship && `· ${person.relationship}`} · {person.role.replace('-', ' ')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {person.contact || 'No contact details'} · added {person.createdOn}
                    {person.confirmedOn && ` · confirmed ${person.confirmedOn}`}
                    {person.revokedOn && ` · revoked ${person.revokedOn}`}
                  </p>
                </div>
                <Badge tone={person.status === 'active' ? 'teal' : person.status === 'pending' ? 'amber' : 'slate'}>
                  {person.status === 'active' ? 'Active (demo – local only)' : person.status === 'pending' ? 'Pending – not confirmed' : 'Revoked'}
                </Badge>
              </div>
              {person.status !== 'revoked' && (
                <fieldset className="mt-3">
                  <legend className="flex w-full items-center justify-between text-xs font-semibold text-slate-700">
                    <span>What {person.name} could access ({count} of {PERMISSIONS.length})</span>
                    <span className="flex gap-2 font-normal">
                      <button type="button" className="text-teal-800 underline" onClick={() => setPerm(allPermissions())}>Select all</button>
                      <button type="button" className="text-slate-600 underline" onClick={() => setPerm(noPermissions())}>Clear</button>
                    </span>
                  </legend>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {PERMISSIONS.map((perm) => (
                      <label key={perm.key} className={cx('flex items-start gap-2 rounded-lg border p-2 text-sm', person.permissions[perm.key] ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200')}>
                        <input type="checkbox" className="mt-0.5 accent-teal-700" checked={person.permissions[perm.key]} onChange={(e) => setPerm({ ...person.permissions, [perm.key]: e.target.checked })} />
                        <span>
                          <span className="font-medium text-slate-800">{perm.label}</span>
                          <span className="block text-xs text-slate-500">{perm.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {person.status === 'pending' && (
                  <Button variant="primary" size="sm" disabled={!count} onClick={() => save({ ...person, status: 'active', confirmedOn: localToday() })}>
                    Confirm sharing (local demo)
                  </Button>
                )}
                {person.status === 'revoked' && (
                  <Button size="sm" onClick={() => save({ ...person, status: 'pending', revokedOn: null, permissions: noPermissions() })}>
                    Set up sharing again
                  </Button>
                )}
                <a href={`#/shared/${person.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
                  <Eye size={13} aria-hidden="true" /> Preview shared view
                </a>
                {person.status !== 'revoked' && (
                  <Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setRevoke(person)}>
                    <ShieldOff size={13} aria-hidden="true" /> Revoke access
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'delete', collection: 'sharing', id: person.id })}>
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </Button>
              </div>
              {person.status === 'pending' && !count && <p className="mt-2 text-xs text-slate-500">Select at least one permission to confirm. Until then, {person.name} has no access.</p>}
            </article>
          );
        })}
        {!people.length && <EmptyState>No one added. Sharing is off.</EmptyState>}
      </div>
      <ConfirmDialog
        open={!!revoke}
        title={`Revoke access for ${revoke?.name ?? ''}?`}
        message="Their access in this prototype ends immediately and all permissions are cleared. (In a real product, data they had already viewed or downloaded could not be recalled.)"
        confirmLabel="Revoke access"
        onCancel={() => setRevoke(null)}
        onConfirm={() => {
          if (revoke) save({ ...revoke, status: 'revoked', revokedOn: localToday(), permissions: noPermissions() });
          setRevoke(null);
        }}
      />
    </Card>
  );
}
