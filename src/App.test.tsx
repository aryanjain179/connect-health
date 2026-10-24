/** End-to-end style UI tests: welcome, onboarding, data entry, analysis, navigation, sharing and persistence. */
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './store/storage';

function statValue(label: string): string {
  return screen.getByText(label).closest('section')?.textContent ?? '';
}

async function go(route: string) {
  await act(async () => {
    window.location.hash = `#/${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function enterDemo(user: ReturnType<typeof userEvent.setup>) {
  const r = render(<App />);
  await user.click(screen.getByRole('button', { name: 'Explore Demo Patient' }));
  return r;
}

describe('ConnectHealth – demo patient', () => {
  it('opens on the welcome screen, then shows the demo overview from synthetic data', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Your health information, connected.')).toBeInTheDocument();
    expect(screen.getByText(/all preloaded demo patient data is synthetic/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explore Demo Patient' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(statValue('Seizure events')).toContain('15');
    expect(screen.getByText(/Demo mode · Synthetic data only/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Overview', 'Health Timeline', 'Pattern Discovery', 'Clinician Review', 'Clinical Connections', 'Ask My Health Data', 'Voice Journal', 'Care Navigator', 'Care Tasks', 'Clinician Summary', 'Records', 'Settings & Sharing'])
      expect(within(nav).getByText(label)).toBeInTheDocument();
  });

  it('logs a seizure inside the daily check-in, validates, recalculates and persists after a refresh', async () => {
    const user = userEvent.setup();
    const { unmount } = await enterDemo(user);
    expect(screen.queryByRole('button', { name: /Log seizure/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Daily check-in/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Seizures on this day')).toBeInTheDocument();
    expect(within(dialog).getByText(/Shown because of: Epilepsy/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add a seizure' }));
    const date = within(dialog).getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2099-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));
    expect(within(dialog).getByText('Date cannot be in the future.')).toBeInTheDocument();
    await user.clear(date);
    // 2026-10-20 already has a check-in; logging only a seizure for it must not create a duplicate check-in.
    await user.type(date, '2026-10-20');
    await user.type(within(dialog).getByLabelText('Duration (seconds)'), '45');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(statValue('Seizure events')).toContain('16');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).root.profiles.demo.data;
    expect(saved.seizures.some((x: { durationSeconds: number }) => x.durationSeconds === 45)).toBe(true);
    // Only a seizure was logged, so no empty check-in record was created for that day.
    expect(saved.observations).toHaveLength(83);
    unmount();
    render(<App />);
    expect(statValue('Seizure events')).toContain('16');
  });

  it('shows pattern cards with review links and creates a follow-up task', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    await go('patterns');
    expect(screen.getAllByText(/Pattern identified for clinician review/).length).toBeGreaterThan(0);
    const card = screen.getByRole('article', { name: /more seizure days after short sleep/ });
    await user.click(within(card).getByRole('button', { name: /Create follow-up task/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await go('tasks');
    expect(screen.getByText('Discuss at next appointment: Possible pattern: more seizure days after short sleep')).toBeInTheDocument();
  });

  it('recalculates findings when the sleep threshold changes, and switches outcomes', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    await go('patterns');
    await user.selectOptions(screen.getByLabelText('Short sleep is less than'), '5');
    expect(screen.getByRole('article', { name: /Sleep duration: not enough data yet/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Headache days/ }));
    expect(screen.queryByText(/more seizure days/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('article', { name: /headache/i }).length).toBeGreaterThan(0);
  });

  it('Clinician Review lists flags with chart, dates and include toggle; summary reflects exclusion', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    await go('review');
    expect(screen.getByText(/decision-support summary, not a diagnosis/)).toBeInTheDocument();
    const first = screen.getAllByRole('article')[0];
    expect(within(first).getByText(/Pattern identified for clinician review\./)).toBeInTheDocument();
    expect(within(first).getAllByRole('link', { name: /2026/ }).length).toBeGreaterThan(0);
    const toggle = within(first).getByRole('checkbox', { name: /Include this finding/ });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    await go('summary');
    expect(screen.getByText(/1 flag left out of this report by the patient/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print \/ Save as PDF/ })).toBeInTheDocument();
  });

  it('deletes a record from the Records page after confirmation', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    await go('records');
    const rows = screen.getAllByRole('row');
    await user.click(within(rows[1]).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Seizure events (14)')).toBeInTheDocument();
  });
});

describe('ConnectHealth – full user journey', () => {
  it('sign up → conditions → goals → journal → ask → navigator → report → share → revoke', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Create My Health Profile/ }));

    // Step 1 – validation then entry
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText(/Please enter your name/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name *'), 'Sam Rivera');
    await user.type(screen.getByLabelText('Preferred name (optional)'), 'Sam');
    await user.type(screen.getByLabelText('Age in years'), '34');
    await user.click(screen.getByText('Prefer not to say'));
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    // Step 2 – searchable conditions
    await user.type(screen.getByLabelText('Search conditions'), 'epilep');
    await user.click(screen.getByRole('button', { name: 'Epilepsy' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add another condition'), 'Ehlers-Danlos syndrome');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    // Step 3 – allergies (quick-pick + reaction); "no known allergies" is exclusive
    expect(screen.getByRole('heading', { name: 'Your allergies' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Penicillin' }));
    await user.type(screen.getByLabelText('Reaction to Penicillin'), 'hives');
    await user.selectOptions(screen.getByLabelText('Severity for Penicillin'), 'moderate');
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    // Step 3 – goals; the check-in preview follows the selected conditions
    await user.click(screen.getByLabelText('Find the right specialists'));
    expect(screen.getByText('Seizure log')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Seizure \/ event diary/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    // Step 5 – review and create
    expect(screen.getByText('Epilepsy · Diagnosed')).toBeInTheDocument();
    expect(screen.getByText(/Penicillin – hives/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create My Profile/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(screen.getByText(/Start building your record/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Daily check-in/ }));
    expect(within(screen.getByRole('dialog')).getByText('Seizures on this day')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    // Voice journal (typed fallback in jsdom) → review → approve
    await go('journal');
    await user.type(screen.getByLabelText(/Transcript/), 'I slept 5 hours and had a headache after lunch');
    await user.click(screen.getByRole('button', { name: /Review proposed entries/ }));
    for (const b of screen.getAllByRole('button', { name: /Approve/ })) await user.click(b);
    await user.click(screen.getByRole('button', { name: /Add 2 approved entries/ }));
    expect(screen.getByText(/Added 2 approved entries/)).toBeInTheDocument();
    await go('records');
    await user.click(screen.getByRole('tab', { name: 'Daily check-ins' }));
    expect(screen.getByText('Daily check-ins (1)')).toBeInTheDocument();

    // Ask
    await go('ask');
    await user.click(screen.getByRole('button', { name: 'What follow-up tasks have I not completed?' }));
    expect(screen.getByText('All recorded tasks are completed.')).toBeInTheDocument();

    // Navigator → task
    await go('navigator');
    const neuro = screen.getByRole('heading', { name: 'Neurology' }).closest('article')!;
    await user.click(within(neuro).getByRole('button', { name: /Add next step to tasks/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/Outstanding care-coordination tasks \(1\)/)).toBeInTheDocument();

    // Report
    await go('summary');
    expect(screen.getByText(/Penicillin \(medication\) – reaction: hives; severity moderate/)).toBeInTheDocument();
    expect(screen.getByText(/Ehlers-Danlos syndrome – diagnosis reported by the patient/)).toBeInTheDocument();
    expect(screen.queryByText(/SYNTHETIC DEMONSTRATION DATA/)).not.toBeInTheDocument();

    // Share → preview → revoke
    await go('settings');
    await user.type(screen.getByLabelText('Name *'), 'Alex');
    await user.click(screen.getByRole('button', { name: /Add person/ }));
    const person = screen.getByRole('article', { name: /Alex/ });
    expect(within(person).getByRole('button', { name: /Confirm sharing/ })).toBeDisabled();
    await user.click(within(person).getByLabelText(/Sleep and wearable-derived observations/));
    await user.click(within(person).getByRole('button', { name: /Confirm sharing/ }));
    await user.click(within(person).getByRole('link', { name: /Preview shared view/ }));
    await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(screen.getByText(/Shared view for Alex/)).toBeInTheDocument();
    expect(screen.getByText(/Medications: not shared with this person/)).toBeInTheDocument();
    expect(screen.getByText(/Seizure \/ event history: not shared with this person/)).toBeInTheDocument();

    await go('settings');
    await user.click(within(screen.getByRole('article', { name: /Alex/ })).getByRole('button', { name: /Revoke access/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke access' }));
    await go(`shared/${JSON.parse(localStorage.getItem(STORAGE_KEY)!).root.profiles.user.data.sharing[0].id}`);
    expect(screen.getByText('No access')).toBeInTheDocument();

    // The demo patient is untouched.
    await go('settings');
    await user.click(screen.getByRole('button', { name: 'Use demo patient' }));
    await go('overview');
    expect(statValue('Seizure events')).toContain('15');
  });
});

describe('ConnectHealth – menstrual bleeding in the check-in', () => {
  it('asks about bleeding on the day (not "period started") and updates period records', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    await user.click(screen.getByRole('button', { name: /Daily check-in/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/My period started/)).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Menstrual bleeding on this day?'), 'yes');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!).root.profiles.demo.data;
    const today = data.observations.find((o: { measures?: Record<string, unknown> }) => o.measures?.['menstrual-bleeding'] === true);
    expect(today).toBeDefined();
    expect(data.menstrual).toHaveLength(5);
    expect(data.menstrual.some((m: { periodStart: string; periodEnd: string }) => m.periodStart === today.date && m.periodEnd === today.date)).toBe(true);
  });
});

describe('ConnectHealth – condition-driven check-in', () => {
  it('shows only the questions for the selected conditions (no seizure log without epilepsy)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Create My Health Profile/ }));
    await user.type(screen.getByLabelText('Full name *'), 'Jo Lee');
    await user.type(screen.getByLabelText('Age in years'), '52');
    await user.click(screen.getByText('Female'));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.type(screen.getByLabelText('Search conditions'), 'fibro');
    await user.click(screen.getByRole('button', { name: 'Fibromyalgia' }));
    await user.clear(screen.getByLabelText('Search conditions'));
    await user.type(screen.getByLabelText('Search conditions'), 'hypert');
    await user.click(screen.getByRole('button', { name: 'Hypertension' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByLabelText(/No known allergies/));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.queryByText('Seizure log')).not.toBeInTheDocument();
    expect(screen.getByText('Pain level (0–10)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: /Create My Profile/ }));

    await user.click(screen.getByRole('button', { name: /Daily check-in/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Seizures on this day')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Headache')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Pain level (0–10)'), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));
    expect(within(dialog).getByText('Must be between 0 and 10.')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Pain level (0–10)'));
    await user.type(within(dialog).getByLabelText('Pain level (0–10)'), '6');
    await user.type(within(dialog).getByLabelText(/systolic/), '138');
    await user.selectOptions(within(dialog).getByLabelText('Fatigue'), 'yes');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));
    const userData = JSON.parse(localStorage.getItem(STORAGE_KEY)!).root.profiles.user.data;
    expect(userData.profile.noKnownAllergies).toBe(true);
    const obs = userData.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].measures).toEqual({ 'pain-level': 6, 'bp-systolic': 138, fatigue: true });

    // "Show all questions" reveals optional questions for other conditions.
    await user.click(screen.getByRole('button', { name: /Daily check-in/ }));
    const again = screen.getByRole('dialog');
    expect(within(again).getByLabelText('Pain level (0–10)')).toHaveValue(6);
    await user.click(within(again).getByLabelText(/Show all optional questions/));
    expect(within(again).getByLabelText('Headache')).toBeInTheDocument();
    expect(within(again).queryByText('Seizures on this day')).not.toBeInTheDocument();
  });
});

describe('ConnectHealth – allergies and dated cycle timeline', () => {
  it('shows allergies on the overview, warns on a matching medication name, and dates cycle events', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    expect(screen.getByText('Tree pollen')).toBeInTheDocument();
    // Period starts are labelled with their dates and listed with cycle day and phase.
    expect(screen.getByText('▼ Aug 11')).toBeInTheDocument();
    await user.click(screen.getByText(/Dated list of period starts/));
    const list = screen.getByRole('table');
    expect(within(list).getByRole('link', { name: 'Tue Aug 11, 2026' })).toBeInTheDocument();
    expect(within(list).getAllByText('Period started').length).toBeGreaterThan(0);
    // Hover detail line names the exact date.
    await user.hover(screen.getAllByRole('button', { name: /Sun, Aug 9, 2026 · cycle day 27/ })[0]);
    expect(screen.getAllByText(/Sun, Aug 9, 2026 · cycle day 27 · Perimenstrual/).length).toBeGreaterThan(0);

    // Medication form warns on a name match with a recorded medication allergy.
    await go('records');
    await user.click(screen.getByRole('tab', { name: 'Medications' }));
    await user.click(screen.getByRole('button', { name: /Add medication/ }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Medication name'), 'Lamotrigine');
    expect(within(screen.getByRole('dialog')).getByText(/You have recorded an allergy that may relate to this medication: Lamotrigine/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    // Allergies tab: add, with duplicate validation.
    await user.click(screen.getByRole('tab', { name: 'Allergies' }));
    await user.click(screen.getByRole('button', { name: /Add allergy/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Allergic to'), 'tree pollen');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText(/already recorded/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Allergic to'));
    await user.type(within(dialog).getByLabelText('Allergic to'), 'Shellfish');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'food');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Allergies (3)')).toBeInTheDocument();
  });
});

describe('ConnectHealth – recording today is prominent', () => {
  it('shows a Today prompt with voice and form options, and updates once checked in', async () => {
    const user = userEvent.setup();
    await enterDemo(user);
    const today = screen.getByRole('region', { name: /How are you today, Maya\?/ });
    expect(within(today).getByRole('link', { name: /Speak about my day/ })).toHaveAttribute('href', '#/journal');
    expect(within(today).getByText(/seizures/)).toBeInTheDocument(); // check-in topics follow the conditions
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Not done yet')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Record today' })).toBeInTheDocument(); // phone bar

    await user.click(within(today).getByRole('button', { name: /Start today’s check-in/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: /Prefer to talk\? Use the voice journal/ })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Sleep (hours, night before)'), '7');
    await user.click(within(dialog).getByRole('button', { name: 'Save check-in' }));

    expect(screen.getByRole('region', { name: /You’ve checked in today/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Edit today’s check-in/ }).length).toBeGreaterThanOrEqual(2); // card + sidebar
    expect(within(nav).getByText('Done')).toBeInTheDocument();
  });
});
