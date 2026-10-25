import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { ScheduleBlock, ScheduleClosure } from '../../api';
import { theme } from '../../theme';
import ScheduleItemView from './ScheduleItemView';

const block: ScheduleBlock = {
  kind: 'reservation',
  id: 'rr-1',
  reservationId: 'res-1',
  confirmationNumber: 'C-1',
  guestName: 'Ada Lovelace',
  guestType: 'guest',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-11',
  status: 'nyci',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  linkedTo: {
    roomNumber: '202',
    reserverName: 'Thomas Okafor',
  },
  earlyCheckIn: true,
  lateCheckOut: true,
};
const layout = { column: 0, span: 1, continuesBefore: false, continuesAfter: false };

function view(
  item: ScheduleBlock | ScheduleClosure,
  extra: Partial<Parameters<typeof ScheduleItemView>[0]> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <ScheduleItemView
        item={item}
        layout={layout as never}
        days={14}
        today="2026-10-10"
        label="block"
        {...extra}
      />
    </ThemeProvider>,
  );
}

describe('ScheduleItemView early and late tabs', () => {
  // Both tabs come from the same marker and EDGE_TAB_SPACING (0.5 spacing units = 4px).
  it('draws the Early Check In tab on the left as wide as the Late Check Out tab on the right', () => {
    const { container } = view({ ...block, linkedTo: undefined });
    const left = container.querySelector('[data-marker="left"]')!;
    const right = container.querySelector('[data-marker="right"]')!;
    expect(left).toHaveStyle({ width: '4px' });
    expect(right).toHaveStyle({ width: '4px' });
    expect(getComputedStyle(left).width).toBe(getComputedStyle(right).width);
  });
});

describe('ScheduleItemView linked block', () => {
  it('draws the link icon and no early/late markers, whatever the flags', () => {
    const { container } = view(block);
    expect(screen.getByTestId('linked-icon')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(container.querySelector('[data-marker="left"]')).toBeNull();
    expect(container.querySelector('[data-marker="right"]')).toBeNull();
  });

  it('draws no markers once checked in either', () => {
    const { container } = view({ ...block, status: 'checked-in' });
    expect(container.querySelector('[data-marker="left"]')).toBeNull();
    expect(container.querySelector('[data-marker="right"]')).toBeNull();
  });

  it('shows the exact two-line tooltip on hover', async () => {
    view(block, { tip: 'Ada Lovelace, C-1, Room 1' });
    await userEvent.hover(screen.getByRole('gridcell'));
    const tip = await screen.findByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Linked to 202Thomas Okafor');
  });

  it('shows the tooltip when a tab-stop block gets keyboard focus', async () => {
    view(block, { onActivate: () => {} });
    await userEvent.tab();
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Linked to 202');
  });

  it('shows the tooltip while the grid cursor is on the block', async () => {
    view(block, { tipFocused: true });
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Thomas Okafor');
  });

  it('is dimmed, not-allowed, aria-disabled and does not start a drag', async () => {
    const onPointerDown = vi.fn();
    const onActivate = vi.fn();
    view(block, { onPointerDown, onActivate });
    const cell = screen.getByRole('gridcell');
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    expect(cell).toHaveStyle({ opacity: '0.75', cursor: 'not-allowed' });
    await userEvent.tab();
    await userEvent.keyboard('{Enter} ');
    await userEvent.pointer({ keys: '[MouseLeft>]', target: cell });
    expect(onPointerDown).not.toHaveBeenCalled();
    // The owner's callback only announces why nothing opens.
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('writes the room and the reserver in the 7 day view', () => {
    view({ ...block, linkedTo: { ...block.linkedTo!, multilinkageCount: 2 } }, { days: 7 });
    expect(screen.getByText('202 +2')).toBeInTheDocument();
    expect(screen.queryByText('Thomas Okafor')).not.toBeInTheDocument();
    view(block, { days: 7 });
    expect(screen.getByText('Thomas Okafor')).toBeInTheDocument();
  });

  it('14 day view, one night: no first line, the room name on the second line', () => {
    view(block, { days: 14 });
    expect(screen.getByText('202')).toHaveStyle({ fontWeight: '400' });
    expect(screen.queryByText('Thomas Okafor')).not.toBeInTheDocument();
  });

  it('30 day view, one night: the icon alone', () => {
    view(block, { days: 30 });
    expect(screen.getByTestId('linked-icon')).toBeInTheDocument();
    expect(screen.queryByText('202')).not.toBeInTheDocument();
  });

  it('a stay of 3 nights shows the room name in bold in the 30 day view', () => {
    view({ ...block, endDate: '2026-10-13' }, { days: 30 });
    expect(screen.getByText('202')).toHaveStyle({ fontWeight: '700' });
  });
});

describe('ScheduleItemView block content', () => {
  const plain: ScheduleBlock = {
    ...block,
    linkedTo: undefined,
    guestType: 'owner',
    guestName: 'Ada Lovelace',
    occupantCount: 3,
    occupants: ['Ada Lovelace', 'Bill Lovelace'],
    reserverName: 'Thomas Okafor',
    endDate: '2026-10-11',
  };

  it('writes the lead occupant with +N and the reserver as the detail', () => {
    view(plain, { days: 14 });
    expect(screen.getByText('Ada Lovelace +2')).toBeInTheDocument();
    expect(screen.getByText('Thomas Okafor')).toBeInTheDocument();
    expect(screen.queryByText('C-1')).not.toBeInTheDocument();
  });

  it('keeps the confirmation number when there is no detail', () => {
    view({ ...plain, reserverName: undefined, occupantCount: undefined }, { days: 14 });
    expect(screen.getByText('C-1')).toBeInTheDocument();
  });

  it('shows the room type of an unassigned reservation', () => {
    view({ ...plain, roomId: '', roomTypeName: 'Suite' }, { days: 14 });
    expect(screen.getByText('Suite')).toBeInTheDocument();
  });

  it('month view, one night: initials and no guest-type icon', () => {
    const { container } = view(plain, { days: 30 });
    expect(screen.getByText('A.L. +2')).toBeInTheDocument();
    expect(container.querySelector('svg[data-testid="HistoryEduIcon"]')).toBeNull();
  });

  it('month view, two nights: full name and the icon', () => {
    const { container } = view({ ...plain, endDate: '2026-10-12' }, { days: 30 });
    expect(screen.getByText('Ada Lovelace +2')).toBeInTheDocument();
    expect(container.querySelector('svg[data-testid="HistoryEduIcon"]')).not.toBeNull();
  });

  it('truncates the text with an ellipsis (noWrap) and keeps the full text in the tooltip', async () => {
    view(plain, {
      days: 30,
      tip: 'Ada Lovelace, C-1, Room 1',
    });
    expect(screen.getByText('A.L. +2')).toHaveStyle({ textOverflow: 'ellipsis' });
    await userEvent.hover(screen.getByRole('gridcell'));
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent(
      'Occupants: Ada Lovelace, Bill Lovelace, TBD',
    );
  });

  it('opens the tooltip on hover even when the text is not cut off, and on keyboard focus', async () => {
    const { unmount } = view(plain, { days: 14, tip: 'Ada Lovelace, C-1, Room 1' });
    await userEvent.hover(screen.getByRole('gridcell'));
    const tip = await screen.findByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Ada Lovelace, C-1, Room 1');
    expect(tip).toHaveTextContent('Room owner');
    unmount();
    view(plain, { days: 14, tip: 'Ada Lovelace, C-1, Room 1', onActivate: () => {} });
    await userEvent.tab();
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Room owner');
  });
});

describe('ScheduleItemView closure tooltip', () => {
  const closure: ScheduleClosure = {
    kind: 'closure',
    id: 'cl-1',
    roomId: 'rm-1',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    reason: 'Reserved: Fixed Loss',
    endMarker: false,
  };

  it('draws no end markers, even when the seed says endMarker (legacy closures have none)', () => {
    const { container } = view({ ...closure, endMarker: true });
    expect(container.querySelector('[data-marker]')).toBeNull();
  });

  it('is filled with the legacy grey stripes, not a flat grey', () => {
    const { container } = view(closure);
    const body = container.querySelector('[data-body]') as HTMLElement;
    const image = getComputedStyle(body).backgroundImage;
    expect(image).toContain('repeating-linear-gradient');
    expect(image).toContain('45deg');
    expect(image).toContain('rgb(238, 238, 238)');
    expect(image).toContain('rgb(187, 187, 187)');
  });

  it('has no tooltip on hover while its text fits', async () => {
    view(closure, { tip: closure.reason });
    await userEvent.hover(screen.getByRole('gridcell'));
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
  });

  it('shows the full reason on hover when the text is cut off', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    try {
      view(closure, { tip: closure.reason });
      await userEvent.hover(screen.getByRole('gridcell'));
      expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent(
        'Reserved: Fixed Loss',
      );
    } finally {
      width.mockRestore();
      client.mockRestore();
    }
  });

  it('a linked block builds no occupant lines', async () => {
    view(block, { tip: 'ignored', tipFocused: true });
    const tip = await screen.findByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Linked to 202');
    expect(tip).not.toHaveTextContent('ignored');
  });
});
