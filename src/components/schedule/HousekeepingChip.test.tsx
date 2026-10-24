import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { useState } from 'react';
import type { ScheduleBlock } from '../../api';
import { housekeepingChip, type HousekeepingPatch } from '../../app/scheduleGrid';
import { theme } from '../../theme';
import HousekeepingChip from './HousekeepingChip';

const base: ScheduleBlock = {
  kind: 'reservation',
  id: 'rr-1',
  reservationId: 'res-1',
  confirmationNumber: 'C-1',
  guestName: 'Ada Lovelace',
  guestType: 'guest',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  status: 'checked-out',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  housekeeping: 'needs-cleaning',
};

interface Seen {
  down: () => void;
  click: () => void;
  key: () => void;
}

/** A parent that counts the events the schedule grid listens to. */
function Harness({
  initial = base,
  days = 7,
  onSave,
  readOnly = false,
  seen,
}: {
  initial?: ScheduleBlock;
  days?: number;
  onSave?: (patch: HousekeepingPatch) => Promise<boolean>;
  readOnly?: boolean;
  seen: Seen;
}) {
  const [block, setBlock] = useState(initial);
  const chip = housekeepingChip(
    block.housekeeping,
    { continuesAfter: false },
    days,
    Boolean(block.housekeepingNotes),
  )!;
  return (
    <ThemeProvider theme={theme}>
      <div
        onPointerDown={() => seen.down()}
        onClick={() => seen.click()}
        onKeyDown={() => seen.key()}
      >
        <HousekeepingChip
          block={block}
          chip={chip}
          fill="gray"
          onSave={
            readOnly
              ? undefined
              : async (b, patch) => {
                  const ok = (await onSave?.(patch)) ?? true;
                  if (ok) {
                    setBlock({
                      ...b,
                      housekeeping: patch.status,
                      ...(patch.notes === undefined
                        ? {}
                        : { housekeepingNotes: patch.notes || undefined }),
                    });
                  }
                  return ok;
                }
          }
        />
      </div>
    </ThemeProvider>
  );
}

const seenNone = (): Seen => ({ down: vi.fn(), click: vi.fn(), key: vi.fn() });
const noneSeen = (s: Seen) =>
  [s.down, s.click, s.key].every((f) => vi.mocked(f).mock.calls.length === 0);
const chipButton = () => screen.getByRole('button', { name: /^Housekeeping:/, hidden: true });

describe('HousekeepingChip', () => {
  it('is a button named with the status and the action, with the H letter', () => {
    render(<Harness seen={seenNone()} />);
    const button = screen.getByRole('button', {
      name: 'Housekeeping: needs cleaning. Change status',
    });
    expect(button).toHaveTextContent('H');
  });

  it('is only drawn, not a button, without permission', () => {
    render(<Harness readOnly seen={seenNone()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens on click and on Enter and Space, without reaching the grid handlers', async () => {
    const user = userEvent.setup();
    const seen = seenNone();
    render(<Harness seen={seen} />);
    await user.click(chipButton());
    expect(screen.getByRole('dialog', { name: 'Housekeeping' })).toBeInTheDocument();
    expect(noneSeen(seen)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close housekeeping' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    chipButton().focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    chipButton().focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(noneSeen(seen)).toBe(true);
  });

  it('keeps clicks and keys inside the pop-up away from the grid', async () => {
    const user = userEvent.setup();
    const seen = seenNone();
    render(<Harness seen={seen} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'abc{Enter}');
    expect(noneSeen(seen)).toBe(true);
  });

  it('offers the five settable statuses and never NYCI', async () => {
    const user = userEvent.setup();
    render(<Harness seen={seenNone()} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Not Checked Out',
      'Needs Cleaning',
      'Cleaned',
      'Ready',
      'Needs Maintenance',
    ]);
  });

  it('saves a picked status at once, without notes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness seen={seenNone()} onSave={onSave} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Ready' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ status: 'ready' });
    await waitFor(() =>
      expect(chipButton()).toHaveAccessibleName('Housekeeping: ready. Change status'),
    );
  });

  it('keeps the old status shown when the save fails', async () => {
    const user = userEvent.setup();
    render(<Harness seen={seenNone()} onSave={vi.fn().mockResolvedValue(false)} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Cleaned' }));
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Needs Cleaning');
  });

  it('adds a note and saves it with Save, then closes and returns focus to the chip', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness seen={seenNone()} onSave={onSave} />);
    await user.click(chipButton());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), '  Broken lamp ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      status: 'needs-cleaning',
      notes: 'Broken lamp',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(chipButton()).toHaveFocus());
    expect(chipButton()).toHaveAccessibleName(
      'Housekeeping: needs cleaning, with notes. Change status',
    );
  });

  it('removes an existing note with Remove Notes and Save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <Harness
        seen={seenNone()}
        onSave={onSave}
        initial={{ ...base, housekeepingNotes: 'Old note' }}
      />,
    );
    await user.click(chipButton());
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Old note');
    await user.click(screen.getByRole('button', { name: 'Remove Notes' }));
    expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ status: 'needs-cleaning', notes: '' });
  });

  it('stays open with the draft when saving the note fails', async () => {
    const user = userEvent.setup();
    render(<Harness seen={seenNone()} onSave={vi.fn().mockResolvedValue(false)} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'keep me');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('keep me');
  });

  it('X closes without saving the draft, and reopening starts from the saved note', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness seen={seenNone()} onSave={onSave} />);
    await user.click(chipButton());
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'draft');
    await user.click(screen.getByRole('button', { name: 'Close housekeeping' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(chipButton()).toHaveFocus());
    await user.click(chipButton());
    expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull();
  });

  it('shows "+" with notes in the 7 and 14 day views, not in the 30 day view', () => {
    const withNotes = { ...base, housekeepingNotes: 'n' };
    const seen = seenNone();
    const { unmount } = render(<Harness seen={seen} initial={withNotes} days={7} />);
    expect(chipButton()).toHaveTextContent('H+');
    unmount();
    const again = render(<Harness seen={seen} initial={withNotes} days={14} />);
    expect(chipButton()).toHaveTextContent('H+');
    again.unmount();
    const thirty = render(<Harness seen={seen} initial={withNotes} days={30} />);
    expect(chipButton()).toHaveTextContent('');
    thirty.unmount();
    render(<Harness seen={seen} initial={base} days={7} />);
    expect(chipButton()).toHaveTextContent(/^H$/);
  });
});
