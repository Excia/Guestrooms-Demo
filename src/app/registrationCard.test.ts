import { mockSystemSettings } from '../api/systemSettingsData';
import { SAMPLE_RESERVATION } from '../api/registrationCardData';
import { REGISTRATION_CARD_ITEM_IDS } from '../api/registrationCardTypes';
import type {
  RegistrationCardReservation,
  RegistrationCardSettings,
} from '../api/registrationCardTypes';
import {
  averageRoomRateCents,
  buildRegistrationCard,
  customTextProblem,
  defaultRegistrationCard,
  effectiveItems,
  folioHeaderLines,
  formatCardDate,
  formatGuestCount,
  isItemDisabled,
  isOpenablePreviewUrl,
  isUniqueReserver,
  ITEM_GRID,
  setItem,
} from './registrationCard';

const folio = mockSystemSettings().folio;
const allOn = (): RegistrationCardSettings => ({
  enabled: true,
  items: Object.fromEntries(
    REGISTRATION_CARD_ITEM_IDS.map((id) => [id, true]),
  ) as RegistrationCardSettings['items'],
  customText: 'Sign here.',
});
const withItems = (on: string[]): RegistrationCardSettings => ({
  enabled: true,
  items: Object.fromEntries(
    REGISTRATION_CARD_ITEM_IDS.map((id) => [id, on.includes(id)]),
  ) as RegistrationCardSettings['items'],
  customText: '',
});
const reservation = (over: Partial<RegistrationCardReservation> = {}) => ({
  ...SAMPLE_RESERVATION,
  ...over,
});

describe('item dependencies', () => {
  it('disables phone and address while the lead occupant name is unchecked', () => {
    const items = withItems(['leadOccupantPhone']).items;
    expect(isItemDisabled(items, 'leadOccupantPhone')).toBe(true);
    expect(isItemDisabled(items, 'leadOccupantAddress')).toBe(true);
    expect(isItemDisabled(items, 'leadOccupantName')).toBe(false);
    expect(isItemDisabled(allOn().items, 'leadOccupantPhone')).toBe(false);
  });
  it('disables the reserver phone while the reserver name is unchecked', () => {
    expect(isItemDisabled(withItems([]).items, 'reserverPhone')).toBe(true);
    expect(isItemDisabled(withItems(['reserverName']).items, 'reserverPhone')).toBe(false);
  });
  it('unchecking a name clears its phone and address', () => {
    const next = setItem(allOn().items, 'leadOccupantName', false);
    expect(next.leadOccupantName).toBe(false);
    expect(next.leadOccupantPhone).toBe(false);
    expect(next.leadOccupantAddress).toBe(false);
    expect(next.reserverPhone).toBe(true);
    expect(setItem(allOn().items, 'reserverName', false).reserverPhone).toBe(false);
  });
  it('ignores a change to a disabled item and restores nothing when the name returns', () => {
    const off = setItem(allOn().items, 'leadOccupantName', false);
    expect(setItem(off, 'leadOccupantPhone', true)).toBe(off);
    const back = setItem(off, 'leadOccupantName', true);
    expect(back.leadOccupantPhone).toBe(false);
  });
  it('the card honors a dependent item only with its parent', () => {
    const items = { ...withItems(['leadOccupantPhone', 'reserverPhone']).items };
    const e = effectiveItems(items);
    expect(e.leadOccupantPhone).toBe(false);
    expect(e.reserverPhone).toBe(false);
  });
  it('the grid lists every item exactly once', () => {
    const ids = ITEM_GRID.flat().filter(Boolean);
    expect(new Set(ids).size).toBe(REGISTRATION_CARD_ITEM_IDS.length);
    expect([...ids].sort()).toEqual([...REGISTRATION_CARD_ITEM_IDS].sort());
  });
  it('defaults to the checked items Figma draws', () => {
    const d = defaultRegistrationCard();
    expect(d.enabled).toBe(true);
    expect(REGISTRATION_CARD_ITEM_IDS.filter((id) => d.items[id])).toEqual([
      'folioHeader',
      'confirmationNumber',
      'checkInDate',
      'checkOutDate',
      'roomNumber',
      'guestCount',
      'leadOccupantName',
      'customText',
      'guestSignature',
    ]);
  });
});

describe('custom text', () => {
  it('allows 500 characters and refuses 501', () => {
    expect(customTextProblem('a'.repeat(500))).toBeNull();
    expect(customTextProblem('a'.repeat(501))).toMatch(/500/);
  });
});

describe('formats', () => {
  it('formats the card date as "Day MM/DD/YY"', () => {
    expect(formatCardDate('2026-10-21')).toBe('Wed 10/21/26');
    expect(formatCardDate('nope')).toBe('nope');
  });
  it('averages revenue over nights, weighted, to the cent', () => {
    expect(averageRoomRateCents(112_500, 3)).toBe(37_500);
    expect(averageRoomRateCents(10_000, 3)).toBe(3_333);
    expect(averageRoomRateCents(10_000, 0)).toBeNull();
  });
  it('words the guest count', () => {
    expect(formatGuestCount(2, 2)).toBe('2 Adults, 2 Children');
    expect(formatGuestCount(1, 1)).toBe('1 Adult, 1 Child');
    expect(formatGuestCount(2, 0)).toBe('2 Adults');
  });
  it('builds the folio header lines and skips empty parts', () => {
    expect(folioHeaderLines(folio, 'Pine Ridge Club')).toEqual([
      'Pine Ridge Club',
      '4111 Clubessential Drive',
      'Cincinnati, OH 45238',
      'Phone: XXX-XXX-XXXX',
      'Email: email@email.com',
    ]);
    expect(
      folioHeaderLines({ ...folio, streetAddress: '', phone: '', email: '', state: '' }, ''),
    ).toEqual(['Cincinnati, 45238']);
  });
});

describe('unique reserver', () => {
  it('is not unique when it is the lead occupant', () => {
    expect(isUniqueReserver(reservation({ reserver: null }))).toBe(false);
    expect(
      isUniqueReserver(
        reservation({ reserver: { name: 'Other Name', memberNumber: 'M-10482', phone: '' } }),
      ),
    ).toBe(false);
    expect(
      isUniqueReserver(
        reservation({
          leadOccupant: { ...SAMPLE_RESERVATION.leadOccupant, memberNumber: null },
          reserver: { name: ' jordan RIVERS ', memberNumber: null, phone: '' },
        }),
      ),
    ).toBe(false);
  });
  it('is unique for another person', () => {
    expect(isUniqueReserver(reservation())).toBe(true);
  });
});

describe('buildRegistrationCard', () => {
  it('prints everything for a card with every item checked', () => {
    const card = buildRegistrationCard(allOn(), reservation(), folio, 'Pine Ridge Club');
    expect(card.header?.lines[0]).toBe('Pine Ridge Club');
    expect(card.confirmationNumber).toBe('#123456');
    expect(card.checkIn).toEqual({ date: 'Wed 10/21/26', flag: 'Early Check In' });
    expect(card.checkOut).toEqual({ date: 'Sat 10/24/26', flag: 'Late Check Out' });
    expect(card.room).toBe('Room 204 (King Suite, $375.00)');
    expect(card.guestCount).toBe('2 Adults, 2 Children');
    expect(card.guest).toEqual([
      'Jordan Rivers (M-10482)',
      '555-010-2200',
      '123 Address Street',
      'Cincinnati, OH 45238',
    ]);
    expect(card.reservedBy).toEqual(['Sam Ortega (M-20931)', '555-010-3300']);
    expect(card.notes).toBe('Late arrival expected after 9 PM.');
    expect(card.customText).toBe('Sign here.');
    expect(card.guestSignature && card.staffSignature).toBe(true);
  });

  it('prints only the checked items', () => {
    const card = buildRegistrationCard(
      withItems(['confirmationNumber', 'roomNumber']),
      reservation(),
      folio,
    );
    expect(card.header).toBeNull();
    expect(card.checkIn).toBeNull();
    expect(card.room).toBe('Room 204');
    expect(card.guest).toBeNull();
    expect(card.guestCount).toBeNull();
    expect(card.guestSignature).toBe(false);
  });

  it('shows the room type and rate only when checked', () => {
    expect(buildRegistrationCard(withItems(['roomType']), reservation(), folio).room).toBe(
      '(King Suite)',
    );
    expect(
      buildRegistrationCard(withItems(['roomNumber', 'averageRoomRate']), reservation(), folio)
        .room,
    ).toBe('Room 204 ($375.00)');
  });

  it('shows the early and late flags only when the reservation has them', () => {
    const items = ['checkInDate', 'checkOutDate', 'earlyCheckInFlag', 'lateCheckOutFlag'];
    const card = buildRegistrationCard(
      withItems(items),
      reservation({ earlyCheckIn: false, lateCheckOut: false }),
      folio,
    );
    expect(card.checkIn?.flag).toBeNull();
    expect(card.checkOut?.flag).toBeNull();
  });

  it('leaves out a phone or address whose name is unchecked', () => {
    const noNames = withItems(['leadOccupantPhone', 'leadOccupantAddress', 'reserverPhone']);
    const card = buildRegistrationCard(noNames, reservation(), folio);
    expect(card.guest).toBeNull();
    expect(card.reservedBy).toBeNull();
    const nameOnly = buildRegistrationCard(withItems(['leadOccupantName']), reservation(), folio);
    expect(nameOnly.guest).toEqual(['Jordan Rivers (M-10482)']);
  });

  it('hides the Reserved By block when there is no reserver or it is the lead occupant', () => {
    const settings = withItems(['reserverName', 'reserverPhone']);
    expect(
      buildRegistrationCard(settings, reservation({ reserver: null }), folio).reservedBy,
    ).toBeNull();
    expect(
      buildRegistrationCard(
        settings,
        reservation({ reserver: { name: 'Jordan Rivers', memberNumber: 'M-10482', phone: '1' } }),
        folio,
      ).reservedBy,
    ).toBeNull();
  });

  it('skips empty notes and empty custom text', () => {
    const card = buildRegistrationCard(
      { ...withItems(['publicNotes', 'customText']), customText: '   ' },
      reservation({ publicNotes: ' ' }),
      folio,
    );
    expect(card.notes).toBeNull();
    expect(card.customText).toBeNull();
  });
});

describe('isOpenablePreviewUrl', () => {
  it('allows web addresses, blobs and site paths only', () => {
    expect(isOpenablePreviewUrl('https://files.example.com/p.pdf')).toBe(true);
    expect(isOpenablePreviewUrl('blob:http://localhost/abc')).toBe(true);
    expect(isOpenablePreviewUrl('/files/p.pdf')).toBe(true);
    expect(isOpenablePreviewUrl('javascript:alert(1)')).toBe(false);
    expect(isOpenablePreviewUrl('//evil.example.com/x')).toBe(false);
    expect(isOpenablePreviewUrl('data:text/html,hi')).toBe(false);
    expect(isOpenablePreviewUrl('')).toBe(false);
  });
});
