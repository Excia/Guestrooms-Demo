// Registration Card setting and PDF (ticket 7.8; Figma 13319:41951 and 15957:187196).
import type { FolioDetails, IsoDate, RequestOptions } from './types';

/** The items a club can print on the card, in the order of the ticket. */
export const REGISTRATION_CARD_ITEM_IDS = [
  'folioHeader',
  'confirmationNumber',
  'checkInDate',
  'checkOutDate',
  'earlyCheckInFlag',
  'lateCheckOutFlag',
  'roomNumber',
  'roomType',
  'guestCount',
  'averageRoomRate',
  'leadOccupantName',
  'leadOccupantAddress',
  'leadOccupantPhone',
  'reserverName',
  'reserverPhone',
  'publicNotes',
  'customText',
  'guestSignature',
  'staffSignature',
] as const;

export type RegistrationCardItemId = (typeof REGISTRATION_CARD_ITEM_IDS)[number];

export interface RegistrationCardSettings {
  /** "Enable Registration Card": a card prints at check in and Print Registration Card is offered. */
  enabled: boolean;
  items: Record<RegistrationCardItemId, boolean>;
  /** Printed above the signatures; at most 500 characters. */
  customText: string;
}

/** What the card is filled from; the backend builds it from the reservation. */
export interface RegistrationCardReservation {
  confirmationNumber: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  roomNumber: string;
  roomType: string;
  adults: number;
  children: number;
  /** Room revenue of the stay in cents (no taxes or service charges, D-005) and its nights. */
  stayTotalCents: number;
  nights: number;
  leadOccupant: {
    name: string;
    memberNumber: string | null;
    phone: string;
    address: { street: string; city: string; state: string; zip: string };
  };
  /** Null when the reservation has no reserver. */
  reserver: { name: string; memberNumber: string | null; phone: string } | null;
  publicNotes: string;
}

export interface RegistrationCardPreviewRequest {
  settings: RegistrationCardSettings;
  /** The folio header (System Settings, Folio Details) for Include Folio Header. */
  folio: FolioDetails;
  /**
   * Render this reservation instead of the sample one: the card of a real reservation uses the saved
   * settings. The backend normally builds it from its own copy of the reservation (by `reservationId`).
   */
  reservation?: RegistrationCardReservation;
}

export interface RegistrationCardApi {
  /**
   * Asks the backend to render a sample card from the given, possibly unsaved, settings. It answers
   * with the address of the PDF, which the UI opens in a new tab (D-003).
   */
  requestPreview(
    request: RegistrationCardPreviewRequest,
    options?: RequestOptions,
  ): Promise<{ url: string }>;
}
