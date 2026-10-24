/** End-to-end style UI tests: render, enter data, recalculate, persist across a remount (page refresh). */
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './store/storage';

function statValue(label: string): string {
  const card = screen.getByText(label).closest('section');
  return card?.textContent ?? '';
}

async function go(route: string) {
  await act(async () => {
    window.location.hash = `#/${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('HealthConnect app', () => {
  it('renders the overview with values calculated from the synthetic dataset', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(statValue('Seizure events')).toContain('15');
    expect(statValue('Seizure events')).toContain('on 13 days');
    expect(screen.getByText(/Synthetic data only/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Overview', 'Health Timeline', 'Pattern Discovery', 'Clinical Connections', 'Clinician Summary', 'Care Tasks', 'Records'])
      expect(within(nav).getByText(label)).toBeInTheDocument();
  });

  it('validates input, saves a new seizure, recalculates and persists after a refresh', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: /Log seizure/ }));
    const dialog = screen.getByRole('dialog');

    const date = within(dialog).getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2099-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Date cannot be in the future.')).toBeInTheDocument();

    await user.clear(date);
    await user.type(date, '2026-10-20');
    await user.type(within(dialog).getByLabelText('Duration (seconds)'), '45');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(statValue('Seizure events')).toContain('16');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"durationSeconds":45');

    unmount();
    render(<App />);
    expect(statValue('Seizure events')).toContain('16');
  });

  it('shows pattern cards and creates a follow-up task from an insight', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('patterns');
    const card = screen.getByRole('article', { name: /more seizure days after short sleep/ });
    await user.click(within(card).getByRole('button', { name: /Create follow-up task/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Discuss at next appointment: Possible pattern: more seizure days after short sleep');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await go('tasks');
    expect(screen.getByText('Discuss at next appointment: Possible pattern: more seizure days after short sleep')).toBeInTheDocument();
    expect(screen.getByText(/From insight: Possible pattern: more seizure days after short sleep/)).toBeInTheDocument();
  });

  it('recalculates findings when the sleep threshold changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('patterns');
    await user.selectOptions(screen.getByLabelText('Short sleep is less than'), '5');
    // Only 4 nights are < 5 h → the short-sleep group is too small and the finding is suppressed.
    expect(screen.getByRole('article', { name: /Sleep duration: not enough data yet/ })).toBeInTheDocument();
  });

  it('deletes a record from the Records page after confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('records');
    const rows = screen.getAllByRole('row');
    const firstData = rows[1];
    await user.click(within(firstData).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Seizure events (14)')).toBeInTheDocument();
  });

  it('generates the clinician summary from current data', async () => {
    render(<App />);
    await go('summary');
    expect(screen.getByText(/15 seizure events on 13 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download .md/ })).toBeInTheDocument();
  });
});
