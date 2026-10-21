import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import { useSystemSettings } from '../app/useSystemSettings';
import SystemSettings from './SystemSettings';

function Probe() {
  const { settings } = useSystemSettings();
  return <output aria-label="early late">{String(settings?.earlyLateEnabled)}</output>;
}

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <SystemSettingsProvider>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/primary-setup']}>
            <Link to="/schedule">Go to schedule</Link>
            <Probe />
            <SystemSettings />
          </MemoryRouter>
        </GrantedAccess>
      </SystemSettingsProvider>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('combobox', { name: 'Time Zone' });

describe('SystemSettings page', () => {
  it('shows the Figma values and a disabled save button until something changes', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'System Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Check In Time')).toHaveValue('16:00');
    expect(screen.getByLabelText('Checkout Time')).toHaveValue('12:00');
    expect(screen.getByRole('combobox', { name: 'Late Checkout Time' })).toHaveTextContent(
      '3:00 PM',
    );
    expect(screen.getByRole('radio', { name: 'Run Manually' })).toBeChecked();
    expect(screen.getByLabelText('Label')).toHaveValue('Service Charge');
    expect(screen.getByText('14 / 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save System Settings' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('uses 5-minute steps on the time fields', async () => {
    renderPage();
    await loaded();
    expect(screen.getByLabelText('Check In Time')).toHaveAttribute('step', '300');
  });

  it('hides the late checkout field while early check in and late check out is off', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(
      screen.getByRole('switch', { name: 'Enable Early Check In and Late Check Out' }),
    );
    expect(screen.queryByRole('combobox', { name: 'Late Checkout Time' })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('switch', { name: 'Enable Early Check In and Late Check Out' }),
    );
    expect(screen.getByRole('combobox', { name: 'Late Checkout Time' })).toBeInTheDocument();
  });

  it('shows both Close Settled Folios errors inline and refuses to save', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'Close Settled Folios' }));
    await user.click(screen.getByRole('option', { name: '1' }));
    expect(
      screen.getByText(
        'Close Settled Folios value must be larger than the MPOS Visibility setting after checkout.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Close Settled Folios value must extend past Late Checkout Time.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save System Settings' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Close Settled Folios' })).toHaveFocus();
  });

  it('counts the service charge label and stops at 15 characters', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const label = screen.getByLabelText('Label');
    await user.clear(label);
    await user.type(label, '1234567890123456789');
    expect(label).toHaveValue('123456789012345');
    expect(screen.getByText('15 / 15')).toBeInTheDocument();
  });

  it('saves everything with one button and publishes it through the settings context', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    await waitFor(() => expect(screen.getByLabelText('early late')).toHaveTextContent('true'));
    await user.click(
      screen.getByRole('switch', { name: 'Enable Early Check In and Late Check Out' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    const city = screen.getByLabelText('City');
    await user.clear(city);
    await user.type(city, 'Dayton');
    await user.click(screen.getByRole('button', { name: 'Save System Settings' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0][0];
    expect(sent.earlyLateEnabled).toBe(false);
    expect(sent.folio.city).toBe('Dayton');
    expect((await screen.findAllByText('System Settings Saved')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('early late')).toHaveTextContent('false');
    expect(screen.getByRole('button', { name: 'Save System Settings' })).toBeDisabled();
  });

  it('jumps to the Folio Details tab when a folio field is invalid', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    const email = screen.getByLabelText('Email Address');
    await user.clear(email);
    await user.type(email, 'not-an-email');
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Save System Settings' }));
    expect(await screen.findByLabelText('Email Address')).toHaveFocus();
  });

  it('shows the folio details, character counters and logo controls', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    expect(screen.getByLabelText('Street Address')).toHaveValue('4111 Clubessential Drive');
    expect(screen.getByText('24 / 100')).toBeInTheDocument();
    expect(screen.getByText('0 / 400')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for Photo' })).toBeInTheDocument();
    expect(
      screen.getByText('Folio Details will be displayed in the header of the printed Folio.'),
    ).toBeInTheDocument();
  });

  it('refuses a logo that is not an image', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    await user.upload(
      screen.getByLabelText('Logo file'),
      new File(['x'], 'logo.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPG or SVG');
  });

  it('asks before leaving with unsaved changes and keeps editing on Escape', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'System Settings have not been saved.',
    });
    expect(within(dialog).getByRole('button', { name: 'Save now' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Run Automatically' })).toBeChecked();
  });

  it('does not ask when nothing changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves after Save now when the save works', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    await user.click(await screen.findByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].nightAudit).toBe('automatic');
  });

  it('offers Retry when the settings cannot be loaded', async () => {
    renderPage(createMockClient({ scenario: 'error' }));
    expect(await screen.findByText('System Settings could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows a save failure without losing the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    vi.spyOn(client.systemSettings, 'save').mockRejectedValue(new Error('boom'));
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await user.click(screen.getByRole('button', { name: 'Save System Settings' }));
    expect(
      await screen.findByText('System Settings could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Run Automatically' })).toBeChecked();
  });

  it('reveals the daily run time only for an automatic night audit', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByLabelText('Daily Run Time')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    expect(screen.getByLabelText('Daily Run Time')).toHaveValue('02:00');
  });

  it('offers hours or days for the duration settings', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'Close Settled Folios unit' }));
    expect(screen.getByRole('option', { name: 'Days' })).toBeInTheDocument();
  });
});
