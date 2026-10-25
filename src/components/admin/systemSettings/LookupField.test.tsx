import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { LookupRef } from '../../../api/types';
import LookupField, { SEARCH_DEBOUNCE_MS } from './LookupField';

interface Call {
  query: string;
  signal: AbortSignal;
  resolve: (records: LookupRef[]) => void;
  reject: () => void;
}

// A search whose answers the test controls.
function controlledSearch() {
  const calls: Call[] = [];
  const search = (query: string, signal: AbortSignal) =>
    new Promise<LookupRef[]>((resolve, reject) => {
      calls.push({ query, signal, resolve, reject: () => reject(new Error('down')) });
    });
  return { calls, search };
}

const club: LookupRef = { id: 'h1', label: 'Club House Account' };
const clue: LookupRef = { id: 'h2', label: 'Clue Account' };

function Harness({
  search,
  disabled,
}: {
  search: Call extends never ? never : (q: string, s: AbortSignal) => Promise<LookupRef[]>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<LookupRef | null>(null);
  return (
    <LookupField
      id="x"
      label="House Account"
      placeholder="House Account Name"
      noOptionsText="No house accounts found"
      value={value}
      onChange={setValue}
      search={search}
      disabled={disabled}
    />
  );
}

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
// userEvent waits on a real timer after each action, which never fires under fake timers, so the
// async tests drive the field with fireEvent.
const input = () => screen.getByRole('combobox');
const openList = () => {
  fireEvent.mouseDown(input());
  fireEvent.click(input());
};
const typeText = (text: string) => fireEvent.change(input(), { target: { value: text } });

describe('LookupField (async)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for a pause in typing, then asks once with the typed text', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    await flush();
    expect(calls.map((c) => c.query)).toEqual(['']);
    typeText('clu');
    await flush(SEARCH_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(1);
    await flush(1);
    expect(calls.map((c) => c.query)).toEqual(['', 'clu']);
  });

  it('shows Searching, not "no results", until the first answer arrives', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    await flush();
    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.queryByText('No house accounts found')).not.toBeInTheDocument();
    await act(async () => calls[0].resolve([]));
    expect(screen.getByText('No house accounts found')).toBeInTheDocument();
  });

  it('hides the old options as soon as the text changes and announces the count', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    await flush();
    await act(async () => calls[0].resolve([club, clue]));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('2 results available')).toBeInTheDocument();
    typeText('c');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('ignores an older answer that arrives after a newer one', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    typeText('clu');
    await flush(SEARCH_DEBOUNCE_MS);
    typeText('clue');
    await flush(SEARCH_DEBOUNCE_MS);
    const older = calls.find((c) => c.query === 'clu')!;
    const newer = calls.find((c) => c.query === 'clue')!;
    expect(older.signal.aborted).toBe(true);
    await act(async () => newer.resolve([clue]));
    await act(async () => older.resolve([club]));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([clue.label]);
  });

  it('clears the options and shows an alert when a later search fails', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    typeText('clu');
    await flush(SEARCH_DEBOUNCE_MS);
    await act(async () => calls.find((c) => c.query === 'clu')!.resolve([club, clue]));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    typeText('clue');
    await flush(SEARCH_DEBOUNCE_MS);
    await act(async () => calls.find((c) => c.query === 'clue')!.reject());
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed. Try again.');
  });

  it('aborts the request when the field goes away or the list closes, and ignores its answer', async () => {
    const { calls, search } = controlledSearch();
    const { unmount } = render(<Harness search={search} />);
    openList();
    await flush();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => calls[0].resolve([club]));
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    openList();
    await flush();
    unmount();
    expect(calls[1].signal.aborted).toBe(true);
  });

  it('keeps the chosen record when a request that was started before is still open', async () => {
    const { calls, search } = controlledSearch();
    render(<Harness search={search} />);
    openList();
    await flush();
    await act(async () => calls[0].resolve([club, clue]));
    fireEvent.click(screen.getByRole('option', { name: club.label }));
    expect(screen.getByRole('combobox')).toHaveValue(club.label);
    await act(async () => calls[0].resolve([clue]));
    expect(screen.getByRole('combobox')).toHaveValue(club.label);
    // Reopening lists everything again, not only the record shown in the field.
    fireEvent.click(screen.getByRole('button', { name: 'Search House Account' }));
    await flush();
    expect(calls.at(-1)!.query).toBe('');
  });

  it('has a green, labelled search button that is disabled with the field', () => {
    const { search } = controlledSearch();
    render(<Harness search={search} disabled />);
    expect(screen.getByRole('button', { name: 'Search House Account' })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

describe('LookupField (fixed list)', () => {
  it('filters the given options and has the same search button', async () => {
    const user = userEvent.setup();
    render(
      <LookupField
        id="y"
        label="Area"
        value={null}
        onChange={() => {}}
        options={[
          { id: 'a', label: 'Hotel' },
          { id: 'b', label: 'Pool' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Search Area' })).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Area' }), 'poo');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Pool']);
    expect(screen.queryByText(/results available/)).not.toBeInTheDocument();
  });
});
