import { createScheduleState } from '../api/scheduleData';
import { queryScheduleData } from '../api/scheduleQuery';
import { ApiError } from '../api/types';
import type { NightRoom } from '../api/types';
import {
  applyRoomPlan,
  changeRoomAvailability,
  changeRoomFailure,
  changeToast,
  confirmBlocker,
  filterChoices,
  mergeRoomPlan,
  mergeScheduleWindows,
  nightChoices,
  NO_CHANGE_REASON,
  NO_ROOM_FILTER,
  planRuns,
  planSentence,
  rateQuestion,
  revertRoomPlan,
  runText,
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

const nightsOf = (...pairs: [string, string][]): NightRoom[] =>
  pairs.map(([date, roomId]) => ({ date: `2026-10-${date}`, roomId }));

describe('nightChoices (eligibility for ONE night)', () => {
  const data = queryScheduleData(createScheduleState(T), { startDate: T, days: 14 });
  // Victor Almeida: rm-301 Suite, 10/15 to 10/20, checked in.
  const stay = { id: 'rr-14', roomTypeLocked: false, roomId: 'rm-301' };
  const choices = (
    date: string,
    over: Partial<{ stay: typeof stay; currentRoomId: string }> = {},
  ) =>
    nightChoices({
      ...data,
      stay,
      date,
      currentRoomId: 'rm-301',
      ...over,
    });
  const of = (list: ReturnType<typeof choices>, number: string) =>
    list.find((c) => c.option.number === number)!;

  it("the night's current room is always selectable", () => {
    expect(of(choices('2026-10-16'), '301')).toMatchObject({
      disabled: false,
      reason: null,
      current: true,
    });
  });
  it('a room booked on THAT night is disabled with the booking dates; the same room is free on other nights', () => {
    // rm-302 is booked 10/17 to 10/19 (Olivia Hartman).
    expect(of(choices('2026-10-17'), '302')).toMatchObject({
      disabled: true,
      reason: 'Booked 10/17-10/19',
    });
    expect(of(choices('2026-10-18'), '302').disabled).toBe(true);
    // ... but available on the night before and on the departure night (half-open range).
    expect(of(choices('2026-10-16'), '302').disabled).toBe(false);
    expect(of(choices('2026-10-19'), '302').disabled).toBe(false);
  });
  it('a room is listed even when it is not free for the whole stay (27.9.1.2.2)', () => {
    expect(of(choices('2026-10-16'), '302').disabled).toBe(false);
  });
  it('a closed room says Closed with its dates', () => {
    expect(of(choices('2026-10-17'), '208')).toMatchObject({
      disabled: true,
      reason: 'Closed 10/17-10/20',
    });
    expect(of(choices('2026-10-16'), '208').disabled).toBe(false);
  });
  it('same-day turnover: a stay that ends on the night does not block, one that starts that night does', () => {
    // rm-202: Priya Raman 10/14 to 10/16, Thomas Okafor 10/16 to 10/19.
    expect(of(choices('2026-10-16'), '202')).toMatchObject({
      disabled: true,
      reason: 'Booked 10/16-10/19',
    });
    const data2 = queryScheduleData(createScheduleState(T), { startDate: '2026-10-14', days: 14 });
    const list = nightChoices({ ...data2, stay, date: '2026-10-16', currentRoomId: 'rm-301' });
    expect(list.find((c) => c.option.number === '202')!.reason).toBe('Booked 10/16-10/19');
  });
  it('a checked-out stay that holds the night says Checked-out stay', () => {
    const blocks = data.blocks.map((b) =>
      b.id === 'rr-5' ? { ...b, status: 'checked-out' as const } : b,
    );
    const list = nightChoices({
      ...data,
      blocks,
      stay,
      date: '2026-10-17',
      currentRoomId: 'rm-301',
    });
    expect(of(list, '202').reason).toBe('Checked-out stay 10/16-10/19');
  });
  it('a locked reservation can only use rooms of its room type', () => {
    const list = choices('2026-10-17', { stay: { ...stay, roomTypeLocked: true } });
    expect(of(list, '110').disabled).toBe(false); // another Suite
    expect(of(list, '107')).toMatchObject({ disabled: true, reason: 'Locked to its room type' });
  });
  it("the stay's own parts never block: a room used on another night is free for this one", () => {
    const own = {
      ...data.blocks.find((b) => b.id === 'rr-14')!,
      id: 'rr-14~1',
      roomId: 'rm-107',
      roomChange: { part: 'next' as const, index: 2, count: 2, stayId: 'rr-14' },
      startDate: '2026-10-19',
      endDate: '2026-10-20',
    };
    const list = nightChoices({
      ...data,
      blocks: [...data.blocks, own],
      stay,
      date: '2026-10-19',
      currentRoomId: 'rm-107',
    });
    expect(of(list, '107')).toMatchObject({ disabled: false, current: true });
    const other = nightChoices({
      ...data,
      blocks: [...data.blocks, own],
      stay,
      date: '2026-10-17',
      currentRoomId: 'rm-301',
    });
    expect(other.find((c) => c.option.number === '107')!.disabled).toBe(false);
  });
  it('lists every room in grouped order (location | room type, rooms numbered naturally)', () => {
    const list = choices('2026-10-16');
    expect(list).toHaveLength(data.rooms.length);
    expect(list[0].option.group).toBe('Main Clubhouse | King Deluxe');
  });
  it('shortDate', () => expect(shortDate('2026-10-05')).toBe('10/05'));

  describe('the optional location and room type filter', () => {
    const list = () => choices('2026-10-16');
    it('narrows by location, by room type and by both, and keeps the selected room', () => {
      const lodge = filterChoices(list(), { locationId: 'north-lodge', roomTypeId: '' }, 'rm-301');
      expect(
        lodge.every((c) => c.option.locationId === 'north-lodge' || c.option.id === 'rm-301'),
      ).toBe(true);
      expect(lodge.some((c) => c.option.id === 'rm-301')).toBe(true);
      const suites = filterChoices(list(), { locationId: '', roomTypeId: 'suite' }, 'rm-301');
      expect(suites.every((c) => c.option.roomTypeId === 'suite')).toBe(true);
      const both = filterChoices(
        list(),
        { locationId: 'north-lodge', roomTypeId: 'suite' },
        'rm-301',
      );
      expect(both.map((c) => c.option.number).sort()).toEqual(['109', '110', '301']);
    });
    it('no filter keeps everything', () => {
      expect(filterChoices(list(), NO_ROOM_FILTER, 'rm-301')).toHaveLength(data.rooms.length);
    });
  });
});

describe('the plan', () => {
  const rooms = [
    { id: 'rm-301', number: '301' },
    { id: 'rm-107', number: '107' },
  ];
  const current = nightsOf(['16', 'rm-301'], ['17', 'rm-301'], ['18', 'rm-301'], ['19', 'rm-301']);

  it('confirm is blocked with a reason until a night changes', () => {
    expect(confirmBlocker(current, current)).toBe(NO_CHANGE_REASON);
    expect(
      confirmBlocker(
        current,
        nightsOf(['16', 'rm-301'], ['17', 'rm-107'], ['18', 'rm-301'], ['19', 'rm-301']),
      ),
    ).toBeNull();
  });
  it('a night put back in its room is no change again', () => {
    expect(confirmBlocker(current, [...current])).not.toBeNull();
  });
  it('groups consecutive nights in one room and flags runs with a changed night', () => {
    const plan = nightsOf(['16', 'rm-301'], ['17', 'rm-107'], ['18', 'rm-107'], ['19', 'rm-301']);
    const runs = planRuns(plan, current, rooms);
    expect(runs.map(runText)).toEqual([
      'Room 301: 10/16/2026 to 10/17/2026 (1 night)',
      'Room 107: 10/17/2026 to 10/19/2026 (2 nights)',
      'Room 301: 10/19/2026 to 10/20/2026 (1 night)',
    ]);
    expect(runs.map((r) => r.changed)).toEqual([false, true, false]);
    expect(planSentence('2026-10-16', '2026-10-20')).toBe(
      'New room plan effective 10/16/2026 through 10/20/2026',
    );
  });
  it('the toast names the room when one room takes the changed nights', () => {
    expect(
      changeToast(
        current,
        nightsOf(['16', 'rm-301'], ['17', 'rm-107'], ['18', 'rm-107'], ['19', 'rm-301']),
        rooms,
      ),
    ).toBe('Moved to Room 107');
    expect(
      changeToast(
        current,
        nightsOf(['16', 'rm-107'], ['17', 'rm-301'], ['18', 'rm-301'], ['19', 'rm-301']),
        rooms,
      ),
    ).toBe('Moved to Room 107');
    expect(
      changeToast(
        current,
        nightsOf(['16', 'rm-107'], ['17', 'rm-301'], ['18', 'rm-301'], ['19', 'rm-X']),
        [...rooms, { id: 'rm-X', number: 'X' }],
      ),
    ).toBe('Rooms updated for the remaining nights');
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

describe('rateQuestion (per night)', () => {
  const line = (date: string, amountCents: number, id = 'rr-14') => ({
    roomType: 'Suite',
    date: `2026-10-${date}`,
    amountCents,
    reservationRoomId: id,
  });
  const detail = {
    stay: {
      folioTotalCents: 0,
      lines: [
        line('15', 34900),
        line('16', 34900),
        line('17', 34900),
        line('18', 34900),
        line('19', 34900),
        line('16', 99900, 'rr-other'),
      ],
    },
  };
  const current = nightsOf(['16', 'rm-301'], ['17', 'rm-301'], ['18', 'rm-301'], ['19', 'rm-301']);
  const rates: Record<string, number | null> = {
    'rm-301': 34900,
    'rm-110': 34900,
    'rm-107': 19900,
    'rm-X': null,
  };
  const base = {
    detail,
    reservationRoomId: 'rr-14',
    current,
    newRateCents: (id: string) => rates[id] ?? null,
    today: T,
    ask: true,
  };
  const plan = (...rooms: string[]) => current.map((n, i) => ({ ...n, roomId: rooms[i] }));

  it('asks when a changed night has another rate, and prices each answer for the changed nights only', () => {
    const q = rateQuestion({ ...base, plan: plan('rm-301', 'rm-107', 'rm-107', 'rm-301') });
    expect(q).toMatchObject({
      asked: true,
      ratesDiffer: true,
      changedNights: 2,
      currentRate: '$349.00',
      newRate: '$199.00',
      updateDeltaCents: -30000,
      repricedNights: 2,
    });
  });
  it('does not ask when the changed nights have the same rate', () => {
    expect(
      rateQuestion({ ...base, plan: plan('rm-301', 'rm-110', 'rm-301', 'rm-301') }),
    ).toMatchObject({
      asked: false,
      ratesDiffer: false,
      updateDeltaCents: 0,
    });
  });
  it('does not ask when the setting is off, but still prices the update', () => {
    expect(
      rateQuestion({ ...base, ask: false, plan: plan('rm-107', 'rm-301', 'rm-301', 'rm-301') }),
    ).toMatchObject({
      asked: false,
      ratesDiffer: true,
      updateDeltaCents: -15000,
    });
  });
  it('mixed new rooms say the rate varies', () => {
    const q = rateQuestion({ ...base, plan: plan('rm-107', 'rm-110', 'rm-301', 'rm-301') });
    expect(q.newRate).toBe('varies by night');
  });
  it('a nights that keeps its room is never repriced, even if its room type rate differs now', () => {
    const q = rateQuestion({
      ...base,
      newRateCents: (id) => (id === 'rm-301' ? 1 : 19900),
      plan: plan('rm-301', 'rm-107', 'rm-301', 'rm-301'),
    });
    expect(q.repricedNights).toBe(1);
  });
  it('an unknown new rate asks (setting on) without amounts', () => {
    const q = rateQuestion({ ...base, plan: plan('rm-301', 'rm-X', 'rm-301', 'rm-301') });
    expect(q).toMatchObject({ asked: true, newRate: null, changedNights: 1 });
    expect(
      rateQuestion({ ...base, ask: false, plan: plan('rm-301', 'rm-X', 'rm-301', 'rm-301') }).asked,
    ).toBe(false);
  });
  it('a stayed night is never part of the question', () => {
    const q = rateQuestion({
      ...base,
      today: '2026-10-18',
      plan: plan('rm-107', 'rm-107', 'rm-301', 'rm-301'),
    });
    expect(q.changedNights).toBe(0);
    expect(q.asked).toBe(false);
  });
  it('only looks at the nights of this reservation room', () => {
    const q = rateQuestion({
      ...base,
      newRateCents: () => 99900,
      plan: plan('rm-301', 'rm-107', 'rm-301', 'rm-301'),
    });
    expect(q.updateDeltaCents).toBe(65000);
  });
});

describe('toChangeRoomRequest', () => {
  const block = { id: 'rr-14', roomId: 'rm-301', version: 'v1' };
  const plan = nightsOf(['16', 'rm-301'], ['17', 'rm-107']);
  const base = { block, plan, requestId: 'req-12345678' };
  it('carries the guard (room, version) and the whole remaining plan', () => {
    expect(toChangeRoomRequest({ ...base, asked: true, answer: 'retain' })).toEqual({
      requestId: 'req-12345678',
      reservationRoomId: 'rr-14',
      fromRoomId: 'rm-301',
      nights: plan,
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
  const victor = data.blocks.find((b) => b.id === 'rr-14')!;
  const plan = (...rooms: string[]) =>
    ['16', '17', '18', '19'].map((d, i) => ({ date: `2026-10-${d}`, roomId: rooms[i] }));
  const shape = (blocks: typeof data.blocks) =>
    blocks
      .filter((b) => b.reservationId === 'rs-11')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((b) =>
        [b.roomChange?.part, b.roomId, b.startDate.slice(8), b.endDate.slice(8), b.status].join(
          ' ',
        ),
      );

  it('last night only: the stayed night stays behind, the rest is one part, the last night another', () => {
    const next = applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-301', 'rm-301', 'rm-107'),
    });
    expect(shape(next)).toEqual([
      'previous rm-301 15 16 checked-out',
      'current rm-301 16 19 checked-in',
      'next rm-107 19 20 checked-in',
    ]);
    expect(next.filter((b) => b.reservationId === 'rs-11').map((b) => b.roomChange!.count)).toEqual(
      [3, 3, 3],
    );
  });
  it('a middle night makes four parts; ids of new parts are temporary, the current one keeps its id', () => {
    const next = applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-107', 'rm-301', 'rm-301'),
    });
    expect(shape(next)).toHaveLength(4);
    const ids = next.filter((b) => b.reservationId === 'rs-11').map((b) => b.id);
    expect(ids).toContain('rr-14');
    expect(ids.filter((id) => id.includes('pending'))).toHaveLength(3);
  });
  it('all remaining nights in one other room: two parts', () => {
    const next = applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-110', 'rm-110', 'rm-110', 'rm-110'),
    });
    expect(shape(next)).toEqual([
      'previous rm-301 15 16 checked-out',
      'current rm-110 16 20 checked-in',
    ]);
  });
  it('arrival today: no stayed night, so no previous part', () => {
    const arrivesToday = data.blocks.map((b) => (b.id === 'rr-14' ? { ...b, startDate: T } : b));
    const next = applyRoomPlan(arrivesToday, {
      stayId: 'rr-14',
      plan: plan('rm-110', 'rm-110', 'rm-110', 'rm-110'),
    });
    expect(shape(next)).toEqual(['current rm-110 16 20 checked-in']);
  });
  it('early check in stays on the first part and late check out on the last', () => {
    const flagged = data.blocks.map((b) =>
      b.id === 'rr-14' ? { ...b, earlyCheckIn: true, lateCheckOut: true } : b,
    );
    const next = applyRoomPlan(flagged, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-301', 'rm-107', 'rm-107'),
    });
    const parts = next
      .filter((b) => b.reservationId === 'rs-11')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    expect(parts.map((b) => b.earlyCheckIn)).toEqual([true, undefined, undefined]);
    expect(parts.map((b) => b.lateCheckOut)).toEqual([undefined, undefined, true]);
  });
  it('does nothing for an unknown stay and does not mutate its input', () => {
    const before = structuredClone(data.blocks);
    expect(applyRoomPlan(data.blocks, { stayId: 'nope', plan: plan('a', 'b', 'c', 'd') })).toEqual(
      before,
    );
    applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-107', 'rm-301', 'rm-301'),
    });
    expect(data.blocks).toEqual(before);
  });
  it('revert restores the stay as it was', () => {
    const next = applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-107', 'rm-301', 'rm-301'),
    });
    const back = revertRoomPlan(next, [victor], 'rr-14');
    expect(back.filter((b) => b.reservationId === 'rs-11')).toEqual([victor]);
    expect(back).toHaveLength(data.blocks.length);
  });
  it("merging the answer replaces the optimistic blocks with the server's", () => {
    const optimistic = applyRoomPlan(data.blocks, {
      stayId: 'rr-14',
      plan: plan('rm-301', 'rm-301', 'rm-301', 'rm-107'),
    });
    const server = optimistic
      .filter((b) => b.reservationId === 'rs-11')
      .map((b, i) => ({ ...b, id: b.id.includes('pending') ? `rr-14~${i}` : b.id, version: 'v9' }));
    const merged = mergeRoomPlan({ ...data, blocks: optimistic }, 'rr-14', server);
    expect(merged.some((b) => b.id.includes('pending'))).toBe(false);
    expect(merged.filter((b) => b.reservationId === 'rs-11')).toHaveLength(3);
    expect(merged.every((b) => b.reservationId !== 'rs-11' || b.version === 'v9')).toBe(true);
  });
  it('merging drops changed blocks outside the loaded window', () => {
    const narrow = { startDate: '2026-10-30', days: 7 as const, blocks: [] as typeof data.blocks };
    expect(mergeRoomPlan(narrow, 'rr-14', [victor])).toEqual([]);
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
