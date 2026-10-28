import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError, type ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess, saveButtonName } from '../app/testing';
import { useSystemSettings } from '../app/useSystemSettings';
import SystemSettings from './SystemSettings';

function Probe() {
  const { settings } = useSystemSettings();
  return <output aria-label="early late">{String(settings?.earlyLateEnabled)}</output>;
}

function renderPage(client: ApiClient = createMockClient(), readOnly = false) {
  return render(
    <ApiProvider client={client}>
      <SystemSettingsProvider>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/primary-setup']}>
            <Link to="/schedule">Go to schedule</Link>
            <Probe />
            <SystemSettings readOnly={readOnly} />
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
    expect(screen.getByLabelText('Check In Time')).toHaveValue('04:00 PM');
    expect(screen.getByLabelText('Checkout Time')).toHaveValue('12:00 PM');
    expect(screen.getByLabelText('Late Checkout Time')).toHaveValue('03:00 PM');
    expect(screen.getByRole('radio', { name: 'Run Manually' })).toBeChecked();
    expect(screen.getByLabelText('Label')).toHaveValue('Service Charge');
    expect(screen.getByText('14 / 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: saveButtonName('System Settings') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('offers 5-minute steps on the clock of the time fields', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Choose check in time' }));
    await user.click(await screen.findByRole('button', { name: /^Minutes/ }));
    expect(screen.getByRole('slider', { name: 'Minutes' })).toHaveAttribute('aria-valuemax', '55');
  });

  it('disables every clock button in a view-only page', async () => {
    renderPage(createMockClient(), true);
    await loaded();
    expect(screen.getByRole('button', { name: 'Choose check in time' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose checkout time' })).toBeDisabled();
    expect(screen.getByLabelText('Check In Time')).toBeDisabled();
  });

  it('explains and turns off the late checkout clock when check in is not after checkout', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const checkIn = screen.getByLabelText('Check In Time');
    await user.clear(checkIn);
    await user.type(checkIn, '11:00 AM');
    expect(screen.getByRole('button', { name: 'Choose late checkout time' })).toBeDisabled();
    expect(
      screen.getByText(/Set a check-in time later than the checkout time/),
    ).toBeInTheDocument();
  });

  it('hides the late checkout field while early check in and late check out is off', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(
      screen.getByRole('switch', { name: 'Enable Early Check In and Late Check Out' }),
    );
    expect(screen.queryByLabelText('Late Checkout Time')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('switch', { name: 'Enable Early Check In and Late Check Out' }),
    );
    expect(screen.getByLabelText('Late Checkout Time')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
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
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0][0];
    expect(sent.earlyLateEnabled).toBe(false);
    expect(sent.folio.city).toBe('Dayton');
    expect((await screen.findAllByText('System Settings Saved')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('early late')).toHaveTextContent('false');
    expect(screen.getByRole('button', { name: saveButtonName('System Settings') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
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
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
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
    expect(screen.getByLabelText('Daily Run Time')).toHaveValue('02:00 AM');
  });

  it('offers hours or days for the duration settings', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'Close Settled Folios unit' }));
    expect(screen.getByRole('option', { name: 'Days' })).toBeInTheDocument();
  });
  it('lists the tabs in Figma order and each tab shows its own panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const tabs = within(screen.getByRole('tablist', { name: /System Settings/i })).getAllByRole(
      'tab',
    );
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Settings',
      'Default Rate Categories',
      'Folio Details',
      'Registration Card',
      'Online Booking',
    ]);
    const marker: Record<string, [string, string]> = {
      Settings: ['heading', 'Time Zone'],
      'Default Rate Categories': ['combobox', '^Members default rate category'],
      'Folio Details': ['textbox', 'City'],
      'Registration Card': ['switch', 'Enable Registration Card'],
      'Online Booking': ['textbox', 'Global Booking Message'],
    };
    for (const t of tabs.filter((x) => !(x as HTMLButtonElement).disabled)) {
      await user.click(t);
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', t.id);
      const [role, name] = marker[t.textContent ?? ''];
      expect(within(panel).getByRole(role, { name: new RegExp(name) })).toBeInTheDocument();
      for (const [other, [r, n]] of Object.entries(marker)) {
        if (other !== t.textContent) {
          expect(within(panel).queryByRole(r, { name: new RegExp(n) })).not.toBeInTheDocument();
        }
      }
    }
  });

  describe('Registration Card tab', () => {
    const openTab = async (client?: ApiClient) => {
      const user = userEvent.setup();
      renderPage(client);
      await loaded();
      await user.click(screen.getByRole('tab', { name: 'Registration Card' }));
      return user;
    };

    it('shows the switch and the items as Figma draws them', async () => {
      await openTab();
      expect(screen.getByRole('switch', { name: 'Enable Registration Card' })).toBeChecked();
      expect(
        screen.getByText('When enabled, a registration card will be printed upon check-in.'),
      ).toBeInTheDocument();
      const group = screen.getByRole('group', { name: 'Registration Card Items' });
      expect(within(group).getAllByRole('checkbox')).toHaveLength(19);
      for (const name of [
        'Include Folio Header',
        'Confirmation Number',
        'Lead Occupant Name',
        'Custom Text',
      ]) {
        expect(within(group).getByRole('checkbox', { name })).toBeChecked();
      }
      for (const name of [
        'Early Check In Flag',
        'Room Type',
        'Average Room Rate',
        'Staff Signature Area',
      ]) {
        expect(within(group).getByRole('checkbox', { name })).not.toBeChecked();
      }
      expect(screen.getByRole('button', { name: 'Generate Preview' })).toBeEnabled();
    });

    it('disables the reserver phone until the reserver name is checked', async () => {
      const user = await openTab();
      const phone = screen.getByRole('checkbox', { name: 'Reserver Phone Number (if unique)' });
      expect(phone).toBeDisabled();
      await user.click(screen.getByRole('checkbox', { name: 'Reserver Name (if unique)' }));
      expect(phone).toBeEnabled();
    });

    it('explains why a dependent box is disabled', async () => {
      const user = await openTab();
      const phone = screen.getByRole('checkbox', { name: 'Reserver Phone Number (if unique)' });
      expect(phone).toHaveAccessibleDescription('Check Reserver Name (if unique) to use this.');
      await user.click(screen.getByRole('checkbox', { name: 'Reserver Name (if unique)' }));
      expect(phone).not.toHaveAccessibleDescription();
    });

    it('a flag needs its date: unchecking the date clears and disables the flag', async () => {
      const user = await openTab();
      const flag = screen.getByRole('checkbox', { name: 'Early Check In Flag' });
      await user.click(flag);
      expect(flag).toBeChecked();
      await user.click(screen.getByRole('checkbox', { name: 'Check In Date' }));
      expect(flag).toBeDisabled();
      expect(flag).not.toBeChecked();
      expect(flag).toHaveAccessibleDescription('Check Check In Date to use this.');
    });

    it('unchecking Lead Occupant Name disables and clears its phone and address', async () => {
      const user = await openTab();
      await user.click(screen.getByRole('checkbox', { name: 'Lead Occupant Phone Number' }));
      await user.click(screen.getByRole('checkbox', { name: 'Lead Occupant Address' }));
      await user.click(screen.getByRole('checkbox', { name: 'Lead Occupant Name' }));
      for (const name of ['Lead Occupant Phone Number', 'Lead Occupant Address']) {
        const box = screen.getByRole('checkbox', { name });
        expect(box).toBeDisabled();
        expect(box).not.toBeChecked();
      }
    });

    it('turns every item and the preview off with the switch', async () => {
      const user = await openTab();
      await user.click(screen.getByRole('switch', { name: 'Enable Registration Card' }));
      expect(screen.getByRole('checkbox', { name: 'Room Number' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Generate Preview' })).toBeDisabled();
    });

    it('counts the custom text up to 500 and hides the box while Custom Text is unchecked', async () => {
      const user = await openTab();
      const text = screen.getByRole('textbox', { name: 'Custom Text content' });
      expect(text).toHaveAttribute('maxlength', '500');
      await user.clear(text);
      await user.type(text, 'Hello');
      expect(screen.getByText('5 / 500')).toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Custom Text' }));
      expect(
        screen.queryByRole('textbox', { name: 'Custom Text content' }),
      ).not.toBeInTheDocument();
    });

    it('saves the card with the rest of System Settings', async () => {
      const client = createMockClient();
      const save = vi.spyOn(client.systemSettings, 'save');
      const user = await openTab(client);
      await user.click(screen.getByRole('checkbox', { name: 'Room Type' }));
      await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save.mock.calls[0][0].registrationCard.items.roomType).toBe(true);
    });

    it('Generate Preview opens the card in a dialog, not a new tab, from the unsaved draft', async () => {
      const client = createMockClient();
      const request = vi.spyOn(client.registrationCard, 'requestPreview');
      const open = vi.spyOn(window, 'open');
      const user = await openTab(client);
      await user.click(screen.getByRole('checkbox', { name: 'Room Type' }));
      await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
      const dialog = await screen.findByRole('dialog', { name: 'Registration Card Preview' });
      expect(within(dialog).getByText('(King Suite)')).toBeInTheDocument();
      expect(open).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      open.mockRestore();
    });

    it('Print asks the backend for the document with the draft and opens it in a new tab', async () => {
      const client = createMockClient();
      const request = vi
        .spyOn(client.registrationCard, 'requestPreview')
        .mockResolvedValue({ url: 'blob:preview' });
      const tab = { location: { href: '' }, close: vi.fn(), opener: {} };
      const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      const user = await openTab(client);
      await user.click(screen.getByRole('checkbox', { name: 'Room Type' }));
      await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
      await user.click(await screen.findByRole('button', { name: 'Print' }));
      await waitFor(() => expect(tab.location.href).toBe('blob:preview'));
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(request.mock.calls[0][0].settings.items.roomType).toBe(true);
      expect(request.mock.calls[0][0].folio.city).toBe('Cincinnati');
      open.mockRestore();
    });

    it('says the tab was blocked and requests nothing', async () => {
      const client = createMockClient();
      const request = vi.spyOn(client.registrationCard, 'requestPreview');
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const user = await openTab(client);
      await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
      await user.click(await screen.findByRole('button', { name: 'Print' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('blocked the new tab');
      expect(request).not.toHaveBeenCalled();
      open.mockRestore();
    });

    it('closes the tab and says so when printing fails or the address is not safe', async () => {
      const client = createMockClient();
      const request = vi.spyOn(client.registrationCard, 'requestPreview');
      const tab = { location: { href: '' }, close: vi.fn(), opener: {} };
      const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      const user = await openTab(client);
      await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
      request.mockRejectedValueOnce(new Error('down'));
      await user.click(await screen.findByRole('button', { name: 'Print' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The preview could not be generated',
      );
      expect(tab.close).toHaveBeenCalledTimes(1);
      request.mockResolvedValueOnce({ url: 'javascript:alert(1)' });
      await user.click(screen.getByRole('button', { name: 'Print' }));
      await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(2));
      expect(tab.location.href).toBe('');
      open.mockRestore();
    });
  });
  it('opens the Change Log dialog for this page and returns focus when it closes', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const open = screen.getByRole('button', { name: 'Change Log' });
    await user.click(open);
    expect(
      await screen.findByRole('dialog', { name: 'System Settings: Change Log' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Change Log' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(open).toHaveFocus();
  });
  it('shows the Online Booking tab with counters, the link switch and the toggles', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    expect(screen.getByRole('textbox', { name: 'Global Booking Message' })).toHaveValue(
      'To book more than 3 rooms, please contact group sales at ###-###-####.',
    );
    expect(screen.getByText('70 / 150')).toBeInTheDocument();
    expect(screen.getByText(/ \/ 300$/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Include Link to Full Policy' })).toBeChecked();
    expect(screen.getByLabelText('URL')).toHaveValue('https://www.clubname.com/guestroomspolicy');
    expect(screen.getByRole('switch', { name: 'Charge a Cancellation Fee' })).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Include Link to Full Policy' }));
    expect(screen.queryByLabelText('URL')).not.toBeInTheDocument();
  });

  it('saves Online Booking edits with the rest and refuses an invalid url', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    const url = screen.getByLabelText('URL');
    await user.clear(url);
    await user.type(url, 'not a url');
    expect(screen.getByText(/Enter a full web address/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    expect(await screen.findByLabelText('URL')).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('URL'));
    await user.type(screen.getByLabelText('URL'), 'https://club.example.com/policy');
    await user.click(screen.getByRole('switch', { name: 'Display Add-Ons Popup' }));
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].onlineBooking).toMatchObject({
      policyUrl: 'https://club.example.com/policy',
      showAddOnsPopup: true,
    });
  });

  it('ties the counter, the error and the switch explanations to their controls', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    const message = screen.getByRole('textbox', { name: 'Global Booking Message' });
    expect(message).toHaveAccessibleDescription(/70 \/ 150/);
    expect(message).toHaveAccessibleDescription(/Message will be displayed/);
    // maxLength stops typing, so an over-limit value is set the way a script or paste would
    fireEvent.change(message, { target: { value: 'x'.repeat(151) } });
    expect(message).toHaveAccessibleDescription(/Use 150 characters or fewer\./);
    expect(message).toHaveAccessibleDescription(/151 \/ 150/);
    expect(
      screen.getByRole('switch', { name: 'Charge a Cancellation Fee' }),
    ).toHaveAccessibleDescription('Helper text about cancellation fees.');
    expect(
      screen.getByRole('switch', { name: 'Display Add-Ons Popup' }),
    ).toHaveAccessibleDescription(/promote add-on options/);
  });

  it('puts the validation message in the url description', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    const url = screen.getByLabelText('URL');
    await user.clear(url);
    await user.type(url, 'nope');
    expect(url).toHaveAccessibleDescription(/Enter a full web address/);
  });

  it('asks before leaving after an Online Booking edit', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    await user.click(screen.getByRole('switch', { name: 'Charge a Cancellation Fee' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'System Settings have not been saved.' }),
    ).toBeInTheDocument();
  });

  it('searches house accounts as you type, saves the choice and can clear it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    const field = screen.getByRole('combobox', { name: 'House Account' });
    expect(field).toHaveValue('Club House Account');
    expect(screen.getByRole('button', { name: 'Search House Account' })).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'banq');
    await user.click(await screen.findByRole('option', { name: 'Banquet Comp Account' }));
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(async () =>
      expect((await client.systemSettings.get()).houseAccount?.id).toBe('house-2'),
    );
    await user.click(screen.getByRole('combobox', { name: 'House Account' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(async () => expect((await client.systemSettings.get()).houseAccount).toBeNull());
    expect(screen.getByRole('combobox', { name: 'House Account' })).toHaveAttribute(
      'placeholder',
      'House Account Name',
    );
  });

  it('shows a no results message and a failure message', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    const field = screen.getByRole('combobox', { name: 'House Account' });
    await user.clear(field);
    await user.type(field, 'zzz');
    expect(await screen.findByText('No house accounts found')).toBeInTheDocument();
    client.systemSettings.listHouseAccounts = () => Promise.reject(new Error('down'));
    await user.type(field, 'z');
    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();
  });

  it('asks before leaving after a House Account change', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'House Account' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'System Settings have not been saved.' }),
    ).toBeInTheDocument();
  });

  it('shows a house account that no longer exists as a field error and focuses it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = client.systemSettings.save;
    renderPage({
      ...client,
      systemSettings: {
        ...client.systemSettings,
        save: (settings, o) =>
          settings.houseAccount?.id === 'house-2'
            ? Promise.reject(new ApiError(422, 'gone', { code: 'unknown-house-account' }))
            : save(settings, o),
      },
    });
    await loaded();
    const field = screen.getByRole('combobox', { name: 'House Account' });
    await user.clear(field);
    await user.type(field, 'banq');
    await user.click(await screen.findByRole('option', { name: 'Banquet Comp Account' }));
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    expect(
      await screen.findByText('This house account no longer exists. Choose another.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'House Account' })).toHaveFocus(),
    );
    expect(screen.getByRole('combobox', { name: 'House Account' })).toHaveAccessibleDescription(
      'This house account no longer exists. Choose another.',
    );
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
    // Choosing another account clears the message.
    await user.clear(screen.getByRole('combobox', { name: 'House Account' }));
    await user.type(screen.getByRole('combobox', { name: 'House Account' }), 'club');
    await user.click(await screen.findByRole('option', { name: 'Club House Account' }));
    expect(
      screen.queryByText('This house account no longer exists. Choose another.'),
    ).not.toBeInTheDocument();
  });

  it('disables every Settings control and Save in read-only mode', async () => {
    renderPage(createMockClient(), true);
    await loaded();
    const panel = screen.getByRole('tabpanel');
    const controls = within(panel).queryAllByRole('combobox');
    controls.push(
      ...within(panel).queryAllByRole('switch'),
      ...within(panel).queryAllByRole('radio'),
      ...within(panel).queryAllByRole('textbox'),
    );
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) {
      const disabled =
        (control as HTMLInputElement).disabled || control.getAttribute('aria-disabled') === 'true';
      expect(disabled, control.getAttribute('aria-label') ?? control.id).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Search House Account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: saveButtonName('System Settings') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
