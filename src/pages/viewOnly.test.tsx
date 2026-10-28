import { ADMIN_NAV } from '../app/adminNav';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { theme } from '../theme';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { pagePermission, type PermissionPageId } from '../app/permissions';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import RequireAccess from '../components/RequireAccess';
import AddOnItems from './AddOnItems';
import ApiIntegrations from './ApiIntegrations';
import BookingRules from './BookingRules';
import Employees from './Employees';
import KeycardIntegration from './KeycardIntegration';
import Locations from './Locations';
import Permissions from './Permissions';
import RateCategories from './RateCategories';
import RoomOptions from './RoomOptions';
import Rooms from './Rooms';
import RoomTypes from './RoomTypes';
import SystemSettings from './SystemSettings';

// View-only mode of every Admin Setup page (ticket 186): a user holding only `page.<id>` sees the
// values, every field is disabled, and there is no Save, Add, Remove, Copy, Delete or Reorder. Each
// list item and each tab of the page is opened and checked too.
const PAGES: readonly [PermissionPageId, ReactElement][] = [
  ['primary-setup', <SystemSettings />],
  ['locations', <Locations />],
  ['room-options', <RoomOptions />],
  ['booking-rules', <BookingRules />],
  ['rate-categories', <RateCategories />],
  ['room-types', <RoomTypes />],
  ['rooms', <Rooms />],
  ['add-on-items', <AddOnItems />],
  ['keycard-integration', <KeycardIntegration />],
  ['api-integrations', <ApiIntegrations />],
  ['employees', <Employees />],
  ['permissions', <Permissions />],
];

// Generate Preview (registration card) is read-only and stays (Q-186-5); Retry is an error action.
const ACTION =
  /^(save|saved|saving|add|new|remove|delete|copy|duplicate|select all|select none|clear|retrieve|cancel|reorder|upload|browse|set)\b/i;

async function seededClient(id: PermissionPageId) {
  const client = createMockClient();
  if (id === 'primary-setup') {
    // A saved folio logo, so the Remove badge branch is rendered (and must be hidden).
    const settings = await client.systemSettings.get();
    await client.systemSettings.save({
      ...settings,
      folio: { ...settings.folio, logo: 'data:image/png;base64,iVBORw0KGgo=' },
    });
  }
  return client;
}

function renderViewOnly(id: PermissionPageId, page: ReactElement, client: ApiClient) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <GrantedAccess granted={[pagePermission(id)]}>
          <SystemSettingsProvider>
            <MemoryRouter>
              <RequireAccess pageId={id}>{page}</RequireAccess>
            </MemoryRouter>
          </SystemSettingsProvider>
        </GrantedAccess>
      </ApiProvider>
    </ThemeProvider>,
  );
}

/** What a View-only page must not offer, in whatever state it is now. */
function leaks(container: HTMLElement): string[] {
  const found: string[] = [];
  for (const b of screen.queryAllByRole('button')) {
    const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
    // A disabled left-navigation entry (a page the user cannot open, such as "Add-On Items") is not an action.
    if (b.hasAttribute('disabled') && ADMIN_NAV.some((n) => n.label === name)) continue;
    if (name === '') found.push(`unnamed button: ${b.outerHTML.slice(0, 80)}`);
    else if (ACTION.test(name)) found.push(`action: ${name}`);
  }
  const fields = container.querySelectorAll<HTMLInputElement>(
    'input:not([type=hidden]), textarea, select',
  );
  for (const el of fields) {
    // The hidden measuring textarea of a multiline field is not a control.
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (!el.disabled) found.push(`enabled field: ${el.outerHTML.slice(0, 120)}`);
  }
  for (const el of container.querySelectorAll('[role=combobox]')) {
    if (el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLInputElement).disabled) {
      found.push(`open combobox: ${el.outerHTML.slice(0, 120)}`);
    }
  }
  for (const el of container.querySelectorAll('[role=switch], [role=checkbox], [role=radio]')) {
    if (el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLInputElement).disabled) {
      found.push(`enabled toggle: ${el.outerHTML.slice(0, 120)}`);
    }
  }
  return found;
}

describe.each(PAGES)('View-only %s', (id, page) => {
  it('shows the note, no actions and only disabled fields, on every item and tab', async () => {
    const { container } = renderViewOnly(id, page, await seededClient(id));
    expect(await screen.findByTestId('read-only-note', {}, { timeout: 4000 })).toHaveTextContent(
      'View only',
    );
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(leaks(container)).toEqual([]);

    const user = userEvent.setup();
    // Every item of a setup list (rooms that do not inherit their details included).
    const nav = screen.queryByRole('navigation', { name: /^(?!Admin Setup)/ });
    if (nav) {
      const items = within(nav).queryAllByRole('listitem');

      for (const item of items) {
        const button = within(item).getAllByRole('button')[0] as HTMLElement;
        await user.click(button);
        await waitFor(() => expect(button).toHaveAttribute('aria-current', 'true'));
        // The selected item's form is drawn after the selection (an effect): let it settle.
        await act(async () => {});
        await act(async () => {});
        expect(leaks(container)).toEqual([]);
      }
    }
    // Every tab of the page and of its panels.
    for (const tab of screen.queryAllByRole('tab')) {
      if ((tab as HTMLButtonElement).disabled) continue;
      await user.click(tab);
      await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'));
      expect(leaks(container)).toEqual([]);
    }
  });
});

describe('View-only Employees', () => {
  it('says there are no employees (no blank form) when none exist', async () => {
    const view = render(
      <ThemeProvider theme={theme}>
        <ApiProvider client={createMockClient({ scenario: 'empty' })}>
          <GrantedAccess granted={[pagePermission('employees')]}>
            <MemoryRouter>
              <RequireAccess pageId="employees">
                <Employees />
              </RequireAccess>
            </MemoryRouter>
          </GrantedAccess>
        </ApiProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByText('No employees.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Employee' })).not.toBeInTheDocument();
    expect(leaks(view.container)).toEqual([]);
  });
});
