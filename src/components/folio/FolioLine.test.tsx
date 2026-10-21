import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import type { FolioCharge } from '../../api/types';
import { lineActions } from '../../app/folioLine';
import { theme } from '../../theme';
import FolioLine from './FolioLine';

const base: FolioCharge = {
  id: 'x',
  type: 'room-rate',
  date: '2026-10-16',
  description: '101 - King',
  amountCents: 10000,
  status: 'posted',
  references: [],
  roomId: null,
  occupantId: null,
};

function renderLine(charge: FolioCharge, open = true) {
  const noop = () => undefined;
  render(
    <ThemeProvider theme={theme}>
      <Table>
        <TableBody>
          <FolioLine
            charge={charge}
            actions={lineActions(charge, { today: '2026-10-16' })}
            open={open}
            selected={false}
            onToggle={noop}
            onPost={noop}
            onStub={noop}
          />
        </TableBody>
      </Table>
    </ThemeProvider>,
  );
  return screen.getByRole('row');
}

describe('FolioLine', () => {
  it('shows type, date, description, amount and status for a posted room rate', () => {
    const row = renderLine(base);
    for (const text of ['RoomDailyRate', '10/16/26', '101 - King', '$100.00', 'Posted']) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    expect(within(row).getByRole('checkbox', { name: 'Select 101 - King' })).toBeInTheDocument();
  });

  it('shows Post and Edit on an unposted room rate on its date, with no checkbox', () => {
    const row = renderLine({ ...base, status: 'unposted' });
    expect(within(row).getByText('Unposted')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Post 101 - King' })).toBeEnabled();
    expect(within(row).getByRole('button', { name: 'Edit 101 - King' })).toBeEnabled();
    expect(within(row).queryByRole('checkbox')).toBeNull();
  });

  it('shows Delete, not Edit, on an unposted add-on', () => {
    const row = renderLine({ ...base, type: 'add-on', status: 'unposted' });
    expect(within(row).getByText('Add-On')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Delete 101 - King' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Edit/ })).toBeNull();
  });

  it('shows a settled line in italics with its reference and no controls', () => {
    const row = renderLine({ ...base, status: 'settled', references: ['456'] });
    expect(within(row).getByText('Settled - Ref #456')).toBeInTheDocument();
    expect(row).toHaveAttribute('data-line-status', 'settled');
    expect(within(row).queryByRole('button')).toBeNull();
    expect(getComputedStyle(within(row).getByText('RoomDailyRate').closest('td')!).fontStyle).toBe(
      'italic',
    );
  });

  it('names the destination on the transfer control of a settled MPOS line', () => {
    const row = renderLine({ ...base, type: 'mpos', status: 'settled', references: ['123'] });
    expect(
      within(row).getByRole('button', { name: 'Transfer 101 - King to Unassigned' }),
    ).toBeInTheDocument();
  });

  it('shows a split parent with the selection name, Posted - Split and the Split control', () => {
    const row = renderLine({
      ...base,
      type: 'split-parent',
      status: 'split',
      description: 'Custom Selection (3)',
    });
    expect(within(row).getAllByText('Custom Selection (3)')).toHaveLength(2);
    expect(within(row).getByText('Posted - Split')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Edit or undo split Custom Selection (3)' }),
    ).toBeEnabled();
    expect(within(row).queryByRole('checkbox')).toBeNull();
  });

  it('labels a split part "Split"', () => {
    const row = renderLine({ ...base, type: 'split-child', description: 'Split of Night' });
    expect(within(row).getAllByText(/^Split/).length).toBeGreaterThan(0);
    expect(
      within(row).getByRole('checkbox', { name: 'Select Split of Night' }),
    ).toBeInTheDocument();
  });

  it('keeps the controls but disables them on a closed folio', () => {
    const row = renderLine({ ...base, type: 'manual', status: 'unposted' }, false);
    expect(within(row).getByRole('button', { name: 'Post 101 - King' })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Delete 101 - King' })).toBeDisabled();
  });
});
