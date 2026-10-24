import {
  checkInCtaLabel,
  decideCheckIn,
  nightsBeforeToday,
  roomFactsOf,
  needsPastDatePrompt,
  type CheckInInput,
  type CheckInRoomFacts,
} from './checkInDecision';

const room = (over: Partial<CheckInRoomFacts> = {}): CheckInRoomFacts => ({
  id: 'rr-1',
  status: 'nyci',
  assigned: true,
  dirty: false,
  arrival: '2026-10-24',
  departure: '2026-10-27',
  ...over,
});

const input = (over: Partial<CheckInInput> = {}): CheckInInput => ({
  rooms: [room()],
  targetIds: ['rr-1'],
  checkOutTime: '12:00',
  clock: { date: '2026-10-24', time: '14:00' },
  level: 'any-time',
  paymentOnFile: true,
  ...over,
});

describe('decideCheckIn', () => {
  it('allows a check in on the arrival date', () => {
    expect(decideCheckIn(input())).toMatchObject({
      kind: 'allowed',
      checkableIds: ['rr-1'],
      thenCheckOut: false,
      paymentRequired: false,
    });
  });

  it('asks for a payment method when none is on file, past date or not', () => {
    expect(decideCheckIn(input({ paymentOnFile: false }))).toMatchObject({ paymentRequired: true });
    expect(
      decideCheckIn(input({ paymentOnFile: false, rooms: [room({ arrival: '2026-10-20' })] })),
    ).toMatchObject({ kind: 'needsPastDateConfirmation', paymentRequired: true });
  });

  describe('permission levels', () => {
    it('"never" disables check in, whatever the date', () => {
      const d = decideCheckIn(input({ level: 'never' }));
      expect(d).toMatchObject({ kind: 'disabled', reason: 'no-permission' });
      expect(
        decideCheckIn(input({ level: 'never', rooms: [room({ arrival: '2026-10-20' })] })),
      ).toMatchObject({ kind: 'disabled', reason: 'no-permission' });
    });

    it('"arrival date only" checks in on the arrival date without a prompt', () => {
      expect(decideCheckIn(input({ level: 'arrival-date-only' })).kind).toBe('allowed');
    });

    it('"any time" confirms a past date; "arrival date only" needs an override code', () => {
      const past = { rooms: [room({ arrival: '2026-10-20' })] };
      expect(decideCheckIn(input({ ...past, level: 'any-time' })).kind).toBe(
        'needsPastDateConfirmation',
      );
      expect(decideCheckIn(input({ ...past, level: 'arrival-date-only' })).kind).toBe(
        'needsOverride',
      );
    });
  });

  describe('which dates count', () => {
    it('is past only when the club date is after the arrival date', () => {
      const d = decideCheckIn(input({ rooms: [room({ arrival: '2026-10-23' })] }));
      expect(d).toMatchObject({ kind: 'needsPastDateConfirmation', originalArrival: '2026-10-23' });
    });

    it('uses the club clock, not any other date: late evening in the club is still the arrival day', () => {
      expect(decideCheckIn(input({ clock: { date: '2026-10-24', time: '23:59' } })).kind).toBe(
        'allowed',
      );
      expect(decideCheckIn(input({ clock: { date: '2026-10-25', time: '00:01' } })).kind).toBe(
        'needsPastDateConfirmation',
      );
    });

    it('disables an arrival in the future at every level', () => {
      for (const level of ['any-time', 'arrival-date-only'] as const) {
        const d = decideCheckIn(input({ level, rooms: [room({ arrival: '2026-10-25' })] }));
        expect(d).toMatchObject({ kind: 'disabled', reason: 'future-arrival' });
        expect(d.kind === 'disabled' && d.message).toMatch(/only allowed on the arrival date/);
      }
    });

    it('names the earliest arrival of the rooms being checked in', () => {
      const rooms = [
        room({ id: 'rr-1', arrival: '2026-10-22' }),
        room({ id: 'rr-2', arrival: '2026-10-21' }),
      ];
      expect(decideCheckIn(input({ rooms, targetIds: ['rr-1', 'rr-2'] }))).toMatchObject({
        originalArrival: '2026-10-21',
      });
    });
  });

  describe('departure already passed', () => {
    const passed = (over: Partial<CheckInRoomFacts> = {}) =>
      room({ arrival: '2026-10-20', departure: '2026-10-23', ...over });

    it('past arrival and past departure: the prompt first, then check in and out', () => {
      expect(decideCheckIn(input({ rooms: [passed()] }))).toMatchObject({
        kind: 'needsPastDateConfirmation',
        thenCheckOut: true,
      });
    });

    it('on the departure day only a time after check-out time counts', () => {
      const rooms = [room({ arrival: '2026-10-24', departure: '2026-10-24' })];
      expect(
        decideCheckIn(input({ rooms, clock: { date: '2026-10-24', time: '11:00' } })),
      ).toMatchObject({
        kind: 'allowed',
        thenCheckOut: false,
      });
      expect(
        decideCheckIn(input({ rooms, clock: { date: '2026-10-24', time: '12:30' } })),
      ).toMatchObject({
        kind: 'checkInThenOut',
        thenCheckOut: true,
      });
    });

    it('does not check out while the departure is ahead', () => {
      expect(decideCheckIn(input({ rooms: [room({ arrival: '2026-10-22' })] }))).toMatchObject({
        thenCheckOut: false,
      });
    });
  });

  describe('rooms', () => {
    it('a dirty room cannot be checked in', () => {
      expect(decideCheckIn(input({ rooms: [room({ dirty: true })] }))).toMatchObject({
        kind: 'disabled',
        reason: 'room-not-ready',
      });
    });

    it('a dirty room among several is listed but not checkable', () => {
      const rooms = [room({ id: 'a' }), room({ id: 'b', dirty: true })];
      expect(decideCheckIn(input({ rooms, targetIds: ['a', 'b'] }))).toMatchObject({
        kind: 'allowed',
        checkableIds: ['a'],
        notReadyIds: ['b'],
      });
    });

    it('an unassigned room opens the panel with "assign now" instead of disabling the button', () => {
      const d = decideCheckIn(input({ rooms: [room({ assigned: false })] }));
      expect(d).toMatchObject({ kind: 'allowed', checkableIds: [], unassignedIds: ['rr-1'] });
    });

    it('an unassigned room on a past date still asks the past-date question first', () => {
      const d = decideCheckIn(input({ rooms: [room({ assigned: false, arrival: '2026-10-20' })] }));
      expect(d).toMatchObject({ kind: 'needsPastDateConfirmation', unassignedIds: ['rr-1'] });
    });

    it('is disabled when nothing is waiting for check in', () => {
      const rooms = [room({ status: 'checked-in' })];
      expect(decideCheckIn(input({ rooms }))).toMatchObject({
        kind: 'disabled',
        reason: 'nothing-to-check-in',
      });
      expect(decideCheckIn(input({ targetIds: ['nope'] })).kind).toBe('disabled');
    });
  });

  describe('partial reservations (other rooms already checked in or out)', () => {
    const rooms = (otherStatus: 'checked-in' | 'checked-out' | 'nyci') => [
      room({ id: 'a', arrival: '2026-10-20' }),
      room({ id: 'b', arrival: '2026-10-20', status: otherStatus }),
    ];
    it.each(['checked-in', 'checked-out'] as const)(
      'offers a split when another room is %s',
      (s) => {
        expect(decideCheckIn(input({ rooms: rooms(s), targetIds: ['a'] }))).toMatchObject({
          kind: 'needsPastDateConfirmation',
          split: true,
        });
      },
    );
    it('offers adjusting the dates when no other room has started', () => {
      expect(decideCheckIn(input({ rooms: rooms('nyci'), targetIds: ['a'] }))).toMatchObject({
        split: false,
      });
    });
    it('a split is not offered for rooms the user chose together', () => {
      const all = rooms('checked-in');
      all[1] = { ...all[1], status: 'nyci' };
      expect(decideCheckIn(input({ rooms: all, targetIds: ['a', 'b'] }))).toMatchObject({
        split: false,
      });
    });
  });
});

describe('needsPastDatePrompt', () => {
  it('is true for the two past-date answers only', () => {
    const past = { rooms: [room({ arrival: '2026-10-20' })] };
    expect(needsPastDatePrompt(decideCheckIn(input(past)))).toBe(true);
    expect(needsPastDatePrompt(decideCheckIn(input({ ...past, level: 'arrival-date-only' })))).toBe(
      true,
    );
    expect(needsPastDatePrompt(decideCheckIn(input()))).toBe(false);
    expect(needsPastDatePrompt(decideCheckIn(input({ level: 'never' })))).toBe(false);
  });
});

describe('checkInCtaLabel', () => {
  it('reads "Complete check in" for a one-room reservation', () => {
    expect(checkInCtaLabel(1, 1)).toBe('Complete check in');
  });
  it('reads "Check in N rooms" for several', () => {
    expect(checkInCtaLabel(3, 1)).toBe('Check in 1 room');
    expect(checkInCtaLabel(3, 2)).toBe('Check in 2 rooms');
    expect(checkInCtaLabel(3, 0)).toBe('Check in 0 rooms');
  });
});

describe('nightsBeforeToday', () => {
  it('counts the nights already slept before today', () => {
    expect(nightsBeforeToday('2026-10-20', '2026-10-27', '2026-10-24')).toBe(4);
  });
  it('stops at the departure when it has passed', () => {
    expect(nightsBeforeToday('2026-10-20', '2026-10-23', '2026-10-24')).toBe(3);
  });
  it('is zero on the arrival day', () => {
    expect(nightsBeforeToday('2026-10-24', '2026-10-27', '2026-10-24')).toBe(0);
  });
});

describe('roomFactsOf', () => {
  it('reads assignment and housekeeping from the detail; unreported housekeeping is ready', () => {
    const base = {
      status: 'nyci' as const,
      locationName: null,
      roomTypeName: null,
      arrival: 'a',
      departure: 'b',
    };
    expect(
      roomFactsOf({
        rooms: [
          { ...base, id: '1', roomId: 'rm-1', roomNumber: '1', housekeeping: 'dirty' },
          { ...base, id: '2', roomId: null, roomNumber: null },
          { ...base, id: '3', roomId: 'rm-3', roomNumber: '3' },
        ],
      }).map((f) => [f.id, f.assigned, f.dirty]),
    ).toEqual([
      ['1', true, true],
      ['2', false, false],
      ['3', true, false],
    ]);
  });
});
