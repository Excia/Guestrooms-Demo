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
    earlyCheckIn: true,
    lateCheckOut: true,
  },
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
  it('draws the link icon and takes early/late from the linked room (not yet checked in: early only)', () => {
    const { container } = view(block);
    expect(screen.getByTestId('linked-icon')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(container.querySelector('[data-marker="left"]')).not.toBeNull();
    expect(container.querySelector('[data-marker="right"]')).toBeNull();
  });

  it('shows late only once checked in, even when both are set', () => {
    const { container } = view({ ...block, status: 'checked-in' });
    expect(container.querySelector('[data-marker="left"]')).toBeNull();
    expect(container.querySelector('[data-marker="right"]')).not.toBeNull();
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

  it.each([
    [40, false, false],
    [90, true, false],
    [130, true, true],
  ])('at %ipx shows room number %s and reserver name %s', (width, room, reserver) => {
    const spy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width } as DOMRect);
    view(block);
    expect(screen.queryByText('202') !== null).toBe(room);
    expect(screen.queryByText('Thomas Okafor') !== null).toBe(reserver);
    spy.mockRestore();
  });
});
