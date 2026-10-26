import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { theme } from '../theme';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { pagePermission, type PermissionPageId } from '../app/permissions';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import RequireAccess from '../components/RequireAccess';
import AddOnItems from './AddOnItems';
import BookingRules from './BookingRules';
import KeycardIntegration from './KeycardIntegration';
import Locations from './Locations';
import Permissions from './Permissions';
import RateCategories from './RateCategories';
import RoomOptions from './RoomOptions';
import Rooms from './Rooms';
import RoomTypes from './RoomTypes';
import SystemSettings from './SystemSettings';

// View-only mode of every Admin Setup page (ticket 186): a user holding only `page.<id>` sees the
// values, every field is disabled, and there is no Save, Add, Remove, Copy, Delete or Reorder.
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
  ['permissions', <Permissions />],
];

const ACTION =
  /^(save|saved|saving|add|new|remove|delete|copy|duplicate|select all|select none|retrieve|cancel|reorder)\b/i;

function renderViewOnly(id: PermissionPageId, page: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={createMockClient()}>
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

describe.each(PAGES)('View-only %s', (id, page) => {
  it('shows the note, no actions and only disabled fields', async () => {
    const { container } = renderViewOnly(id, page);
    expect(await screen.findByTestId('read-only-note', {}, { timeout: 4000 })).toHaveTextContent(
      'View only',
    );
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
    // Let the page's first load settle.
    await new Promise((r) => setTimeout(r, 50));

    const actions = screen
      .queryAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
      .filter((name) => ACTION.test(name.trim()) && !/^Retry$/.test(name.trim()));
    expect(actions).toEqual([]);

    const enabledFields = [
      ...container.querySelectorAll<HTMLElement>(
        'input:not([type=hidden]):not([type=file]), textarea, select',
      ),
    ]
      // The hidden measuring textarea of a multiline field is not a control.
      .filter(
        (el) => !(el as HTMLInputElement).disabled && el.getAttribute('aria-hidden') !== 'true',
      )
      .map((el) => el.outerHTML.slice(0, 160));
    expect(enabledFields).toEqual([]);
    const openCombos = [...container.querySelectorAll('[role=combobox]')].filter(
      (el) => el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLInputElement).disabled,
    );
    expect(openCombos).toHaveLength(0);
  });
});
