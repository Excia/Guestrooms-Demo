import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { mockRoomTypes } from '../api/roomSetupData';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import { clubTodayIso } from '../lib/clubTime';
import { todayIso } from '../lib/dates';
import RoomTypes from './RoomTypes';

// 2026-10-25 03:30 UTC: the club zone below is on a different date than the browser.
const NOW = new Date('2026-10-25T03:30:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Room Types list on the club clock', () => {
  it('tags a room type by the club date, not the browser date', async () => {
    const browser = todayIso(NOW);
    const zone = ['Pacific/Kiritimati', 'Etc/GMT+12'].find((z) => clubTodayIso(z, NOW) !== browser);
    if (!zone) throw new Error('no zone differs from the browser date');
    const club = clubTodayIso(zone, NOW);
    // Ends on the earlier of the two dates: active only while the club date is that earlier one.
    const earlier = club < browser ? club : browser;
    const base = createMockClient();
    const types = mockRoomTypes().map((t) => (t.id === 'rt-king' ? { ...t, endDate: earlier } : t));
    const client: ApiClient = {
      ...base,
      roomSetup: { ...base.roomSetup, listRoomTypes: () => Promise.resolve(types) },
      systemSettings: {
        ...base.systemSettings,
        get: async () => ({ ...(await base.systemSettings.get()), timeZone: zone }),
      },
    };
    render(
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <GrantedAccess>
            <MemoryRouter initialEntries={['/admin/room-types']}>
              <RoomTypes />
            </MemoryRouter>
          </GrantedAccess>
        </SystemSettingsProvider>
      </ApiProvider>,
    );
    await screen.findByRole('textbox', { name: /Room Type Name/ });
    const king = await screen.findByRole('button', { name: /King Room/ });
    const tagged = within(king).queryByText('Inactive') !== null;
    expect(tagged).toBe(club > earlier);
  });
});
