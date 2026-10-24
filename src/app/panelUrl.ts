import { CLOSURE_DESCRIPTION_MAX } from './closures';
import { isValidIsoDate, type IsoDate } from '../lib/dates';

// The reservation panel's state in the schedule's URL, next to the schedule's own parameters
// (start, view, locations, types, rooms), so reload, Back/Forward and links reopen it and closing
// it leaves the view (date range, length, filters) exactly as it was.
//   ?res=<reservationId>[&rr=<reservationRoomId>]   details of a reservation (and one of its rooms)
//   ?panel=new[&room=<roomId>&arrival=<date>]       the New Reservation panel (room and Check In prefilled)
//   ?panel=new&tab=closure[&room=&arrival=&end=&desc=]  its New Room Closure tab (start, end and description prefilled)
//   ?closure=<closureId>                            the Closure details panel
export type PanelState =
  | { kind: 'details'; reservationId: string; reservationRoomId?: string }
  /** `roomId` and `arrival` prefill the form when opened from an empty grid cell. */
  | {
      kind: 'new';
      roomId?: string;
      arrival?: IsoDate;
      /** The New Room Closure tab; `arrival` is then its start. */
      tab?: 'closure';
      /** Closure end and description, when duplicating a closure. */
      end?: IsoDate;
      description?: string;
    }
  | { kind: 'closure'; closureId: string }
  | null;

const KEYS = {
  reservation: 'res',
  room: 'rr',
  panel: 'panel',
  newRoom: 'room',
  newArrival: 'arrival',
  tab: 'tab',
  end: 'end',
  description: 'desc',
  closure: 'closure',
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
    const closureTab = params.get(KEYS.tab) === 'closure';
    const end = params.get(KEYS.end);
    const description = (params.get(KEYS.description) ?? '')
      .trim()
      .slice(0, CLOSURE_DESCRIPTION_MAX);
    return {
      kind: 'new',
      ...(roomId ? { roomId } : {}),
      ...(arrival && isValidIsoDate(arrival) ? { arrival } : {}),
      ...(closureTab ? { tab: 'closure' as const } : {}),
      ...(closureTab && end && isValidIsoDate(end) ? { end } : {}),
      ...(closureTab && description ? { description } : {}),
    };
  }
  const closureId = cleanId(params.get(KEYS.closure));
  if (closureId) return { kind: 'closure', closureId };
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
  next.delete(KEYS.tab);
  next.delete(KEYS.end);
  next.delete(KEYS.description);
  next.delete(KEYS.closure);
  if (panel?.kind === 'new') {
    next.set(KEYS.panel, 'new');
    if (panel.roomId) next.set(KEYS.newRoom, panel.roomId);
    if (panel.arrival) next.set(KEYS.newArrival, panel.arrival);
    if (panel.tab) next.set(KEYS.tab, panel.tab);
    if (panel.end) next.set(KEYS.end, panel.end);
    if (panel.description) next.set(KEYS.description, panel.description);
  }
  if (panel?.kind === 'closure') next.set(KEYS.closure, panel.closureId);
  if (panel?.kind === 'details') {
    next.set(KEYS.reservation, panel.reservationId);
    if (panel.reservationRoomId) next.set(KEYS.room, panel.reservationRoomId);
  }
  return next;
}

/** "Back to schedule" and closing: the same URL without the panel. */
export const closePanel = (params: URLSearchParams): URLSearchParams => applyPanel(params, null);
