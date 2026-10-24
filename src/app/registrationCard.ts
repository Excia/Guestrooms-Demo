// Business rules of the Registration Card (ticket 7.8): item dependencies, validation and what the
// card shows for a reservation. Pure functions; the settings tab, the mock and the backend's PDF
// generator share the rules.
import {
  REGISTRATION_CARD_ITEM_IDS,
  type RegistrationCardItemId,
  type RegistrationCardReservation,
  type RegistrationCardSettings,
} from '../api/registrationCardTypes';
import type { FolioDetails, ReservationDetail } from '../api/types';
import { parseIsoDate } from '../lib/dates';
import { formatMoney } from './quickStats';

export const REGISTRATION_CARD_CUSTOM_TEXT_MAX = 500;

export const ITEM_LABELS: Record<RegistrationCardItemId, string> = {
  folioHeader: 'Include Folio Header',
  confirmationNumber: 'Confirmation Number',
  checkInDate: 'Check In Date',
  checkOutDate: 'Check Out Date',
  earlyCheckInFlag: 'Early Check In Flag',
  lateCheckOutFlag: 'Late Check Out Flag',
  roomNumber: 'Room Number',
  roomType: 'Room Type',
  guestCount: 'Guest Count',
  averageRoomRate: 'Average Room Rate',
  leadOccupantName: 'Lead Occupant Name',
  leadOccupantAddress: 'Lead Occupant Address',
  leadOccupantPhone: 'Lead Occupant Phone Number',
  reserverName: 'Reserver Name (if unique)',
  reserverPhone: 'Reserver Phone Number (if unique)',
  publicNotes: 'Public Reservation Notes',
  customText: 'Custom Text',
  guestSignature: 'Guest Signature Area',
  staffSignature: 'Staff Signature Area',
};

/**
 * An item that only makes sense while another is checked ("if the name is unchecked, its phone or
 * address is disabled"; a flag sits under its date, Figma 15957:187205).
 */
export const ITEM_PARENT: Partial<Record<RegistrationCardItemId, RegistrationCardItemId>> = {
  leadOccupantAddress: 'leadOccupantName',
  leadOccupantPhone: 'leadOccupantName',
  reserverPhone: 'reserverName',
  earlyCheckInFlag: 'checkInDate',
  lateCheckOutFlag: 'checkOutDate',
};

/** Rows of the item grid as Figma 13319:41951 draws it: left column, right column (null: empty). */
export const ITEM_GRID: readonly (readonly [
  RegistrationCardItemId,
  RegistrationCardItemId | null,
])[] = [
  ['folioHeader', 'confirmationNumber'],
  ['checkInDate', 'checkOutDate'],
  ['earlyCheckInFlag', 'lateCheckOutFlag'],
  ['roomNumber', 'guestCount'],
  ['roomType', null],
  ['averageRoomRate', null],
  ['leadOccupantName', 'reserverName'],
  ['leadOccupantPhone', 'reserverPhone'],
  ['leadOccupantAddress', null],
  ['publicNotes', null],
  ['customText', null],
  ['guestSignature', 'staffSignature'],
];

/** The state Figma draws: the default card. */
export const defaultRegistrationCard = (): RegistrationCardSettings => ({
  enabled: true,
  items: {
    ...Object.fromEntries(REGISTRATION_CARD_ITEM_IDS.map((id) => [id, false])),
    folioHeader: true,
    confirmationNumber: true,
    checkInDate: true,
    checkOutDate: true,
    roomNumber: true,
    guestCount: true,
    leadOccupantName: true,
    customText: true,
    guestSignature: true,
  } as RegistrationCardSettings['items'],
  customText: '',
});

/** True when the item cannot be changed because the item it depends on is unchecked. */
export function isItemDisabled(
  items: RegistrationCardSettings['items'],
  id: RegistrationCardItemId,
): boolean {
  const parent = ITEM_PARENT[id];
  return parent !== undefined && !items[parent];
}

/**
 * Checks or unchecks an item. Unchecking an item also unchecks those that depend on it (a name's phone
 * and address, a date's flag), so a disabled box never shows a tick the card would not honor.
 */
export function setItem(
  items: RegistrationCardSettings['items'],
  id: RegistrationCardItemId,
  checked: boolean,
): RegistrationCardSettings['items'] {
  if (isItemDisabled(items, id)) return items;
  const next = { ...items, [id]: checked };
  if (!checked) {
    for (const [child, parent] of Object.entries(ITEM_PARENT)) {
      if (parent === id) next[child as RegistrationCardItemId] = false;
    }
  }
  return next;
}

/** The items the card honors: a dependent item counts only while its parent is checked. */
export function effectiveItems(
  items: RegistrationCardSettings['items'],
): RegistrationCardSettings['items'] {
  const out = { ...items };
  for (const id of REGISTRATION_CARD_ITEM_IDS) {
    if (isItemDisabled(items, id)) out[id] = false;
  }
  return out;
}

/** Message for the custom text, or null. */
export function customTextProblem(text: string): string | null {
  return text.length > REGISTRATION_CARD_CUSTOM_TEXT_MAX
    ? `Use ${REGISTRATION_CARD_CUSTOM_TEXT_MAX} characters or fewer.`
    : null;
}

// ---- what the card shows -------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "2026-10-21" becomes "Wed 10/21/26" (Figma "Day MM/DD/YY"); the input again when invalid. */
export function formatCardDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${WEEKDAYS[d.getUTCDay()]} ${two(d.getUTCMonth() + 1)}/${two(d.getUTCDate())}/${two(d.getUTCFullYear() % 100)}`;
}

/** Weighted average rate: total room revenue over total nights, rounded to the cent (D-005); null for no nights. */
export function averageRoomRateCents(totalCents: number, nights: number): number | null {
  return nights > 0 ? Math.round(totalCents / nights) : null;
}

/** "2 Adults, 2 Children"; zero counts are left out, and one is singular. */
export function formatGuestCount(adults: number, children: number): string {
  const part = (n: number, one: string, many: string) =>
    n > 0 ? `${n} ${n === 1 ? one : many}` : null;
  return [part(adults, 'Adult', 'Adults'), part(children, 'Child', 'Children')]
    .filter(Boolean)
    .join(', ');
}

/** The folio header lines (Figma: name, address, city and state, phone, email); empty parts are skipped. */
export function folioHeaderLines(folio: FolioDetails, systemName: string): string[] {
  const cityLine = [folio.city.trim(), [folio.state, folio.zip.trim()].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [
    systemName.trim(),
    folio.streetAddress.trim(),
    cityLine,
    folio.phone.trim() ? `Phone: ${folio.phone.trim()}` : '',
    folio.email.trim() ? `Email: ${folio.email.trim()}` : '',
  ].filter((line) => line !== '');
}

/** True when the reserver is someone other than the lead occupant ("if unique"). */
export function isUniqueReserver(r: RegistrationCardReservation): boolean {
  if (!r.reserver) return false;
  const a = r.reserver;
  const b = r.leadOccupant;
  if (a.memberNumber && b.memberNumber) return a.memberNumber !== b.memberNumber;
  return a.name.trim().toLowerCase() !== b.name.trim().toLowerCase();
}

export interface RegistrationCardModel {
  /** Folio header lines; null when Include Folio Header is off. */
  header: { lines: string[]; logo: string | null } | null;
  confirmationNumber: string | null;
  checkIn: { date: string; flag: string | null } | null;
  checkOut: { date: string; flag: string | null } | null;
  /** "[Room #] ([Room Type], [Room Rate])" with only the checked parts. */
  room: string | null;
  guestCount: string | null;
  guest: string[] | null;
  /** Null when Reserver Name is off, there is no reserver, or the reserver is the lead occupant. */
  reservedBy: string[] | null;
  notes: string | null;
  customText: string | null;
  guestSignature: boolean;
  staffSignature: boolean;
}

const named = (name: string, memberNumber: string | null) =>
  memberNumber ? `${name} (${memberNumber})` : name;

/**
 * What the card prints for a reservation: only the checked items, a phone or address only with its
 * name, and no "Reserved By" block unless the reserver is a different person.
 */
export function buildRegistrationCard(
  settings: RegistrationCardSettings,
  reservation: RegistrationCardReservation,
  folio: FolioDetails,
  systemName = '',
): RegistrationCardModel {
  const on = effectiveItems(settings.items);
  const r = reservation;

  const roomParts: string[] = [];
  if (on.roomType) roomParts.push(r.roomType);
  if (on.averageRoomRate) {
    const rate = averageRoomRateCents(r.stayTotalCents, r.nights);
    if (rate !== null) roomParts.push(formatMoney(rate));
  }
  const bracket = roomParts.length ? `(${roomParts.join(', ')})` : '';
  const room = [on.roomNumber ? r.roomNumber : '', bracket].filter(Boolean).join(' ') || null;

  const guest = on.leadOccupantName
    ? [
        named(r.leadOccupant.name, r.leadOccupant.memberNumber),
        ...(on.leadOccupantPhone && r.leadOccupant.phone ? [r.leadOccupant.phone] : []),
        ...(on.leadOccupantAddress ? addressLines(r.leadOccupant.address) : []),
      ]
    : null;

  const reservedBy =
    on.reserverName && r.reserver && isUniqueReserver(r)
      ? [
          named(r.reserver.name, r.reserver.memberNumber),
          ...(on.reserverPhone && r.reserver.phone ? [r.reserver.phone] : []),
        ]
      : null;

  const custom = settings.customText.trim();
  const notes = r.publicNotes.trim();
  return {
    header: on.folioHeader
      ? { lines: folioHeaderLines(folio, systemName), logo: folio.logo }
      : null,
    confirmationNumber: on.confirmationNumber ? `#${r.confirmationNumber}` : null,
    checkIn: on.checkInDate
      ? {
          date: formatCardDate(r.checkIn),
          flag: on.earlyCheckInFlag && r.earlyCheckIn ? 'Early Check In' : null,
        }
      : null,
    checkOut: on.checkOutDate
      ? {
          date: formatCardDate(r.checkOut),
          flag: on.lateCheckOutFlag && r.lateCheckOut ? 'Late Check Out' : null,
        }
      : null,
    room,
    guestCount: on.guestCount ? formatGuestCount(r.adults, r.children) || null : null,
    guest,
    reservedBy,
    notes: on.publicNotes && notes ? notes : null,
    customText: on.customText && custom ? custom : null,
    guestSignature: on.guestSignature,
    staffSignature: on.staffSignature,
  };
}

function addressLines(a: RegistrationCardReservation['leadOccupant']['address']): string[] {
  const cityLine = [a.city.trim(), [a.state, a.zip.trim()].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [a.street.trim(), cityLine].filter(Boolean);
}

/**
 * Only a web address, a blob or a site path may be opened in a new tab; anything else the backend
 * might send (a `javascript:` address, say) is refused. The address is resolved the way a browser
 * does (it drops tabs and turns `\\` into `/`), so `/\\evil.example.com` is seen as another host.
 */
export function isOpenablePreviewUrl(url: string): boolean {
  if (url.trim() === '' || typeof window === 'undefined') return false;
  try {
    const origin = window.location.origin;
    const resolved = new URL(url, origin);
    if (resolved.protocol === 'blob:') return true;
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      // A relative or same-origin address is a site path; a different host must have been written out.
      return resolved.origin === origin || /^https?:\/\//i.test(url);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * What a real reservation prints on its card. The reservation detail does not carry the lead
 * occupant's phone or address or a separate reserver yet, so those stay empty (the backend fills
 * them from the guest record); the room, dates and revenue are the selected room's.
 */
export function registrationCardReservation(
  detail: ReservationDetail,
  roomId?: string,
): RegistrationCardReservation {
  const room = detail.rooms.find((r) => r.id === roomId) ?? detail.rooms[0];
  const own = detail.stay.lines.filter((l) => l.reservationRoomId === room?.id);
  const lines = own.length > 0 ? own : detail.stay.lines;
  return {
    confirmationNumber: detail.confirmationNumber,
    checkIn: detail.arrival,
    checkOut: detail.departure,
    earlyCheckIn: detail.earlyCheckIn,
    lateCheckOut: detail.lateCheckOut,
    roomNumber: room?.roomNumber ?? '',
    roomType: room?.roomTypeName ?? '',
    adults: detail.adults,
    children: detail.children,
    stayTotalCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
    nights: lines.length > 0 ? lines.length : detail.nights,
    leadOccupant: {
      name: detail.leadOccupant.name,
      memberNumber: detail.leadOccupant.memberNumber,
      phone: '',
      address: { street: '', city: '', state: '', zip: '' },
    },
    reserver: null,
    publicNotes: detail.publicNotes,
  };
}
