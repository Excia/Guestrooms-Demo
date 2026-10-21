import type { ApiClient } from './types';

/**
 * An ApiClient that loads its implementation on first use, so code behind `load` (the mock and
 * its data) lands in a separate chunk and real-URL builds never fetch it.
 */
export function createLazyClient(load: () => Promise<ApiClient>): ApiClient {
  let loaded: Promise<ApiClient> | undefined;
  const client = () =>
    (loaded ??= load().catch((error) => {
      loaded = undefined; // let the next call retry
      throw error;
    }));
  return {
    dashboard: {
      getStats: (o) => client().then((c) => c.dashboard.getStats(o)),
      getQuickStats: (q, o) => client().then((c) => c.dashboard.getQuickStats(q, o)),
    },
    reservations: {
      list: (q, o) => client().then((c) => c.reservations.list(q, o)),
      get: (id, o) => client().then((c) => c.reservations.get(id, o)),
      getDetail: (id, o) => client().then((c) => c.reservations.getDetail(id, o)),
      setEarlyLate: (r, o) => client().then((c) => c.reservations.setEarlyLate(r, o)),
      create: (r, o) => client().then((c) => c.reservations.create(r, o)),
    },
    schedule: {
      get: (q, o) => client().then((c) => c.schedule.get(q, o)),
      moveRoom: (r, o) => client().then((c) => c.schedule.moveRoom(r, o)),
      moveDates: (r, o) => client().then((c) => c.schedule.moveDates(r, o)),
    },
    members: {
      search: (q, o) => client().then((c) => c.members.search(q, o)),
      create: (r, o) => client().then((c) => c.members.create(r, o)),
    },
    folios: {
      get: (id, o) => client().then((c) => c.folios.get(id, o)),
      postCharge: (r, o) => client().then((c) => c.folios.postCharge(r, o)),
    },
    settings: { getBookingHold: (o) => client().then((c) => c.settings.getBookingHold(o)) },
    systemSettings: {
      get: (o) => client().then((c) => c.systemSettings.get(o)),
      save: (s, o) => client().then((c) => c.systemSettings.save(s, o)),
      getOptions: (o) => client().then((c) => c.systemSettings.getOptions(o)),
    },
    bookingRules: {
      get: (o) => client().then((c) => c.bookingRules.get(o)),
      save: (r, o) => client().then((c) => c.bookingRules.save(r, o)),
      getOptions: (o) => client().then((c) => c.bookingRules.getOptions(o)),
    },
    permissions: { getGrant: (o) => client().then((c) => c.permissions.getGrant(o)) },
  };
}
