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
      changeRoomDuringStay: (r, o) =>
        client().then((c) => c.reservations.changeRoomDuringStay(r, o)),
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
    settings: {
      getBookingHold: (o) => client().then((c) => c.settings.getBookingHold(o)),
      getRoomChangeRule: (o) => client().then((c) => c.settings.getRoomChangeRule(o)),
    },
    permissions: { getGrant: (o) => client().then((c) => c.permissions.getGrant(o)) },
  };
}
