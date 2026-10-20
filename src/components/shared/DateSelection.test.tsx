import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  createValue,
  dateSelectionState,
  setCompare,
  type DateSelectionState,
  type DateSelectionValue,
  type PeriodKind,
} from '../../app/dateSelection';
import DateSelection from './DateSelection';

const TODAY = '2025-02-12';

// Fields are found by their accessible name (aria-label wins over the visible <label>); the
// period's own fields have no aria-label, so they are the ones without one.
const named = (name: string) => screen.getByLabelText(name, { selector: `[aria-label="${name}"]` });
const visible = (label: string) =>
  screen.getAllByLabelText(label).find((el) => !el.hasAttribute('aria-label')) as HTMLElement;

function Harness({
  initial,
  onValue,
}: {
  initial: DateSelectionValue;
  onValue?: (v: DateSelectionValue) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateSelection
      value={value}
      today={TODAY}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

const CASES: Array<[DateSelectionState, PeriodKind, boolean, string[]]> = [
  ['Custom', 'custom', false, ['Date Range', 'From', 'To']],
  ['Single Day', 'singleDay', false, ['Date Range', 'Date']],
  ['This Week', 'thisWeek', false, ['Date Range', 'From', 'To']],
  ['Month', 'month', false, ['Date Range', 'Month']],
  ['As Of', 'asOf', false, ['Date Range', 'As of Date']],
  ['Compare', 'thisWeek', true, ['Date Range', 'From', 'To']],
  ['Compare-Month', 'month', true, ['Date Range', 'Month']],
  ['Compare-AsOf', 'asOf', true, ['Date Range', 'As of Date']],
];

describe('DateSelection', () => {
  it.each(CASES)('renders the %s state', (state, kind, compare, labels) => {
    const base = createValue(kind, TODAY);
    const value = compare ? setCompare(base, true) : base;
    expect(dateSelectionState(value)).toBe(state);
    render(<Harness initial={value} />);
    for (const label of labels) {
      expect(screen.getAllByLabelText(label, { exact: false }).length).toBeGreaterThan(0);
    }
    const group = screen.getByRole('group', { name: 'Date selection' });
    expect(within(group).getByRole('switch', { name: 'Compare Dates' })).toHaveProperty(
      'checked',
      compare,
    );
    expect(Boolean(within(group).queryByText('Compare to:'))).toBe(compare);
  });

  it('comparison controls have names distinct from the period controls', () => {
    render(<Harness initial={setCompare(createValue('thisWeek', TODAY), true)} />);
    expect(screen.getByRole('combobox', { name: /^Date Range/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Compare to date range' })).toHaveTextContent(
      'Last Week',
    );
    expect(visible('From')).toHaveValue('2025-02-09');
    expect(named('Compare to from')).toHaveValue('2025-02-02');
    expect(named('Compare to to')).toHaveValue('2025-02-08');
  });

  it('names the other comparison controls', () => {
    const { unmount } = render(<Harness initial={setCompare(createValue('month', TODAY), true)} />);
    expect(screen.getByRole('combobox', { name: 'Compare to month' })).toHaveTextContent(
      'February 2024',
    );
    unmount();
    const asOf = render(<Harness initial={setCompare(createValue('asOf', TODAY), true)} />);
    expect(named('Compare to as of date')).toHaveValue('2024-02-12');
    asOf.unmount();
    render(<Harness initial={setCompare(createValue('singleDay', TODAY), true)} />);
    expect(named('Compare to date')).toHaveValue('2025-02-11');
  });

  it('derived (read-only) dates stay out of the tab order but keep their names', () => {
    render(<Harness initial={setCompare(createValue('thisWeek', TODAY), true)} />);
    for (const name of ['From', 'To', 'Compare to from', 'Compare to to']) {
      expect(name.startsWith('Compare') ? named(name) : visible(name)).toHaveAttribute(
        'tabindex',
        '-1',
      );
    }
  });

  it('a derived comparison follows the period when it is edited', async () => {
    const onValue = vi.fn();
    render(
      <Harness initial={setCompare(createValue('singleDay', TODAY), true)} onValue={onValue} />,
    );
    const date = visible('Date');
    await userEvent.clear(date);
    await userEvent.type(date, '2025-03-01');
    expect(onValue).toHaveBeenLastCalledWith({
      period: { kind: 'singleDay', date: '2025-03-01' },
      comparison: { kind: 'date', date: '2025-02-28', derived: true },
    });
  });

  it('this week dates are read-only', () => {
    render(<Harness initial={createValue('thisWeek', TODAY)} />);
    expect(screen.getByLabelText('From')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('From')).toHaveValue('2025-02-09');
  });

  it('changes the period type with the keyboard and reports a typed value', async () => {
    const onValue = vi.fn();
    render(<Harness initial={createValue('custom', TODAY)} onValue={onValue} />);
    screen.getByRole('combobox', { name: /Date Range/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await screen.findByRole('option', { name: 'Month' }));
    expect(onValue).toHaveBeenLastCalledWith({
      period: { kind: 'month', month: '2025-02' },
      comparison: null,
    });
    expect(screen.getByRole('combobox', { name: /Month/ })).toHaveTextContent('February 2025');
  });

  it('toggles Compare Dates with the keyboard', async () => {
    const onValue = vi.fn();
    render(<Harness initial={createValue('asOf', TODAY)} onValue={onValue} />);
    screen.getByRole('switch', { name: 'Compare Dates' }).focus();
    await userEvent.keyboard(' ');
    expect(onValue).toHaveBeenLastCalledWith({
      period: { kind: 'asOf', date: TODAY },
      comparison: { kind: 'date', date: '2024-02-12', derived: true },
    });
    expect(screen.getByText('Compare to:')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(screen.queryByText('Compare to:')).not.toBeInTheDocument();
  });

  it('typing a date updates the value; an inverted range shows an error', async () => {
    const onValue = vi.fn();
    render(<Harness initial={createValue('custom', TODAY)} onValue={onValue} />);
    const from = screen.getByLabelText('From');
    await userEvent.clear(from);
    await userEvent.type(from, '2025-03-01');
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: { kind: 'custom', from: '2025-03-01', to: TODAY } }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('From must be on or before To.');
    expect(from).toBeInvalid();
  });

  it('the compare range switches to custom and becomes editable', async () => {
    render(<Harness initial={setCompare(createValue('thisWeek', TODAY), true)} />);
    expect(named('Compare to from')).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('combobox', { name: 'Compare to date range' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Custom' }));
    expect(named('Compare to from')).not.toHaveAttribute('readonly');
  });

  it('picks a custom range on one calendar and commits only a complete range', async () => {
    const onValue = vi.fn();
    render(<Harness initial={createValue('custom', TODAY, 0)} onValue={onValue} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar for from' }));
    await userEvent.click(screen.getByRole('button', { name: /February 3, 2025/ }));
    expect(onValue).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /February 9, 2025/ }));
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: { kind: 'custom', from: '2025-02-03', to: '2025-02-09' } }),
    );
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
