import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient, ScheduleQuery, SystemSettings } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { clubTodayIso } from '../lib/clubTime';
import { todayIso } from '../lib/dates';
import { theme } from '../theme';
import Schedule from './Schedule';

// 2026-10-25 03:30 UTC: depending on the zone it is the 24th, the 25th or (far east) the 26th.
const NOW = new Date('2026-10-25T03:30:00Z');

/** A zone whose date differs from the browser's at NOW, whatever zone the tests run in. */
function otherZone(): { zone: string; date: string } {
  const browser = todayIso(NOW);
  for (const zone of ['Pacific/Kiritimati', 'Etc/GMT+12', 'America/Los_Angeles']) {
    const date = clubTodayIso(zone, NOW);
    if (date !== browser) return { zone, date };
  }
  throw new Error('no zone differs from the browser date');
}

function setup(url: string, settings: () => Promise<SystemSettings>) {
  const base = createMockClient({ today: '2026-10-24' });
  const get = vi.fn((q: ScheduleQuery, o?: { signal?: AbortSignal }) => base.schedule.get(q, o));
  const client: ApiClient = {
    ...base,
    schedule: { ...base.schedule, get },
    systemSettings: { ...base.systemSettings, get: settings },
  };
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule />} />
            </Routes>
          </MemoryRouter>
        </SystemSettingsProvider>
      </ApiProvider>
    </ThemeProvider>,
  );
  return { get, base };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Schedule on the club clock', () => {
  it('holds the first fetch until the settings arrive, then starts on the club date, once', async () => {
    const { zone, date } = otherZone();
    const base = createMockClient();
    const stored = await base.systemSettings.get();
    let release!: () => void;
    const settings = () =>
      new Promise<SystemSettings>((resolve) => {
        release = () => resolve({ ...stored, timeZone: zone });
      });
    const { get } = setup('/schedule', settings);
    // Settings pending: the skeleton shows and no range has been fetched.
    expect(await screen.findByRole('status', { name: 'Loading schedule' })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith({ startDate: date, days: 7 }, expect.anything());
    // The today column is the club's date.
    const today = await screen.findByRole('columnheader', { current: 'date' });
    expect(today).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to the browser date and fetches when the settings fail', async () => {
    const { get } = setup('/schedule', () => Promise.reject(new Error('down')));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith({ startDate: todayIso(NOW), days: 7 }, expect.anything());
  });

  it('never moves or waits for a start in the URL', async () => {
    const { zone } = otherZone();
    const base = createMockClient();
    const stored = await base.systemSettings.get();
    let release!: () => void;
    const { get } = setup(
      '/schedule?start=2026-10-01',
      () =>
        new Promise<SystemSettings>((resolve) => {
          release = () => resolve({ ...stored, timeZone: zone });
        }),
    );
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith({ startDate: '2026-10-01', days: 7 }, expect.anything());
    await act(async () => release());
    await screen.findByRole('grid', { name: 'Schedule' });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
