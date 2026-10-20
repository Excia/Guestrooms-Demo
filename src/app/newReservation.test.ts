import {
  createFailure,
  defaultNewReservation,
  estimateTotal,
  formatPanelDate,
  padCount,
  prefilledNewReservation,
  stayNights,
  toCreateRequest,
  validateNewReservation,
} from './newReservation';

const TODAY = '2026-10-16';
const valid = defaultNewReservation(TODAY, '2026-10-17');
const grace = {
  id: 'mem-5',
  memberNumber: 'MEM-0005',
  name: 'Grace Nakamura',
  email: 'g@x.com',
  phone: '',
};
const victor = {
  id: 'mem-6',
  memberNumber: 'MEM-0006',
  name: 'Victor Almeida',
  email: 'v@x.com',
  phone: '',
};

describe('new reservation rules', () => {
  it('counts nights, null for incomplete or reversed dates', () => {
    expect(stayNights('2026-10-16', '2026-10-19')).toBe(3);
    expect(stayNights('', '2026-10-19')).toBeNull();
    expect(stayNights('2026-10-19', '2026-10-19')).toBeNull();
    expect(stayNights('2026-10-20', '2026-10-19')).toBeNull();
  });

  it('accepts a complete form', () => {
    expect(validateNewReservation(valid, TODAY)).toEqual({});
  });

  it('needs only valid dates: the guest, lead occupant and room are optional', () => {
    expect(validateNewReservation({ ...valid, guest: null, roomId: '' }, TODAY)).toEqual({});
  });

  it('reports each date problem on its field', () => {
    const errors = validateNewReservation(
      { ...valid, arrival: '2026-10-01', departure: '2026-10-01' },
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(['arrival', 'departure']);
    expect(validateNewReservation({ ...valid, arrival: '', departure: '' }, TODAY)).toMatchObject({
      arrival: expect.any(String),
      departure: expect.any(String),
    });
  });

  it('estimates nights times the nightly rate, null when unknown', () => {
    expect(estimateTotal(3, { nightlyRate: 24900 })).toBe(74700);
    expect(estimateTotal(null, { nightlyRate: 100 })).toBeNull();
    expect(estimateTotal(2, {})).toBeNull();
    expect(estimateTotal(2, undefined)).toBeNull();
  });

  it('builds the request: TBD without a guest, no room when Unassigned', () => {
    expect(toCreateRequest(valid, 'req-12345678')).toEqual({
      requestId: 'req-12345678',
      roomId: null,
      arrival: TODAY,
      departure: '2026-10-17',
      adults: 2,
      children: 0,
      guestName: 'TBD',
      bookingGuestRole: 'occupant',
    });
  });

  it('sends the booking guest id, the room and, for a reserver only, the lead occupant', () => {
    const form = { ...valid, guest: grace, roomId: 'rm-1', leadOccupant: victor };
    const occupant = toCreateRequest(form, 'req-12345678');
    expect(occupant).toMatchObject({
      guestName: 'Grace Nakamura',
      bookingGuestId: 'mem-5',
      roomId: 'rm-1',
    });
    expect(occupant.leadOccupant).toBeUndefined();
    expect(toCreateRequest({ ...form, role: 'reserver' }, 'req-12345678').leadOccupant).toEqual({
      name: 'Victor Almeida',
      memberId: 'mem-6',
    });
    expect(
      toCreateRequest({ ...form, role: 'reserver', leadOccupant: null }, 'req-12345678')
        .leadOccupant,
    ).toBeUndefined();
  });

  it('an empty cell prefills Check In and leaves Check Out empty; a past day becomes today', () => {
    expect(prefilledNewReservation(TODAY, '2026-10-17', { arrival: '2026-10-20' })).toMatchObject({
      form: { arrival: '2026-10-20', departure: '' },
      pastDate: false,
    });
    expect(prefilledNewReservation(TODAY, '2026-10-17', { arrival: '2026-10-10' })).toMatchObject({
      form: { arrival: TODAY, departure: '' },
      pastDate: true,
    });
    expect(prefilledNewReservation(TODAY, '2026-10-17', undefined)).toMatchObject({
      form: { arrival: TODAY, departure: '2026-10-17' },
      pastDate: false,
    });
  });

  it('formats display values', () => {
    expect(padCount(2)).toBe('02');
    expect(padCount(12)).toBe('12');
    expect(formatPanelDate('2026-10-05')).toBe('10/05/2026');
  });

  it('explains create failures; unknown outcomes are flagged', () => {
    expect(createFailure(409, 'conflict')).toMatchObject({ unknown: false });
    expect(createFailure(400)).toMatchObject({ unknown: false });
    expect(createFailure(0, 'network').unknown).toBe(true);
    expect(createFailure(503).unknown).toBe(true);
    expect(createFailure(408).unknown).toBe(true);
  });
});
