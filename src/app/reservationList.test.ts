import type { ListStatus, ReservationListRow } from '../api';
import {
  defaultCheckInRange,
  formatListDate,
  headerCheckState,
  isCanceled,
  isSelectable,
  roomLabel,
  roomLabelText,
  selectableRows,
  selectedRows,
  toggleAllRows,
  toggleRow,
} from './reservationList';

const row = (
  id: string,
  ...rooms: (ListStatus | [ListStatus, string | null])[]
): ReservationListRow => {
  const list = rooms.map((r, i) => {
    const [status, roomNumber] = Array.isArray(r) ? r : [r, `${100 + i}`];
    return { id: `${id}-${i}`, status, roomNumber };
  });
  return {
    id,
    confirmationNumber: id.toUpperCase(),
    arrival: '2026-10-16',
    departure: '2026-10-18',
    guestName: 'G',
    reserverName: null,
    blockName: null,
    locationId: null,
    locationName: null,
    roomTypeId: null,
    roomTypeName: null,
    rooms: list,
    status: list[0].status,
  };
};

describe('defaultCheckInRange', () => {
  it('is today through the next 7 days', () => {
    expect(defaultCheckInRange('2026-10-16')).toEqual({ from: '2026-10-16', to: '2026-10-23' });
    expect(defaultCheckInRange('2026-12-28')).toEqual({ from: '2026-12-28', to: '2027-01-04' });
  });
});

describe('roomLabel', () => {
  it('shows the room number of a single room', () => {
    expect(roomLabel(row('a', 'not-checked-in'))).toEqual({
      text: '100',
      unassigned: false,
      extra: 0,
    });
  });
  it('shows +N for the extra rooms of a multi-room reservation', () => {
    expect(roomLabel(row('a', 'not-checked-in', 'not-checked-in'))).toMatchObject({ extra: 1 });
    expect(roomLabelText(row('a', 'not-checked-in', 'not-checked-in', 'not-checked-in'))).toBe(
      '100 +2',
    );
  });
  it('shows Unassigned in the error treatment, with +N when more rooms follow', () => {
    const one = row('a', ['not-checked-in', null]);
    expect(roomLabel(one)).toEqual({ text: 'Unassigned', unassigned: true, extra: 0 });
    const two = row('b', ['not-checked-in', null], 'not-checked-in');
    expect(roomLabelText(two)).toBe('Unassigned +1');
  });
});

describe('isCanceled', () => {
  it('follows the reservation status', () => {
    expect(isCanceled({ status: 'canceled' })).toBe(true);
    expect(isCanceled({ status: 'checked-in' })).toBe(false);
  });
});

describe('isSelectable', () => {
  it('is false for single rooms checked in, checked out or canceled', () => {
    expect(isSelectable(row('a', 'checked-in'))).toBe(false);
    expect(isSelectable(row('b', 'checked-out'))).toBe(false);
    expect(isSelectable(row('c', 'canceled'))).toBe(false);
  });
  it('is true for a single room not yet checked in, even if unassigned', () => {
    expect(isSelectable(row('a', 'not-checked-in'))).toBe(true);
    expect(isSelectable(row('b', ['not-checked-in', null]))).toBe(true);
  });
  it('is true for a multi-room reservation with a room still to check in', () => {
    expect(isSelectable(row('a', 'not-checked-in', 'not-checked-in'))).toBe(true);
    expect(isSelectable(row('b', 'checked-in', 'not-checked-in'))).toBe(true);
  });
  it('is false for a multi-room reservation with nothing left to check in', () => {
    expect(isSelectable(row('a', 'checked-in', 'checked-in'))).toBe(false);
    expect(isSelectable(row('b', 'checked-in', 'checked-out'))).toBe(false);
  });
});

describe('selection', () => {
  const rows = [
    row('a', 'not-checked-in'),
    row('b', 'checked-in'),
    row('c', 'not-checked-in', 'checked-in'),
    row('d', 'canceled'),
  ];
  it('select-all selects only the selectable rows', () => {
    expect(selectableRows(rows).map((r) => r.id)).toEqual(['a', 'c']);
    expect([...toggleAllRows(rows, new Set())]).toEqual(['a', 'c']);
  });
  it('select-all clears when everything selectable is selected', () => {
    expect(toggleAllRows(rows, new Set(['a', 'c'])).size).toBe(0);
    expect([...toggleAllRows(rows, new Set(['a']))]).toEqual(['a', 'c']);
  });
  it('reports the header checkbox state from selectable rows only', () => {
    expect(headerCheckState(rows, new Set())).toBe('none');
    expect(headerCheckState(rows, new Set(['a']))).toBe('some');
    expect(headerCheckState(rows, new Set(['a', 'c']))).toBe('all');
    expect(headerCheckState([row('x', 'checked-in')], new Set())).toBe('none');
  });
  it('toggles one row without touching the others', () => {
    const one = toggleRow(new Set(['a']), 'c');
    expect([...one].sort()).toEqual(['a', 'c']);
    expect([...toggleRow(one, 'a')]).toEqual(['c']);
  });
  it('exposes the selected rows in table order, dropping stale or unselectable ids', () => {
    expect(selectedRows(rows, new Set(['c', 'a', 'b', 'gone'])).map((r) => r.id)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('formatListDate', () => {
  it('is MM/DD/YY', () => {
    expect(formatListDate('2026-10-16')).toBe('10/16/26');
    expect(formatListDate('nonsense')).toBe('nonsense');
  });
});

describe('bulk check in only takes today (ticket 163)', () => {
  const on = (arrival: string, ...rooms: ListStatus[]) => ({
    ...row('x', ...rooms),
    arrival,
  });
  it('a reservation that arrived earlier is not selectable, even with rooms left to check in', () => {
    expect(isSelectable(on('2026-10-15', 'not-checked-in'), '2026-10-16')).toBe(false);
    expect(isSelectable(on('2026-10-15', 'checked-in', 'not-checked-in'), '2026-10-16')).toBe(
      false,
    );
  });
  it('a future arrival is not selectable either', () => {
    expect(isSelectable(on('2026-10-17', 'not-checked-in'), '2026-10-16')).toBe(false);
  });
  it("today's arrival with a room left is selectable; with none left it is not", () => {
    expect(isSelectable(on('2026-10-16', 'not-checked-in'), '2026-10-16')).toBe(true);
    expect(isSelectable(on('2026-10-16', 'checked-in', 'not-checked-in'), '2026-10-16')).toBe(true);
    expect(isSelectable(on('2026-10-16', 'checked-in'), '2026-10-16')).toBe(false);
  });
  it('with an unknown club date (null) nothing is selectable', () => {
    expect(isSelectable(on('2026-10-16', 'not-checked-in'), null)).toBe(false);
    expect(selectableRows([on('2026-10-16', 'not-checked-in')], null)).toEqual([]);
  });
  it('without a date the date is not considered', () => {
    expect(isSelectable(on('2026-10-01', 'not-checked-in'))).toBe(true);
  });
  it('select-all, the header state and the chosen rows follow the same rule', () => {
    const rows = [
      { ...on('2026-10-15', 'not-checked-in'), id: 'old' },
      { ...on('2026-10-16', 'not-checked-in'), id: 'today' },
    ];
    expect([...toggleAllRows(rows, new Set(), '2026-10-16')]).toEqual(['today']);
    expect(headerCheckState(rows, new Set(['today']), '2026-10-16')).toBe('all');
    expect(selectedRows(rows, new Set(['old', 'today']), '2026-10-16').map((r) => r.id)).toEqual([
      'today',
    ]);
    expect(selectableRows(rows, '2026-10-16').map((r) => r.id)).toEqual(['today']);
  });
});
