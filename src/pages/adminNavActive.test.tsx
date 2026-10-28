import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import AddOnItems from './AddOnItems';
import RateCategories from './RateCategories';
import RoomTypes from './RoomTypes';
import Rooms from './Rooms';

function renderPage(page: ReactElement, granted?: Parameters<typeof GrantedAccess>[0]['granted']) {
  render(
    <ApiProvider client={createMockClient()}>
      <SystemSettingsProvider>
        <GrantedAccess granted={granted}>
          <MemoryRouter>{page}</MemoryRouter>
        </GrantedAccess>
      </SystemSettingsProvider>
    </ApiProvider>,
  );
}

// The first render is the loading branch, which still shows the Admin Setup links.
describe('Admin Setup navigation on the setup-list pages', () => {
  it.each([
    ['Rate Categories', <RateCategories />],
    ['Room Types', <RoomTypes />],
    ['Rooms', <Rooms />],
    ['Add-On Items', <AddOnItems />],
  ] as const)('marks %s as the current page while loading', (label, page) => {
    renderPage(page);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Room Options' })).not.toHaveAttribute('aria-current');
  });

  it('shows a disabled Rooms button and no link without page.rooms', () => {
    renderPage(<Rooms />, ['page.room-types']);
    expect(screen.queryByRole('link', { name: 'Rooms' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rooms' })).toBeDisabled();
  });
});
