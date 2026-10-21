import { describe, expect, it } from 'vitest';
import type { Folio, FolioCharge } from '../api/types';
import {
  ALL_OCCUPANTS,
  balanceTone,
  chargeCountText,
  chargeStatusLabel,
  filterCharges,
  folioBalances,
  isFilterApplied,
  isSelectable,
  occupantFilterOptions,
  referenceDisplay,
  rowActions,
  selectionActions,
  selectionTotalCents,
} from './folio';

const charge = (over: Partial<FolioCharge> = {}): FolioCharge => ({
  id: 'c1',
  type: 'room-rate',
  date: '2026-10-16',
  description: 'Rm 101',
  amountCents: 10000,
  status: 'posted',
  references: [],
  roomId: 'rr1',
  occupantId: null,
  ...over,
});

describe('folioBalances', () => {
  it('sums posted and unposted lines separately and ignores settled and split ones', () => {
    const b = folioBalances([
      charge({ amountCents: 100, status: 'posted' }),
      charge({ amountCents: 250, status: 'posted' }),
      charge({ amountCents: 400, status: 'unposted' }),
      charge({ amountCents: 999, status: 'settled' }),
      charge({ amountCents: 999, status: 'split' }),
    ]);
    expect(b).toEqual({ postedCents: 350, unpostedCents: 400 });
  });
  it('is zero for an empty folio', () => {
    expect(folioBalances([])).toEqual({ postedCents: 0, unpostedCents: 0 });
  });
});

describe('balanceTone', () => {
  const tone = (
    checkInStatus: Folio['checkInStatus'],
    open: boolean,
    postedCents: number,
    unpostedCents: number,
  ) => balanceTone({ checkInStatus, open }, { postedCents, unpostedCents });

  it('is grey when not yet checked in', () => {
    expect(tone('not-checked-in', true, 0, 200000)).toBe('grey');
  });
  it('is grey when the folio is closed ($0 balance)', () => {
    expect(tone('checked-out', false, 0, 0)).toBe('grey');
  });
  it('is yellow when checked in', () => {
    expect(tone('checked-in', true, 100000, 100000)).toBe('yellow');
    expect(tone('checked-in', true, 0, 0)).toBe('yellow');
  });
  it('is yellow when checked out with unposted charges not equal to $0', () => {
    expect(tone('checked-out', true, 0, 100000)).toBe('yellow');
    expect(tone('checked-out', true, 0, -500)).toBe('yellow');
  });
  it('is green when checked out, open and settled ($0)', () => {
    expect(tone('checked-out', true, 0, 0)).toBe('green');
  });
  it('is red when checked out, open and the posted balance is above $0', () => {
    expect(tone('checked-out', true, 200000, 0)).toBe('red');
  });
  it('lets red win over yellow when a checked-out folio has both', () => {
    expect(tone('checked-out', true, 200000, 5000)).toBe('red');
  });
});

describe('occupant filter', () => {
  const rooms = [
    { id: 'rr1', number: '101' },
    { id: 'rr2', number: null },
  ];
  const occupants = [
    { id: 'o1', name: 'Ann Lee', roomId: 'rr1' },
    { id: 'o2', name: 'Bo Kim', roomId: 'rr1' },
    { id: 'o3', name: 'Cy Day', roomId: 'rr2' },
  ];
  const charges = [
    charge({ id: 'a', roomId: 'rr1', occupantId: null }),
    charge({ id: 'b', roomId: 'rr1', occupantId: 'o1' }),
    charge({ id: 'c', roomId: 'rr1', occupantId: 'o2' }),
    charge({ id: 'd', roomId: 'rr2', occupantId: 'o3' }),
    charge({ id: 'e', roomId: null, occupantId: null }),
  ];
  const ids = (list: FolioCharge[]) => list.map((c) => c.id);

  it('lists All, then each room followed by its occupants', () => {
    const options = occupantFilterOptions(rooms, occupants);
    expect(options.map((o) => o.label)).toEqual([
      'All',
      'Room 101',
      'Room 101 - Ann Lee',
      'Room 101 - Bo Kim',
      'Unassigned room',
      'Unassigned room - Cy Day',
    ]);
    expect(options.find((o) => o.value === 'room:rr2')?.groupStart).toBe(true);
    expect(options.find((o) => o.value === 'room:rr1')?.groupStart).toBe(false);
  });
  it('All shows every charge, including lines that belong to no room', () => {
    expect(ids(filterCharges(charges, ALL_OCCUPANTS))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('a room shows all of its lines, room-level ones included', () => {
    expect(ids(filterCharges(charges, 'room:rr1'))).toEqual(['a', 'b', 'c']);
  });
  it('an occupant shows only the lines charged to them', () => {
    expect(ids(filterCharges(charges, 'occupant:o1'))).toEqual(['b']);
  });
  it('an unknown value shows everything', () => {
    expect(filterCharges(charges, 'bogus')).toHaveLength(5);
  });
  it('is applied for a known value other than All', () => {
    const options = occupantFilterOptions(rooms, occupants);
    expect(isFilterApplied('all', options)).toBe(false);
    expect(isFilterApplied('room:rr1', options)).toBe(true);
    expect(isFilterApplied('room:gone', options)).toBe(false);
  });
  it('words the count row', () => {
    expect(chargeCountText(3, 10, 'Room 101 - Ann Lee')).toBe(
      'Showing 3/10 Charges - Viewed by Room 101 - Ann Lee',
    );
  });
});

describe('selection', () => {
  it('only posted and unposted lines have a checkbox', () => {
    expect(isSelectable(charge({ status: 'posted' }))).toBe(true);
    expect(isSelectable(charge({ status: 'unposted' }))).toBe(true);
    expect(isSelectable(charge({ status: 'settled' }))).toBe(false);
    expect(isSelectable(charge({ status: 'split' }))).toBe(false);
  });
  it('totals the selected lines', () => {
    expect(selectionTotalCents([])).toBe(0);
    expect(selectionTotalCents([charge({ amountCents: 1050 }), charge({ amountCents: 250 })])).toBe(
      1300,
    );
  });
  it('enables nothing without a selection or on a closed folio', () => {
    expect(selectionActions([], true)).toEqual({ split: false, transfer: false, settle: false });
    expect(selectionActions([charge()], false)).toEqual({
      split: false,
      transfer: false,
      settle: false,
    });
  });
  it('enables split and settle for posted lines, transfer only for manual and MPOS ones', () => {
    expect(selectionActions([charge()], true)).toEqual({
      split: true,
      settle: true,
      transfer: false,
    });
    expect(selectionActions([charge({ type: 'mpos' }), charge({ type: 'manual' })], true)).toEqual({
      split: true,
      settle: true,
      transfer: true,
    });
  });
  it('disables all three when an unposted line is in the selection', () => {
    expect(
      selectionActions([charge({ type: 'manual' }), charge({ status: 'unposted' })], true),
    ).toEqual({ split: false, settle: false, transfer: false });
  });
});

describe('rowActions', () => {
  it('offers Post, and Edit or Delete by type, on unposted lines', () => {
    expect(rowActions(charge({ status: 'unposted' }))).toEqual({
      post: true,
      edit: true,
      remove: false,
      transfer: false,
    });
    expect(rowActions(charge({ status: 'unposted', type: 'manual' }))).toMatchObject({
      post: true,
      remove: true,
      edit: false,
    });
  });
  it('offers Transfer on posted and settled MPOS lines', () => {
    expect(rowActions(charge({ type: 'mpos' })).transfer).toBe(true);
    expect(rowActions(charge({ type: 'mpos', status: 'settled' })).transfer).toBe(true);
    expect(rowActions(charge({ type: 'room-rate' })).transfer).toBe(false);
  });
  it('offers nothing on a settled room rate', () => {
    expect(rowActions(charge({ status: 'settled' }))).toEqual({
      post: false,
      edit: false,
      remove: false,
      transfer: false,
    });
  });
});

describe('referenceDisplay', () => {
  it('shows one number', () => {
    expect(referenceDisplay(['123'])).toEqual({ text: 'Ref #123', full: null });
  });
  it('shows up to three numbers in full', () => {
    expect(referenceDisplay(['789', '910', '111'])).toEqual({
      text: 'Ref #789, #910, #111',
      full: null,
    });
  });
  it('cuts after three and keeps the full list for the hover text', () => {
    expect(referenceDisplay(['1', '2', '3', '4', '5'])).toEqual({
      text: 'Ref #1, #2, #3, …',
      full: 'Ref #1, #2, #3, #4, #5',
    });
  });
  it('labels a settled line with its references', () => {
    expect(chargeStatusLabel(charge({ status: 'settled', references: ['456'] }))).toEqual({
      text: 'Settled - Ref #456',
      full: null,
    });
    expect(
      chargeStatusLabel(charge({ status: 'settled', references: ['1', '2', '3', '4'] })).full,
    ).toBe('Settled - Ref #1, #2, #3, #4');
    expect(chargeStatusLabel(charge({ status: 'unposted' })).text).toBe('Unposted');
  });
});
