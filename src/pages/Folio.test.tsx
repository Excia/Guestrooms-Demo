import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient, Folio as FolioData, FolioCharge } from '../api/types';
import { FOLIO_PATH } from '../app/routes';
import { theme } from '../theme';
import FolioPage from './Folio';

const charge = (over: Partial<FolioCharge>): FolioCharge => ({
  id: 'c',
  type: 'room-rate',
  date: '2026-10-14',
  description: '101 - King',
  amountCents: 10000,
  status: 'posted',
  references: [],
  roomId: 'rr1',
  occupantId: null,
  ...over,
});

const baseFolio = (over: Partial<FolioData> = {}): FolioData => ({
  reservationId: 'rs-1',
  confirmationNumber: 'GR-50001',
  checkInStatus: 'checked-in',
  open: true,
  mposVisible: true,
  nights: 3,
  guests: 2,
  rooms: [
    { id: 'rr1', number: '101' },
    { id: 'rr2', number: '102' },
  ],
  occupants: [
    { id: 'o1', name: 'Ann Lee', roomId: 'rr1' },
    { id: 'o2', name: 'Bo Kim', roomId: 'rr2' },
  ],
  charges: [
    charge({ id: 'a', description: 'Night A', amountCents: 20000 }),
    charge({
      id: 'b',
      type: 'mpos',
      description: 'MPOS Ann',
      amountCents: 4250,
      occupantId: 'o1',
    }),
    charge({
      id: 'c',
      type: 'manual',
      description: 'Late fee',
      amountCents: 2500,
      status: 'unposted',
      occupantId: 'o1',
    }),
    charge({
      id: 'd',
      description: 'Night B',
      amountCents: 30000,
      roomId: 'rr2',
      occupantId: 'o2',
    }),
    charge({
      id: 'e',
      description: 'Night C',
      amountCents: 5000,
      status: 'settled',
      references: ['11', '22', '33', '44'],
    }),
    charge({
      id: 'f',
      type: 'surcharge',
      description: 'Surcharge - Ref #11',
      amountCents: 150,
      status: 'settled',
      references: ['11'],
    }),
    charge({
      id: 'g',
      type: 'service-fee',
      description: 'Service Fee - Ref #22',
      amountCents: 90,
      status: 'settled',
      references: ['22'],
    }),
  ],
  payments: [
    {
      id: 'p1',
      typeLabel: 'Credit Card',
      date: '2026-10-14',
      reference: '456',
      ticket: null,
      description: 'Visa ending 4242',
      amountCents: 5240,
      status: 'Settled (Successful)',
    },
  ],
  ...over,
});

function clientWith(folio: FolioData | ApiError): ApiClient {
  let current = folio;
  const base = createMockClient();
  return {
    ...base,
    folios: {
      get: () => (current instanceof ApiError ? Promise.reject(current) : Promise.resolve(current)),
      postCharge: (r) => {
        if (current instanceof ApiError) return Promise.reject(current);
        current = {
          ...current,
          charges: current.charges.map((c) =>
            c.id === r.chargeId ? { ...c, status: 'posted' as const } : c,
          ),
        };
        return Promise.resolve(current);
      },
    },
  };
}

function setup(folio: FolioData | ApiError = baseFolio()) {
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={clientWith(folio)}>
        <MemoryRouter initialEntries={['/reservations/rs-1/folio']}>
          <Routes>
            <Route path={FOLIO_PATH} element={<FolioPage today="2026-10-16" />} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </ApiProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

const loaded = () => screen.findByRole('heading', { name: /Reservation #GR-50001 Folio/ });
const charges = () => screen.getByRole('table', { name: 'Charges' });

describe('Folio page', () => {
  it('shows the title, status chips, summary line, balances and both tables', async () => {
    setup();
    await loaded();
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('POS')).toBeInTheDocument();
    expect(screen.getByText('Folio Open')).toBeInTheDocument();
    expect(screen.getByText('2 Rooms | 3 Nights | 2 Guests')).toBeInTheDocument();
    const summary = screen.getByRole('group', { name: 'Balance summary' });
    expect(summary).toHaveAttribute('data-tone', 'yellow');
    expect(within(summary).getByText('$542.50')).toBeInTheDocument();
    expect(within(summary).getByText('$25.00')).toBeInTheDocument();
    expect(within(charges()).getAllByRole('row')).toHaveLength(8);
    const payments = screen.getByRole('table', { name: 'Payments' });
    expect(within(payments).getByText('Visa ending 4242')).toBeInTheDocument();
    expect(within(payments).getByText('N/A')).toBeInTheDocument();
  });

  it('drops the POS chip when the folio is not visible in MPOS', async () => {
    setup(baseFolio({ mposVisible: false }));
    await loaded();
    expect(screen.queryByText('POS')).not.toBeInTheDocument();
  });

  it('shows a reference list cut after three with the full list on hover, and the fee lines', async () => {
    setup();
    await loaded();
    const cut = within(charges()).getByText('Settled - Ref #11, #22, #33, …');
    expect(cut).toHaveAttribute('aria-label', 'Settled - Ref #11, #22, #33, #44');
    expect(within(charges()).getByText('Surcharge')).toBeInTheDocument();
    expect(within(charges()).getByText('Service Fee')).toBeInTheDocument();
    expect(within(charges()).getByText('Settled - Ref #11')).toBeInTheDocument();
  });

  it('has no checkbox on settled lines', async () => {
    setup();
    await loaded();
    expect(within(charges()).queryByRole('checkbox', { name: 'Select Night C' })).toBeNull();
    expect(within(charges()).getByRole('checkbox', { name: 'Select Night A' })).toBeInTheDocument();
  });

  it('filters by room and occupant, counts the lines and resets with View all', async () => {
    const user = setup();
    await loaded();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Occupant Filter/ }));
    await user.click(await screen.findByRole('option', { name: 'Room 101 - Ann Lee' }));
    expect(screen.getByText('Showing 2/7 Charges - Viewed by Room 101 - Ann Lee')).toBeVisible();
    expect(within(charges()).getByText('MPOS Ann')).toBeInTheDocument();
    expect(within(charges()).queryByText('Night B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View all' }));
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(within(charges()).getByText('Night B')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Occupant Filter/ })).toHaveTextContent('All');
  });

  it('shows the action bar with the selection total and enables the actions by line rules', async () => {
    const user = setup();
    await loaded();
    expect(screen.queryByRole('region', { name: 'Selection actions' })).not.toBeInTheDocument();
    await user.click(within(charges()).getByRole('checkbox', { name: 'Select Night A' }));
    await user.click(within(charges()).getByRole('checkbox', { name: 'Select MPOS Ann' }));
    const bar = screen.getByRole('region', { name: 'Selection actions' });
    expect(within(bar).getByText('Selection Total $242.50')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Settle $242.50' })).toBeEnabled();
    expect(within(bar).getByRole('button', { name: 'Split' })).toBeEnabled();
    // A room rate cannot be transferred.
    expect(within(bar).getByRole('button', { name: 'Transfer' })).toBeDisabled();
    await user.click(within(charges()).getByRole('checkbox', { name: 'Select Night A' }));
    expect(within(bar).getByRole('button', { name: 'Transfer' })).toBeEnabled();
    // An unposted manual charge has no checkbox: it must be posted first.
    expect(within(charges()).queryByRole('checkbox', { name: 'Select Late fee' })).toBeNull();
  });

  it('refuses split and transfer on a split part with an error, while settle works', async () => {
    const user = setup(
      baseFolio({
        charges: [
          charge({
            id: 's',
            type: 'split-parent',
            status: 'split',
            description: 'Custom Selection (2)',
          }),
          charge({
            id: 'k',
            type: 'split-child',
            description: 'Split of Night A',
            amountCents: 5000,
          }),
        ],
      }),
    );
    await loaded();
    await user.click(within(charges()).getByRole('checkbox', { name: 'Select Split of Night A' }));
    const bar = screen.getByRole('region', { name: 'Selection actions' });
    expect(within(bar).getByRole('button', { name: /Settle/ })).toBeEnabled();
    await user.click(within(bar).getByRole('button', { name: 'Split' }));
    expect((await screen.findAllByText(/cannot be split again/)).length).toBeGreaterThan(0);
    await user.click(within(bar).getByRole('button', { name: 'Transfer' }));
    expect((await screen.findAllByText(/cannot be transferred/)).length).toBeGreaterThan(0);
    // The parent shows its selection name and "Posted - Split", with an edit/undo control.
    expect(within(charges()).getAllByText('Custom Selection (2)').length).toBe(2);
    expect(within(charges()).getByText('Posted - Split')).toBeInTheDocument();
    expect(
      within(charges()).getByRole('button', { name: 'Edit or undo split Custom Selection (2)' }),
    ).toBeInTheDocument();
    expect(within(charges()).queryByRole('checkbox', { name: /Custom Selection/ })).toBeNull();
  });

  it('does not act on lines the filter hides', async () => {
    const user = setup();
    await loaded();
    await user.click(within(charges()).getByRole('checkbox', { name: 'Select Night B' }));
    await user.click(screen.getByRole('combobox', { name: /Occupant Filter/ }));
    await user.click(await screen.findByRole('option', { name: 'Room 101' }));
    expect(screen.queryByRole('region', { name: 'Selection actions' })).not.toBeInTheDocument();
  });

  it('selects all selectable lines from the header checkbox', async () => {
    const user = setup();
    await loaded();
    await user.click(screen.getByRole('checkbox', { name: 'Select all charges' }));
    expect(
      within(screen.getByRole('region', { name: 'Selection actions' })).getByText(
        'Selection Total $542.50',
      ),
    ).toBeInTheDocument();
  });

  it('disables the action CTAs on a closed folio', async () => {
    setup(baseFolio({ open: false, checkInStatus: 'checked-out' }));
    await loaded();
    expect(screen.getByText('Folio Closed')).toBeInTheDocument();
    for (const name of [
      'Quick Settle',
      'Quick Split',
      'Manual Charge / Credit',
      'Add Deposit / Payment',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Post Late fee' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Late fee' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Jump to Night Audit History' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Balance summary' })).toHaveAttribute(
      'data-tone',
      'grey',
    );
  });

  it('posts one unposted charge after the dialog confirms', async () => {
    const user = setup();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Post Late fee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Post Late fee via Night Audit?' });
    expect(
      within(dialog).getByRole('link', { name: 'Run Night Audit Wizard' }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Post Charge' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Post Late fee' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const summary = screen.getByRole('group', { name: 'Balance summary' });
    expect(within(summary).getByText('$567.50')).toBeInTheDocument();
    expect(within(summary).getByText('$0.00')).toBeInTheDocument();
  });

  it('Go back closes the dialog without posting', async () => {
    const user = setup();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Post Late fee' }));
    await user.click(await screen.findByRole('button', { name: 'Go back' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Post Late fee' })).toBeInTheDocument();
  });

  it('wires Print and Email to stubs', async () => {
    const user = setup();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Print' }));
    expect((await screen.findAllByText(/Print is a stub/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Email' }));
    expect((await screen.findAllByText(/Email is a stub/)).length).toBeGreaterThan(0);
  });

  it('collapses and expands a section', async () => {
    const user = setup();
    await loaded();
    const toggle = screen.getByRole('button', { name: 'Collapse Payments' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand Payments' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('says so when the reservation does not exist', async () => {
    setup(new ApiError(404, 'nope'));
    expect(await screen.findByText('This reservation was not found.')).toBeInTheDocument();
  });

  it('offers a retry when the folio cannot be loaded', async () => {
    setup(new ApiError(500, 'boom'));
    expect(await screen.findByText('The folio could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
