// SSO Admin (owner request 2026-10-25): a greyed, display-only lookup, first on the Settings tab.
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess, saveButtonName } from '../app/testing';
import { theme } from '../theme';
import SystemSettings from './SystemSettings';

function renderPage(client = createMockClient(), readOnly = false) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <GrantedAccess>
            <MemoryRouter initialEntries={['/admin/primary-setup']}>
              <SystemSettings readOnly={readOnly} />
            </MemoryRouter>
          </GrantedAccess>
        </SystemSettingsProvider>
      </ApiProvider>
    </ThemeProvider>,
  );
}
const loaded = () => screen.findByRole('combobox', { name: 'Time Zone' });
const sso = () => screen.getByRole('combobox', { name: 'SSO Admin' });

describe('SSO Admin field', () => {
  it('is the first section of the left column, above Time Zone', async () => {
    renderPage();
    const timeZone = await loaded();
    expect(sso()).toBeInTheDocument();
    expect(
      screen.getByText('SSO Admin', { selector: 'h2, h3, h4, h5, h6, legend, p' }),
    ).toBeVisible();
    expect(sso().compareDocumentPosition(timeZone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shares the top row with Training Mode, before the first column', async () => {
    renderPage();
    const timeZone = await loaded();
    const toggle = screen.getByRole('switch', { name: 'Training Mode' });
    const row = screen.getByTestId('training-mode-row');
    // Same grid, adjacent cells (SSO Admin then Training Mode), both ahead of Time Zone.
    const ssoCell = sso().closest('section')?.parentElement;
    expect(row.parentElement?.parentElement).toBe(ssoCell?.parentElement);
    expect(row.parentElement?.previousElementSibling).toBe(ssoCell);
    expect(
      toggle.compareDocumentPosition(timeZone) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('is a disabled control showing Admin User with a described, non-actionable search icon', async () => {
    renderPage();
    await loaded();
    expect(sso()).toBeDisabled();
    expect(sso()).toHaveValue('Admin User');
    expect(sso()).toHaveAccessibleDescription('Managed by single sign-on. Not editable yet.');
    expect(screen.getByRole('button', { name: 'Search SSO Admin' })).toBeDisabled();
  });

  it('is still there in view mode', async () => {
    renderPage(createMockClient(), true);
    await loaded();
    expect(sso()).toBeDisabled();
    expect(sso()).toHaveValue('Admin User');
  });

  it('is still there with Training Mode on', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('switch', { name: 'Training Mode' }));
    expect(sso()).toBeDisabled();
    expect(sso()).toHaveValue('Admin User');
  });

  it('does not make the draft dirty and is not sent when saving', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await loaded();
    expect(screen.getByRole('button', { name: saveButtonName('System Settings') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const label = screen.getByLabelText('Label');
    await user.type(label, 'x');
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(save.mock.calls[0][0])).not.toMatch(/sso|Admin User/i);
  });
});
