// Mock Registration Card preview (ticket 7.8). The backend renders the PDF; until it exists the mock
// answers with the address of a printable HTML page laid out like the PDF frame (Figma 15957:187196),
// built from the same rules the backend must follow. PLACEHOLDER sample reservation (see
// docs/requirements/entries/95-registration-card.md).
import { buildRegistrationCard, type RegistrationCardModel } from '../app/registrationCard';
import type {
  RegistrationCardPreviewRequest,
  RegistrationCardReservation,
} from './registrationCardTypes';

/** A sample stay that exercises every item: early and late flags, a unique reserver, notes. */
export const SAMPLE_RESERVATION: RegistrationCardReservation = {
  confirmationNumber: '123456',
  checkIn: '2026-10-21',
  checkOut: '2026-10-24',
  earlyCheckIn: true,
  lateCheckOut: true,
  roomNumber: 'Room 204',
  roomType: 'King Suite',
  adults: 2,
  children: 2,
  stayTotalCents: 112_500,
  nights: 3,
  leadOccupant: {
    name: 'Jordan Rivers',
    memberNumber: 'M-10482',
    phone: '555-010-2200',
    address: { street: '123 Address Street', city: 'Cincinnati', state: 'OH', zip: '45238' },
  },
  reserver: { name: 'Sam Ortega', memberNumber: 'M-20931', phone: '555-010-3300' },
  publicNotes: 'Late arrival expected after 9 PM.',
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const lines = (items: readonly string[]) => items.map(escapeHtml).join('<br>');

/** The card as one printable HTML document, in the order of the PDF frame. */
export function renderRegistrationCardHtml(card: RegistrationCardModel): string {
  const cell = (label: string, body: string) =>
    `<p><span class="label">${escapeHtml(label)}</span> ${body}</p>`;
  const flag = (f: string | null) => (f ? `<br><strong>${escapeHtml(f)}</strong>` : '');
  const parts: string[] = [];
  if (card.header) {
    parts.push(
      `<header><div>${lines(card.header.lines)}</div>` +
        (card.header.logo && card.header.logo.startsWith('data:image/')
          ? `<img alt="Logo" src="${escapeHtml(card.header.logo)}">`
          : '') +
        '</header><hr>',
    );
  }
  parts.push(
    `<div class="title"><h1>Registration Card</h1>${card.confirmationNumber ? `<h1>${escapeHtml(card.confirmationNumber)}</h1>` : ''}</div>`,
  );
  const grid: string[] = [];
  if (card.checkIn)
    grid.push(cell('Check In:', `${escapeHtml(card.checkIn.date)}${flag(card.checkIn.flag)}`));
  if (card.checkOut)
    grid.push(cell('Check Out:', `${escapeHtml(card.checkOut.date)}${flag(card.checkOut.flag)}`));
  if (card.room) grid.push(cell('Room:', escapeHtml(card.room)));
  if (card.guestCount) grid.push(cell('Guest Count:', escapeHtml(card.guestCount)));
  if (card.guest) grid.push(cell('Guest:', lines(card.guest)));
  if (card.reservedBy) grid.push(cell('Reserved By:', lines(card.reservedBy)));
  parts.push(`<section class="grid">${grid.join('')}</section>`);
  if (card.notes) parts.push(cell('Notes:', escapeHtml(card.notes)));
  if (card.customText) parts.push(`<p class="custom">${escapeHtml(card.customText)}</p>`);
  if (card.guestSignature || card.staffSignature) {
    const box = (label: string) => `<div class="sig"><div class="box"></div>${label}</div>`;
    parts.push(
      '<hr><section class="sigs">' +
        (card.guestSignature ? box('Guest Signature') : '') +
        (card.staffSignature ? box('Staff Signature') : '') +
        '</section>',
    );
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Registration Card preview</title><style>
body{font-family:Roboto,Arial,sans-serif;font-size:14px;margin:40px;max-width:532px}
header{display:flex;justify-content:space-between;align-items:center;min-height:85px}
header img{max-height:85px;max-width:235px}
.title{display:flex;justify-content:space-between}h1{font-size:24px;margin:0 0 16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 16px}.label{font-weight:bold}
.sigs{display:flex;gap:16px}.sig{flex:1}.box{height:44px;border:1px solid gray;border-radius:4px;margin-bottom:4px}
hr{border:0;border-top:1px solid lightgray;margin:16px 0}
</style></head><body>${parts.join('')}</body></html>`;
}

/** Renders the sample card for the given settings and returns the address a new tab can open. */
export function previewRegistrationCardUrl(request: RegistrationCardPreviewRequest): string {
  const card = buildRegistrationCard(
    request.settings,
    SAMPLE_RESERVATION,
    request.folio,
    'Pine Ridge Club',
  );
  const html = renderRegistrationCardHtml(card);
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}
