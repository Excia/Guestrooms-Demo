import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { useState } from 'react';
import { stayLimits, type RangeValue } from '../../app/dateRange';
import { theme } from '../../theme';
import DateField from './DateField';

const TODAY = '2026-10-20';
const limits = stayLimits(TODAY, 730, 365);

function Single({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ThemeProvider theme={theme}>
      <DateField label="Date" today={TODAY} min={TODAY} value={value} onChange={setValue} />
    </ThemeProvider>
  );
}

function Pair({ initial }: { initial: RangeValue }) {
  const [r, setR] = useState(initial);
  const range = (role: 'from' | 'to') => ({
    role,
    from: r.from,
    to: r.to,
    limits,
    endNames: ['check-in', 'check-out'] as [string, string],
    onChange: setR,
  });
  return (
    <ThemeProvider theme={theme}>
      <DateField
        label="Check In"
        today={TODAY}
        value={r.from}
        range={range('from')}
        onChange={(v) => setR({ ...r, from: v })}
      />
      <DateField
        label="Check Out"
        today={TODAY}
        value={r.to}
        range={range('to')}
        onChange={(v) => setR({ ...r, to: v })}
      />
    </ThemeProvider>
  );
}

const day = (name: RegExp) => screen.getByRole('button', { name });
const input = (name: RegExp) => screen.getByLabelText(name, { selector: 'input' });

describe('DateField calendar', () => {
  it('opens from the keyboard with focus on a day, and arrows and PageDown move it', async () => {
    const user = userEvent.setup();
    render(<Single />);
    screen.getByRole('button', { name: 'Open calendar for date' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(day(/October 20, 2026/)).toHaveFocus());
    await user.keyboard('{ArrowRight}');
    expect(day(/October 21, 2026/)).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    await waitFor(() => expect(day(/November 21, 2026/)).toHaveFocus());
  });

  it('Alt+ArrowDown on the input opens our calendar', async () => {
    const user = userEvent.setup();
    render(<Single />);
    input(/Date/).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('does not select a disabled day; Escape closes and focuses the input', async () => {
    const user = userEvent.setup();
    render(<Single />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for date' }));
    await user.click(day(/October 19, 2026/));
    expect(input(/Date/)).toHaveValue('');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    expect(input(/Date/)).toHaveFocus();
  });

  it('keeps focus on a month button that reaches its limit (aria-disabled, not disabled)', async () => {
    const user = userEvent.setup();
    render(<Single />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for date' }));
    const prev = screen.getByRole('button', { name: 'Previous month' });
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    prev.focus();
    await user.click(prev);
    expect(prev).toHaveFocus();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('a hover preview of the range is not announced as selected', async () => {
    const user = userEvent.setup();
    render(<Pair initial={{ from: '', to: '' }} />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for check in' }));
    await user.click(day(/October 22, 2026/));
    await user.hover(day(/October 26, 2026/));
    expect(day(/October 26, 2026$/).closest('td')).toHaveAttribute('aria-selected', 'false');
    expect(day(/October 24, 2026$/).closest('td')).toHaveAttribute('aria-selected', 'false');
    expect(day(/October 22, 2026, check-in/).closest('td')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('Clear empties the range and Today starts a new one', async () => {
    const user = userEvent.setup();
    render(<Pair initial={{ from: '2026-10-22', to: '2026-10-25' }} />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for check in' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input(/Check In/)).toHaveValue('');
    expect(input(/Check Out/)).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(input(/Check In/)).toHaveValue('2026-10-20');
    expect(input(/Check Out/)).toHaveValue('');
  });

  it('opening from Check Out keeps the check-in; the first click sets only the check-out', async () => {
    const user = userEvent.setup();
    render(<Pair initial={{ from: '2026-10-22', to: '2026-10-25' }} />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for check out' }));
    await user.click(day(/October 28, 2026/));
    expect(input(/Check In/)).toHaveValue('2026-10-22');
    expect(input(/Check Out/)).toHaveValue('2026-10-28');
  });

  it('Escape after the first click leaves the previous complete range untouched', async () => {
    const user = userEvent.setup();
    render(<Pair initial={{ from: '2026-10-22', to: '2026-10-25' }} />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for check in' }));
    await user.click(day(/October 28, 2026/));
    expect(input(/Check In/)).toHaveValue('2026-10-28');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    expect(input(/Check In/)).toHaveValue('2026-10-22');
    expect(input(/Check Out/)).toHaveValue('2026-10-25');
  });

  it('survives an invalid typed year when opening', async () => {
    const user = userEvent.setup();
    render(<Single initial="0000-13-45" />);
    await user.click(screen.getByRole('button', { name: 'Open calendar for date' }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });
});
