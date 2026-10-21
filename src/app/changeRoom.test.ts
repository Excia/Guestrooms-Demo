import { createScheduleState } from '../api/scheduleData';
import { queryScheduleData } from '../api/scheduleQuery';
import { ApiError } from '../api/types';
import type { ScheduleBlock } from '../api/types';
import {
  applyRoomChange,
  changeRoomAvailability,
  changeRoomFailure,
  changeRoomSummary,
  mergeRoomChange,
  mergeScheduleWindows,
  rateQuestion,
  revertRoomChange,
  roomChoices,
  scheduleWindowsFor,
  shortDate,
  signedMoney,
  stayedNights,
  toChangeRoomRequest,
  UNKNOWN_ROOM_CHANGE,
} from './changeRoom';

const T = '2026-10-16';

describe('changeRoomAvailability', () => {
  const room = {
    status: 'checked-in' as const,
    roomId: 'rm-201',
    arrival: '2026-10-15',
    departure: '2026-10-18',
  };
  const ok = { today: T, canEdit: true };

  it('is available for a checked-in room with nights left, effective today', () => {
    expect(changeRoomAvailability({ room, ...ok })).toEqual({
      available: true,
      reason: null,
      effectiveDate: T,
    });
  });
  it('only when checked in: not yet checked in and checked out say why', () => {
    expect(changeRoomAvailability({ room: { ...room, status: 'nyci' }, ...ok })).toMatchObject({
      available: false,
      reason: 'Available once the guest is checked in.',
      effectiveDate: null,
    });
    expect(changeRoomAvailability({ room: { ...room, status: 'checked-out' }, ...ok }).reason).toBe(
      'Not available after check out.',
    );
  });
  it('needs the reservation.edit permission (fail closed), and that reason comes first', () => {
    expect(changeRoomAvailability({ room, today: T, canEdit: false })).toMatchObject({
      available: false,
      reason: 'You do not have permission to change this reservation.',
    });
    expect(
      changeRoomAvailability({ room: { ...room, status: 'nyci' }, today: T, canEdit: false })
        .reason,
    ).toMatch(/permission/);
  });
  it('needs a room', () => {
    expect(changeRoomAvailability({ room: { ...room, roomId: null }, ...ok }).reason).toBe(
      'Assign a room first.',
    );
  });
  it('is not available while another change is being saved', () => {
    expect(changeRoomAvailability({ room, ...ok, busy: true }).reason).toBe(
      'A room change is being saved.',
    );
  });
  it('edge: departure today means no nights left; departure tomorrow leaves the last night', () => {
    expect(changeRoomAvailability({ room: { ...room, departure: T }, ...ok }).reason).toBe(
      'The stay ends today, so no nights are left to move.',
    );
    expect(
      changeRoomAvailability({ room: { ...room, departure: '2026-10-17' }, ...ok }),
    ).toMatchObject({ available: true, effectiveDate: T });
  });
  it('edge: arrival today is effective on arrival; an arrival ahead of today waits for it', () => {
    expect(changeRoomAvailability({ room: { ...room, arrival: T }, ...ok }).effectiveDate).toBe(T);
    expect(
      changeRoomAvailability({
        room: { ...room, arrival: '2026-10-17', departure: '2026-10-19' },
        ...ok,
      }),
    ).toMatchObject({ available: true, effectiveDate: '2026-10-17' });
  });
});

describe('scheduleWindowsFor', () => {
  it('uses the smallest window that fits, and several for a long stay', () => {
    expect(scheduleWindowsFor('2026-10-16', '2026-10-18')).toEqual([
      { startDate: '2026-10-16', days: 7 },
    ]);
    expect(scheduleWindowsFor('2026-10-16', '2026-10-30')).toEqual([
      { startDate: '2026-10-16', days: 14 },
    ]);
    expect(scheduleWindowsFor('2026-10-16', '2026-11-15')).toEqual([
      { startDate: '2026-10-16', days: 30 },
    ]);
    expect(scheduleWindowsFor('2026-10-16', '2026-12-01')).toEqual([
      { startDate: '2026-10-16', days: 30 },
      { startDate: '2026-11-15', days: 30 },
    ]);
  });
  it('covers every night exactly once and nothing for an empty range', () => {
    expect(scheduleWindowsFor('2026-10-16', '2026-10-16')).toEqual([]);
    const windows = scheduleWindowsFor('2026-10-16', '2027-01-20');
    expect(windows[0].startDate).toBe('2026-10-16');
    expect(windows.length).toBe(4);
  });
  it('mergeScheduleWindows dedupes blocks and closures by id', () => {
    const s = createScheduleState(T);
    const a = queryScheduleData(s, { startDate: T, days: 7 });
    const b = queryScheduleData(s, { startDate: '2026-10-20', days: 7 });
    const merged = mergeScheduleWindows([a, b]);
    expect(new Set(merged.blocks.map((x) => x.id)).size).toBe(merged.blocks.length);
    expect(merged.blocks.length).toBeGreaterThan(a.blocks.length);
    expect(merged.rooms).toEqual(a.rooms);
  });
});

describe('roomChoices (eligibility for the remaining nights)', () => {
  const data = queryScheduleData(createScheduleState(T), { startDate: T, days: 14 });
  const daniel = data.blocks.find((b) => b.id === 'rr-2')!; // rm-201, 10/15 to 10/18, checked in
  const choices = (current: Partial<ScheduleBlock> = {}, effectiveDate = T) =>
    roomChoices({
      ...data,
      current: { ...daniel, ...current },
      effectiveDate,
    });
  const of = (list: ReturnType<typeof choices>, number: string) =>
    list.find((c) => c.option.number === number)!;

  it('the current room is disabled: Same room', () => {
    expect(of(choices(), '201')).toMatchObject({ disabled: true, reason: 'Same room' });
  });
  it('a free room is enabled', () => {
    expect(of(choices(), '209')).toMatchObject({ disabled: false, reason: null });
  });
  it('a room booked on a remaining night says Booked with its dates', () => {
    // rm-202: Thomas Okafor 10/16 to 10/19
    expect(of(choices(), '202')).toMatchObject({
      disabled: true,
      reason: 'Booked 10/16-10/19',
    });
  });
  it('a closed room says Closed with its dates', () => {
    expect(of(choices(), '208')).toMatchObject({ disabled: true, reason: 'Closed 10/17-10/20' });
  });
  it('half-open nights: a stay that starts on the departure day does not block (same-day turnover)', () => {
    // rm-204: Annika Lindqvist arrives 10/18, the day Daniel leaves.
    expect(of(choices(), '204').disabled).toBe(false);
    // ... but it blocks as soon as the stay is one night longer.
    expect(of(choices({ endDate: '2026-10-19' }), '204')).toMatchObject({
      disabled: true,
      reason: 'Booked 10/18-10/21',
    });
  });
  it('a stay that ends on the effective date does not block either', () => {
    // rm-202: Priya Raman 10/14 to 10/16 (checked in), then Thomas Okafor from 10/16.
    const later = choices({ endDate: '2026-10-18' }, '2026-10-17');
    expect(of(later, '202').reason).toBe('Booked 10/16-10/19');
    // rm-105 has Peter Vandenberg until 10/19; the next effective date after that is free.
    const free = choices({ endDate: '2026-10-22' }, '2026-10-19');
    expect(of(free, '105').reason).toBe('Booked 10/19-10/21');
  });
  it('only the remaining nights count: a booking in the nights already stayed is ignored', () => {
    // rm-C5 had a checked-out stay (Elise Moreau) from 10/13 to 10/16: before the effective date.
    expect(of(choices(), 'C5').disabled).toBe(false);
  });
  it('a checked-out stay that still holds a remaining night says Checked-out stay', () => {
    const blocks = data.blocks.map((b) =>
      b.id === 'rr-5' ? { ...b, status: 'checked-out' as const } : b,
    );
    const list = roomChoices({ ...data, blocks, current: daniel, effectiveDate: T });
    expect(of(list, '202').reason).toBe('Checked-out stay 10/16-10/19');
  });
  it('a locked reservation can only change within its room type', () => {
    const list = choices({ roomTypeLocked: true });
    expect(of(list, '209')).toMatchObject({ disabled: false });
    expect(of(list, '205')).toMatchObject({ disabled: true, reason: 'Locked to its room type' });
  });
  it('the closure wins over a booking, and Same room wins over everything', () => {
    const list = roomChoices({
      ...data,
      closures: [
        ...data.closures,
        {
          kind: 'closure',
          id: 'cl-x',
          roomId: 'rm-202',
          startDate: T,
          endDate: '2026-10-17',
          reason: 'x',
          endMarker: false,
        },
      ],
      current: daniel,
      effectiveDate: T,
    });
    expect(of(list, '202').reason).toBe('Closed 10/16-10/17');
  });
  it('lists every room in the grouped order (location | room type, rooms numbered naturally)', () => {
    const list = choices();
    expect(list).toHaveLength(data.rooms.length);
    expect(list[0].option.group).toBe('Main Clubhouse | King Deluxe');
  });
  it('shortDate', () => expect(shortDate('2026-10-05')).toBe('10/05'));
});

describe('copy and nights', () => {
  it('states old and new room and the effective dates', () => {
    expect(
      changeRoomSummary({
        fromNumber: '201',
        toNumber: '204',
        effectiveDate: '2026-10-20',
        departure: '2026-10-22',
      }),
    ).toEqual({
      sentence: 'Move from Room 201 to Room 204 effective 10/20/2026 through 10/22/2026',
      nights: 2,
    });
  });
  it('signedMoney', () => {
    expect(signedMoney(5000)).toBe('+$50.00');
    expect(signedMoney(-10000)).toBe('-$100.00');
    expect(signedMoney(0)).toBe('no change');
  });
  it('stayedNights lists the nights before the effective date with the room of each', () => {
    const nights = stayedNights(
      {
        roomNumber: '205',
        arrival: '2026-10-17',
        previousStays: [
          { roomId: 'rm-201', roomNumber: '201', arrival: '2026-10-15', departure: '2026-10-17' },
        ],
      },
      '2026-10-15',
      '2026-10-19',
    );
    expect(nights).toEqual([
      { night: 1, date: '2026-10-15', roomNumber: '201' },
      { night: 2, date: '2026-10-16', roomNumber: '201' },
      { night: 3, date: '2026-10-17', roomNumber: '205' },
      { night: 4, date: '2026-10-18', roomNumber: '205' },
    ]);
    expect(
      stayedNights({ roomNumber: '201', arrival: '2026-10-16' }, '2026-10-16', '2026-10-16'),
    ).toEqual([]);
  });
});

describe('rateQuestion', () => {
  const detail = {
    stay: {
      folioTotalCents: 0,
      lines: [
        {
          roomType: 'King Deluxe',
          date: '2026-10-15',
          amountCents: 24900,
          reservationRoomId: 'rr-2',
        },
        {
          roomType: 'King Deluxe',
          date: '2026-10-16',
          amountCents: 24900,
          reservationRoomId: 'rr-2',
        },
        {
          roomType: 'King Deluxe',
          date: '2026-10-17',
          amountCents: 24900,
          reservationRoomId: 'rr-2',
        },
        {
          roomType: 'Suite',
          date: '2026-10-16',
          amountCents: 99900,
          reservationRoomId: 'rr-other',
        },
      ],
    },
  };
  const base = {
    detail,
    reservationRoomId: 'rr-2',
    effectiveDate: T,
    today: T,
  };
  it('asks when the setting is on and the rates differ, and prices each answer', () => {
    const q = rateQuestion({ ...base, newRateCents: 19900, ask: true });
    expect(q).toMatchObject({
      asked: true,
      ratesDiffer: true,
      currentRate: '$249.00',
      newRate: '$199.00',
      updateDeltaCents: -10000,
      repricedNights: 2,
    });
  });
  it('does not ask when the rates are the same', () => {
    expect(rateQuestion({ ...base, newRateCents: 24900, ask: true })).toMatchObject({
      asked: false,
      ratesDiffer: false,
      updateDeltaCents: 0,
    });
  });
  it('does not ask when the setting is off, but still prices the update', () => {
    expect(rateQuestion({ ...base, newRateCents: 19900, ask: false })).toMatchObject({
      asked: false,
      ratesDiffer: true,
      updateDeltaCents: -10000,
    });
  });
  it('only looks at the nights of this reservation room', () => {
    const q = rateQuestion({ ...base, newRateCents: 99900, ask: true });
    expect(q.updateDeltaCents).toBe(2 * 75000);
  });
});

describe('toChangeRoomRequest', () => {
  const block = { id: 'rr-2', roomId: 'rm-201', version: 'v1' };
  const base = { block, toRoomId: 'rm-205', effectiveDate: T, requestId: 'req-12345678' };
  it('carries the guard (room, version) and the effective date', () => {
    expect(toChangeRoomRequest({ ...base, asked: true, answer: 'retain' })).toEqual({
      requestId: 'req-12345678',
      reservationRoomId: 'rr-2',
      fromRoomId: 'rm-201',
      toRoomId: 'rm-205',
      effectiveDate: T,
      rateChoice: 'retain',
      version: 'v1',
    });
  });
  it('sends no rate choice when the question was not asked', () => {
    expect(toChangeRoomRequest({ ...base, asked: false, answer: 'retain' }).rateChoice).toBeNull();
  });
});

describe('optimistic update', () => {
  const data = queryScheduleData(createScheduleState(T), { startDate: '2026-10-10', days: 14 });
  const daniel = data.blocks.find((b) => b.id === 'rr-2')!;
  const edit = {
    reservationRoomId: 'rr-2',
    toRoomId: 'rm-205',
    effectiveDate: T,
    pendingId: 'rr-2~pending',
  };

  it('moves the block to the new room from the effective date and leaves the stayed nights behind', () => {
    const next = applyRoomChange(data.blocks, edit);
    expect(next.find((b) => b.id === 'rr-2')).toMatchObject({
      roomId: 'rm-205',
      startDate: T,
      endDate: '2026-10-18',
      status: 'checked-in',
      roomChange: { part: 'current', otherRoomId: 'rm-201' },
    });
    expect(next.find((b) => b.id === 'rr-2~pending')).toMatchObject({
      roomId: 'rm-201',
      startDate: '2026-10-15',
      endDate: T,
      status: 'checked-out',
      confirmationNumber: 'GR-50240',
      roomChange: { part: 'previous', otherRoomId: 'rm-205' },
    });
    expect(next).toHaveLength(data.blocks.length + 1);
  });
  it('arrival today: no stayed nights, so no segment is left behind', () => {
    const arrivesToday = data.blocks.map((b) => (b.id === 'rr-2' ? { ...b, startDate: T } : b));
    const next = applyRoomChange(arrivesToday, edit);
    expect(next).toHaveLength(arrivesToday.length);
    expect(next.find((b) => b.id === 'rr-2')!.roomId).toBe('rm-205');
  });
  it('does nothing for an unknown block and does not mutate its input', () => {
    const before = structuredClone(data.blocks);
    expect(applyRoomChange(data.blocks, { ...edit, reservationRoomId: 'nope' })).toEqual(before);
    applyRoomChange(data.blocks, edit);
    expect(data.blocks).toEqual(before);
  });
  it('revert restores the original and drops the temporary segment', () => {
    const next = applyRoomChange(data.blocks, edit);
    expect(revertRoomChange(next, daniel, edit.pendingId)).toEqual(data.blocks);
  });
  it("merging the answer replaces the optimistic blocks with the server's", () => {
    const optimistic = applyRoomChange(data.blocks, edit);
    const serverCurrent = { ...optimistic.find((b) => b.id === 'rr-2')!, version: 'v9' };
    const serverPrev = {
      ...optimistic.find((b) => b.id === 'rr-2~pending')!,
      id: 'rr-2~1',
      version: 'v8',
    };
    const merged = mergeRoomChange({ ...data, blocks: optimistic }, edit.pendingId, [
      serverPrev,
      serverCurrent,
    ]);
    expect(merged.some((b) => b.id === 'rr-2~pending')).toBe(false);
    expect(merged.find((b) => b.id === 'rr-2')!.version).toBe('v9');
    expect(merged.find((b) => b.id === 'rr-2~1')).toBeDefined();
    expect(merged).toHaveLength(data.blocks.length + 1);
  });
  it('merging drops changed blocks outside the loaded window', () => {
    const narrow = { startDate: '2026-10-30', days: 7 as const, blocks: [] as ScheduleBlock[] };
    expect(mergeRoomChange(narrow, 'p', [{ ...daniel }])).toEqual([]);
  });
});

describe('changeRoomFailure', () => {
  it('a clear 4xx says nothing was applied: revert; 404 and 409 also reload', () => {
    expect(changeRoomFailure(new ApiError(409, 'x', { code: 'conflict' }))).toMatchObject({
      revert: true,
      refetch: true,
      message: expect.stringMatching(/no longer free/),
    });
    expect(changeRoomFailure(new ApiError(409, 'x', { code: 'stale' })).message).toMatch(
      /changed by someone else/,
    );
    expect(changeRoomFailure(new ApiError(409, 'x', { code: 'not-movable' })).message).toMatch(
      /can no longer be changed/,
    );
    expect(changeRoomFailure(new ApiError(404, 'x'))).toMatchObject({
      revert: true,
      refetch: true,
    });
    expect(changeRoomFailure(new ApiError(400, 'x', { code: 'invalid-query' }))).toMatchObject({
      revert: true,
      refetch: false,
    });
  });
  it('status 0, 408, 5xx and an unusable answer are an unknown outcome: no revert, reload, neutral', () => {
    for (const e of [
      new ApiError(0, 'x', { code: 'timeout' }),
      new ApiError(408, 'x'),
      new ApiError(503, 'x'),
      new ApiError(200, 'x', { code: 'invalid-response' }),
      new Error('weird'),
    ]) {
      expect(changeRoomFailure(e)).toEqual({
        revert: false,
        refetch: true,
        message: UNKNOWN_ROOM_CHANGE,
      });
    }
  });
  it('maps codes to its own copy and only shows short plain server text as a fallback', () => {
    expect(changeRoomFailure(new ApiError(422, 'Room is under renovation')).message).toBe(
      'The room change could not be completed: Room is under renovation',
    );
    expect(changeRoomFailure(new ApiError(422, '<b>bad</b> https://evil.example')).message).toBe(
      'The room change could not be completed.',
    );
  });
});
