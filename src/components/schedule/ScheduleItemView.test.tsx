import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { ScheduleBlock } from '../../api';
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

function view(item: ScheduleBlock, extra: Partial<Parameters<typeof ScheduleItemView>[0]> = {}) {
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
