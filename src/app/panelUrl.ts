import { isValidIsoDate, type IsoDate } from '../lib/dates';

// The reservation panel's state in the schedule's URL, next to the schedule's own parameters
// (start, view, locations, types, rooms), so reload, Back/Forward and links reopen it and closing
// it leaves the view (date range, length, filters) exactly as it was.
//   ?res=<reservationId>[&rr=<reservationRoomId>]   details of a reservation (and one of its rooms)
//   ?panel=new[&room=<roomId>&arrival=<date>]       the New Reservation panel (room and Check In prefilled)
export type PanelState =
  | { kind: 'details'; reservationId: string; reservationRoomId?: string }
  /** `roomId` and `arrival` prefill the form when opened from an empty grid cell. */
  | { kind: 'new'; roomId?: string; arrival?: IsoDate }
  | null;

const KEYS = {
  reservation: 'res',
  room: 'rr',
  panel: 'panel',
  newRoom: 'room',
  newArrival: 'arrival',
} as const;

/** Ids end up in API paths: keep them short and free of path tricks. */
function cleanId(value: string | null): string | null {
  if (value === null) return null;
  const id = value.trim();
  return id === '' || id === '.' || id === '..' || id.length > 128 ? null : id;
}

export function parsePanel(params: URLSearchParams): PanelState {
  if (params.get(KEYS.panel) === 'new') {
    const roomId = cleanId(params.get(KEYS.newRoom));
    const arrival = params.get(KEYS.newArrival);
    return {
      kind: 'new',
      ...(roomId ? { roomId } : {}),
      ...(arrival && isValidIsoDate(arrival) ? { arrival } : {}),
    };
  }
  const reservationId = cleanId(params.get(KEYS.reservation));
  if (!reservationId) return null;
  const reservationRoomId = cleanId(params.get(KEYS.room));
  return reservationRoomId
    ? { kind: 'details', reservationId, reservationRoomId }
    : { kind: 'details', reservationId };
}

/** `params` with only the panel fields replaced; every other parameter is kept. */
export function applyPanel(params: URLSearchParams, panel: PanelState): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(KEYS.reservation);
  next.delete(KEYS.room);
  next.delete(KEYS.panel);
  next.delete(KEYS.newRoom);
  next.delete(KEYS.newArrival);
  if (panel?.kind === 'new') {
    next.set(KEYS.panel, 'new');
    if (panel.roomId) next.set(KEYS.newRoom, panel.roomId);
    if (panel.arrival) next.set(KEYS.newArrival, panel.arrival);
  }
  if (panel?.kind === 'details') {
    next.set(KEYS.reservation, panel.reservationId);
    if (panel.reservationRoomId) next.set(KEYS.room, panel.reservationRoomId);
  }
  return next;
}

/** "Back to schedule" and closing: the same URL without the panel. */
export const closePanel = (params: URLSearchParams): URLSearchParams => applyPanel(params, null);
