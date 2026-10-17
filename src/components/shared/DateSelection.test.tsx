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

  it('single day and compare variants show their extra fields', () => {
    render(<Harness initial={setCompare(createValue('thisWeek', TODAY), true)} />);
    expect(screen.getAllByRole('combobox', { name: /Date Range/ })).toHaveLength(2);
    expect(screen.getByText('Last Week')).toBeInTheDocument();
    expect(screen.getAllByLabelText('From')).toHaveLength(2);
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
      comparison: { kind: 'date', date: '2024-02-12' },
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
    const [, compareFrom] = screen.getAllByLabelText('From');
    expect(compareFrom).toHaveAttribute('readonly');
    const selects = screen.getAllByRole('combobox', { name: /Date Range/ });
    await userEvent.click(selects[1]);
    await userEvent.click(await screen.findByRole('option', { name: 'Custom' }));
    expect(screen.getAllByLabelText('From')[1]).not.toHaveAttribute('readonly');
  });
});
