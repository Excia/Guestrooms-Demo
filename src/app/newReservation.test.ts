import {
  createFailure,
  defaultNewReservation,
  estimateTotal,
  formatPanelDate,
  padCount,
  stayNights,
  toCreateRequest,
  validateNewReservation,
} from './newReservation';

const TODAY = '2026-10-16';
const valid = {
  ...defaultNewReservation(TODAY, '2026-10-17'),
  guestName: 'Ann Lee',
  roomId: 'rm-1',
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

  it('reports each problem on its field', () => {
    const errors = validateNewReservation(
      { ...valid, arrival: '2026-10-01', departure: '2026-10-01', guestName: ' ', roomId: '' },
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(['arrival', 'departure', 'guestName', 'roomId']);
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

  it('builds the create request with a trimmed name', () => {
    expect(toCreateRequest({ ...valid, guestName: '  Ann Lee ' }, 'req-12345678')).toMatchObject({
      requestId: 'req-12345678',
      guestName: 'Ann Lee',
      roomId: 'rm-1',
      adults: 2,
      bookingGuestRole: 'occupant',
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
