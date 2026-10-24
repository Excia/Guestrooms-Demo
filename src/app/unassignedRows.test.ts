import { describe, expect, it } from 'vitest';
import type { ScheduleBlock } from '../api/types';
import { unassignedLabel, unassignedSection, unassignedToggleName } from './unassignedRows';

const block = (id: string, startDate: string, endDate: string): ScheduleBlock => ({
  kind: 'reservation',
  id,
  reservationId: `rs-${id}`,
  confirmationNumber: `GR-${id}`,
  guestName: id,
  guestType: 'guest',
  roomId: '',
  startDate,
  endDate,
  status: 'confirmed',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
});

const a = block('a', '2026-10-17', '2026-10-19');
const b = block('b', '2026-10-16', '2026-10-18');
const far = block('far', '2026-12-01', '2026-12-03');

describe('unassignedSection', () => {
  it('keeps one collapsed label row with a disabled toggle when nothing is unassigned', () => {
    for (const collapsed of [false, true]) {
      expect(unassignedSection([], '2026-10-16', 7, collapsed)).toEqual({
        state: 'empty',
        count: 0,
        rows: [[]],
        toggleable: true,
        toggleDisabled: true,
      });
    }
    expect(unassignedSection([far], '2026-10-16', 7, false).state).toBe('empty');
  });

  it('shows a single reservation as one row without a toggle, collapsed or not', () => {
    for (const collapsed of [false, true]) {
      const s = unassignedSection([a, far], '2026-10-16', 7, collapsed);
      expect(s).toMatchObject({
        state: 'single',
        count: 1,
        toggleable: false,
        toggleDisabled: false,
      });
      expect(s.rows).toEqual([[a]]);
    }
  });

  it('expands two or more by default: one row per reservation room, by arrival', () => {
    const s = unassignedSection([a, b], '2026-10-16', 7, false);
    expect(s).toMatchObject({ state: 'expanded', count: 2, toggleable: true });
    expect(s.rows).toEqual([[b], [a]]);
  });

  it('collapses to one label row with the count and no blocks', () => {
    const s = unassignedSection([a, b], '2026-10-16', 7, true);
    expect(s).toMatchObject({ state: 'collapsed', count: 2, toggleable: true });
    expect(s.rows).toEqual([[]]);
  });

  it('counts only what is in the visible range', () => {
    expect(unassignedSection([a, b, far], '2026-10-16', 7, false).count).toBe(2);
    // a stay ending on the first day does not overlap (departure day is not occupied)
    expect(
      unassignedSection([block('x', '2026-10-14', '2026-10-16')], '2026-10-16', 7, false).state,
    ).toBe('empty');
  });
});

describe('labels', () => {
  it('shows the count only while collapsed', () => {
    const two = [a, b];
    expect(unassignedLabel(unassignedSection(two, '2026-10-16', 7, false))).toEqual({
      title: 'Unassigned',
    });
    expect(unassignedLabel(unassignedSection(two, '2026-10-16', 7, true))).toEqual({
      title: 'Unassigned',
      count: '(2)',
    });
  });

  it('labels the empty row "Unassigned (0)"', () => {
    expect(unassignedLabel(unassignedSection([], '2026-10-16', 7, false))).toEqual({
      title: 'Unassigned',
      count: '(0)',
    });
  });

  it('names the toggle with one fixed name, whatever the state', () => {
    expect(unassignedToggleName()).toBe('Unassigned reservations');
  });
});
