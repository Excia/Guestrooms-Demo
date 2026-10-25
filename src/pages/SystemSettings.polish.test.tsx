// System Settings polish (2026-10-25): red photo remove, Training Mode, thinner text, preview dialog.
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import SystemSettings from './SystemSettings';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <GrantedAccess>
            <MemoryRouter initialEntries={['/admin/primary-setup']}>
              <SystemSettings />
            </MemoryRouter>
          </GrantedAccess>
        </SystemSettingsProvider>
      </ApiProvider>
    </ThemeProvider>,
  );
}
const loaded = () => screen.findByRole('combobox', { name: 'Time Zone' });
// jsdom reports the resolved size in px (the theme writes rem).
const fontPx = (el: Element) => Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100;

describe('Folio Details logo remove badge', () => {
  it('is a red X with a 24px minimum target and an accessible name', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    expect(screen.queryByRole('button', { name: 'Remove logo' })).not.toBeInTheDocument();
    await user.upload(
      screen.getByLabelText('Logo file'),
      new File(['x'], 'logo.png', { type: 'image/png' }),
    );
    const remove = await screen.findByRole('button', { name: 'Remove logo' });
    const style = getComputedStyle(remove);
    expect(style.backgroundColor).toBe('rgb(211, 47, 47)');
    expect(style.minWidth).toBe('24px');
    expect(style.minHeight).toBe('24px');
    remove.focus();
    expect(remove).toHaveFocus();
    await user.click(remove);
    expect(screen.queryByRole('button', { name: 'Remove logo' })).not.toBeInTheDocument();
  });
});

describe('Training Mode', () => {
  it('sits in the top right of the Settings tab with the legacy label and a description', async () => {
    renderPage();
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'Training Mode' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Disabled')).toBeVisible();
    expect(
      screen.getByText('Training Mode', { exact: false, selector: 'label span' }),
    ).toBeVisible();
    expect(toggle).toHaveAccessibleDescription(/Night Audit can only be run manually/);
    const row = screen.getByTestId('training-mode-row');
    expect(row).toContainElement(toggle);
    expect(getComputedStyle(row).justifyContent).toBe('flex-end');
    // Above the first section of the tab.
    const timeZone = screen.getByRole('heading', { name: 'Time Zone' });
    expect(
      toggle.compareDocumentPosition(timeZone) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('turns the label to Enabled, forces Run Manually and saves the setting', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await user.click(screen.getByRole('switch', { name: 'Training Mode' }));
    const on = screen.getByRole('switch', { name: 'Training Mode' });
    expect(on).toBeChecked();
    expect(screen.getByText('Enabled')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Run Manually' })).toBeChecked();
    const auto = screen.getByRole('radio', { name: 'Run Automatically' });
    expect(auto).toBeDisabled();
    expect(auto).toHaveAccessibleDescription(/not available in Training Mode/);
    await user.click(screen.getByRole('button', { name: /^(Save System Settings|Saved, System Settings)$/ }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0].trainingMode).toBe(true);
    expect(save.mock.calls[0][0].nightAudit).toBe('manual');
  });

  it('says so, once, after Training Mode is turned off again having forced Run Manually', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await user.click(screen.getByRole('switch', { name: 'Training Mode' }));
    expect(screen.queryByText(/was set to Run Manually/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Training Mode' }));
    expect(screen.getByText(/was set to Run Manually/)).toBeInTheDocument();
  });

  it('counts as an unsaved change for Confirm Leaving (the Save button enables)', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.getByRole('button', { name: /^(Save System Settings|Saved, System Settings)$/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('switch', { name: 'Training Mode' }));
    expect(screen.getByRole('button', { name: /^(Save System Settings|Saved, System Settings)$/ })).not.toHaveAttribute('aria-disabled');
  });
});

describe('System Settings typography', () => {
  it('uses the settings-scoped theme sizes: smaller than the first build, input text unchanged', async () => {
    renderPage();
    await loaded();
    expect(fontPx(screen.getByRole('heading', { level: 1, name: 'System Settings' }))).toBe(16.67);
    expect(fontPx(screen.getByRole('heading', { name: 'Time Zone' }))).toBe(13.33);
    expect(fontPx(screen.getByText('Run Manually'))).toBe(14.67);
    expect(fontPx(screen.getByRole('tab', { name: 'Folio Details' }))).toBe(12.67);
    expect(fontPx(screen.getByLabelText('Check In Time'))).toBe(16);
    // Legacy weights: bold title and headings, regular labels.
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Time Zone' })).fontWeight).toBe(
      '700',
    );
    expect(getComputedStyle(screen.getByText('Run Manually')).fontWeight).toBe('400');
    expect(getComputedStyle(screen.getByText('Run Manually')).fontFamily).toContain('Roboto');
  });
});

describe('Registration Card preview dialog', () => {
  const open = async (client?: ApiClient) => {
    const user = userEvent.setup();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Registration Card' }));
    const button = screen.getByRole('button', { name: 'Generate Preview' });
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Registration Card Preview' });
    return { user, button, dialog };
  };

  it('is a scrollable paper dialog capped at 800px and 90vh with a title bar and footer', async () => {
    const { dialog } = await open();
    expect(dialog).toHaveClass('MuiDialog-paper');
    const style = getComputedStyle(dialog);
    expect(style.maxWidth).toBe('800px');
    // 90vh, which jsdom resolves against its 768px window.
    expect(parseFloat(style.maxHeight)).toBeCloseTo(window.innerHeight * 0.9, 0);
    expect(dialog.closest('.MuiDialog-scrollPaper')).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Close preview' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Print' })).toBeInTheDocument();
    const content = dialog.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(getComputedStyle(content).overflowY).toBe('auto');
  });

  it('shows only the checked items, laid out as the mockup, with the LOGO placeholder', async () => {
    const { dialog } = await open();
    const card = within(dialog);
    expect(card.getByText('Pine Ridge Club')).toBeInTheDocument();
    expect(card.getByText('LOGO')).toBeInTheDocument();
    expect(card.getByRole('heading', { name: 'Registration Card' })).toBeInTheDocument();
    expect(card.getByText('#123456')).toBeInTheDocument();
    expect(card.getByText('Wed 10/21/26')).toBeInTheDocument();
    expect(card.getByText('Room 204')).toBeInTheDocument();
    expect(card.getByText('2 Adults, 2 Children')).toBeInTheDocument();
    expect(card.getByText('Jordan Rivers (M-10482)')).toBeInTheDocument();
    expect(card.getByText('Guest Signature')).toBeInTheDocument();
    // Unchecked by default: flags, reserver, notes, staff signature, room type.
    expect(card.queryByText('Early Check In')).not.toBeInTheDocument();
    expect(card.queryByText('Reserved By:')).not.toBeInTheDocument();
    expect(card.queryByText('Notes:')).not.toBeInTheDocument();
    expect(card.queryByText('Staff Signature')).not.toBeInTheDocument();
    expect(card.queryByText('(King Suite)')).not.toBeInTheDocument();
  });

  it('follows the checkboxes and hides Reserved By when the reserver is the guest', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Registration Card' }));
    for (const name of [
      'Check In Date',
      'Early Check In Flag',
      'Reserver Name (if unique)',
      'Public Reservation Notes',
      'Staff Signature Area',
    ]) {
      const box = screen.getByRole('checkbox', { name });
      if (!(box as HTMLInputElement).checked) await user.click(box);
    }
    await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
    const card = within(await screen.findByRole('dialog'));
    expect(card.getByText('Early Check In')).toBeInTheDocument();
    expect(card.getByText('Reserved By:')).toBeInTheDocument();
    expect(card.getByText('Sam Ortega (M-20931)')).toBeInTheDocument();
    expect(card.getByText('Late arrival expected after 9 PM.')).toBeInTheDocument();
    expect(card.getByText('Staff Signature')).toBeInTheDocument();
  });

  it('has a keyboard-reachable scroll region and says the data is a sample', async () => {
    const { dialog } = await open();
    const region = within(dialog).getByRole('region', { name: 'Registration card preview' });
    expect(region).toHaveAttribute('tabindex', '0');
    region.focus();
    expect(region).toHaveFocus();
    expect(within(dialog).getByText('Sample reservation')).toBeInTheDocument();
    expect(region).toContainElement(screen.getByTestId('registration-card-sheet'));
  });

  it('uses the Folio Details logo when one is saved', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Folio Details' }));
    await user.upload(
      screen.getByLabelText('Logo file'),
      new File(['x'], 'logo.png', { type: 'image/png' }),
    );
    await screen.findByRole('button', { name: 'Remove logo' });
    await user.click(screen.getByRole('tab', { name: 'Registration Card' }));
    await user.click(screen.getByRole('button', { name: 'Generate Preview' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'Logo' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\//),
    );
    expect(within(dialog).queryByText('LOGO')).not.toBeInTheDocument();
  });

  it('closes with X, Close, Escape and the backdrop, and returns focus to Generate Preview', async () => {
    const { user, button, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Close preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    await user.click(button);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    await user.click(button);
    await screen.findByRole('dialog');
    await user.click(document.querySelector('.MuiBackdrop-root') as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('traps focus inside the dialog', async () => {
    const { user, dialog } = await open();
    for (let i = 0; i < 6; i += 1) await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('Training Mode in a view-only page', () => {
  it('disables the switch', async () => {
    const { default: TrainingModeToggle } =
      await import('../components/admin/systemSettings/TrainingModeToggle');
    const { mockSystemSettings } = await import('../api/systemSettingsData');
    render(
      <ThemeProvider theme={theme}>
        <TrainingModeToggle value={mockSystemSettings()} onChange={() => {}} errors={{}} readOnly />
      </ThemeProvider>,
    );
    expect(screen.getByRole('switch', { name: 'Training Mode' })).toBeDisabled();
  });
});
