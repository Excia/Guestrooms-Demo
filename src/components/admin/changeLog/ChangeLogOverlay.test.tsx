import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiProvider } from '../../../api';
import { createMockClient } from '../../../api/mock';
import type { ApiClient } from '../../../api/types';
import ChangeLogOverlay from './ChangeLogOverlay';

function renderOverlay(client: ApiClient = createMockClient(), onClose = vi.fn()) {
  render(
    <ApiProvider client={client}>
      <ChangeLogOverlay page="system-settings" open onClose={onClose} />
    </ApiProvider>,
  );
  return onClose;
}

const bodyRows = () => screen.getAllByRole('row', { hidden: true }).slice(1);
const loaded = () => screen.findAllByRole('cell', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), / });

describe('ChangeLogOverlay', () => {
  it('names the page, lists the five columns and formats date and time', async () => {
    renderOverlay();
    expect(screen.getByRole('dialog', { name: 'System Settings Change Log' })).toBeInTheDocument();
    await loaded();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers[0]).toMatch(/^Date/);
    expect(headers.map((h) => h?.replace(/\(.*\)/, '').trim())).toEqual([
      'Date',
      'Time',
      'Change Type',
      'Description',
      'Action By',
    ]);
    const first = within(bodyRows()[0]).getAllByRole('cell');
    expect(first[0]).toHaveTextContent(/^[A-Z][a-z]{2}, \d{2}\/\d{2}\/\d{2}$/);
    expect(first[1]).toHaveTextContent(/^\d{2}:\d{2} (AM|PM)$/);
  });

  it('lists newest first and marks the date column sorted descending', async () => {
    renderOverlay();
    await loaded();
    expect(screen.getByRole('columnheader', { name: /^Date/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /^Time/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('shows only 25 rows and pages through the rest', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    expect(bodyRows()).toHaveLength(25);
    const firstText = bodyRows()[0].textContent;
    await user.click(screen.getByRole('button', { name: /page 2/i }));
    await waitFor(() => expect(bodyRows()[0].textContent).not.toBe(firstText));
  });

  it('sorts a column from its sort and filter icon', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Sort and filter Action By' }));
    await user.click(screen.getByRole('radio', { name: 'A to Z' }));
    await waitFor(() =>
      expect(
        screen.getByRole('columnheader', { name: /^Action By/, hidden: true }),
      ).toHaveAttribute('aria-sort', 'ascending'),
    );
    await waitFor(() =>
      expect(within(bodyRows()[0]).getAllByRole('cell', { hidden: true })[4]).toHaveTextContent(
        'Avery Chen',
      ),
    );
  });

  it('filters by change type from the event types list', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Sort and filter Change Type' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Updated' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Sort and filter Change Type (filter on)' }),
      ).toBeInTheDocument(),
    );
    await waitFor(() => {
      const cells = bodyRows().map(
        (r) => within(r).getAllByRole('cell', { hidden: true })[2].textContent,
      );
      expect(cells.length).toBeGreaterThan(0);
      expect(new Set(cells)).toEqual(new Set(['Updated']));
    });
  });

  it('refuses a time range that runs backwards', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Sort and filter Time' }));
    await user.type(screen.getByLabelText('From time'), '1000AM');
    await user.type(screen.getByLabelText('To time'), '0900AM');
    expect(await screen.findByRole('alert')).toHaveTextContent(/must not be before/);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('filters by employee and offers to clear when nothing matches', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Sort and filter Action By' }));
    await user.type(screen.getByLabelText('Employee name'), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('No changes match the filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await loaded();
    expect(bodyRows().length).toBeGreaterThan(1);
  });

  it('searches the descriptions from the search button', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Search descriptions' }));
    await user.type(screen.getByRole('textbox', { name: 'Search descriptions' }), 'night audit');
    await waitFor(() => {
      const rows = bodyRows();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => /night audit/i.test(r.textContent ?? ''))).toBe(true);
    });
  });

  it('shows an empty state and an error with Retry', async () => {
    renderOverlay(createMockClient({ scenario: 'empty' }));
    expect(
      await screen.findByText('No changes have been recorded for this page in the last year.'),
    ).toBeInTheDocument();
  });

  it('retries after an error', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const list = vi.spyOn(client.changeLog, 'list').mockRejectedValueOnce(new Error('down'));
    renderOverlay(client);
    expect(await screen.findByText('The change log could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await loaded();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('closes with the X and with Escape', async () => {
    const user = userEvent.setup();
    const onClose = renderOverlay();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Close Change Log' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
