import type { NightRoom } from '../api/types';
import {
  changedNights,
  isChange,
  isContiguous,
  normalizeRuns,
  planFromBlocks,
  planProblem,
  remainingDates,
  stayOf,
} from './stayPlan';

const n = (...rooms: string[]): NightRoom[] =>
  rooms.map((roomId, i) => ({ date: `2026-10-${String(16 + i).padStart(2, '0')}`, roomId }));

describe('normalizeRuns', () => {
  it('merges consecutive nights in the same room', () => {
    expect(normalizeRuns(n('A', 'A', 'B', 'B', 'B'))).toEqual([
      { roomId: 'A', startDate: '2026-10-16', endDate: '2026-10-18' },
      { roomId: 'B', startDate: '2026-10-18', endDate: '2026-10-21' },
    ]);
  });
  it('a middle night in another room makes three runs; returning to a room later is a new run', () => {
    expect(normalizeRuns(n('A', 'B', 'A')).map((r) => r.roomId)).toEqual(['A', 'B', 'A']);
  });
  it('one room for every night is one run; no nights is no run', () => {
    expect(normalizeRuns(n('A', 'A', 'A'))).toHaveLength(1);
    expect(normalizeRuns([])).toEqual([]);
  });
  it('does not merge across a gap', () => {
    const gap = [n('A')[0], { date: '2026-10-18', roomId: 'A' }];
    expect(normalizeRuns(gap)).toHaveLength(2);
  });
});

describe('planProblem', () => {
  const from = '2026-10-16';
  const end = '2026-10-19';
  it('accepts exactly the remaining nights', () => {
    expect(planProblem(n('A', 'B', 'B'), from, end)).toBeNull();
  });
  it('refuses a missing, extra, repeated or stayed night', () => {
    expect(planProblem(n('A', 'B'), from, end)).toBe('nights');
    expect(planProblem(n('A', 'B', 'B', 'B'), from, end)).toBe('nights');
    expect(planProblem([n('A')[0], n('A')[0], n('A')[0]], from, end)).toBe('nights');
    expect(planProblem(n('A', 'B', 'B'), '2026-10-15', end)).toBe('nights');
  });
  it('refuses a night without a room', () => {
    expect(planProblem(n('A', '', 'B'), from, end)).toBe('room');
  });
  it('remainingDates and isContiguous', () => {
    expect(remainingDates(from, end)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    expect(remainingDates(end, from)).toEqual([]);
    expect(isContiguous(n('A', 'B'))).toBe(true);
    expect(isContiguous([])).toBe(false);
    expect(isContiguous([n('A')[0], { date: '2026-10-18', roomId: 'A' }])).toBe(false);
  });
});

describe('changes', () => {
  it('lists the nights whose room differs', () => {
    expect(changedNights(n('A', 'A', 'A'), n('A', 'B', 'A'))).toEqual(['2026-10-17']);
    expect(isChange(n('A', 'A'), n('A', 'A'))).toBe(false);
    expect(isChange(n('A', 'A'), n('A', 'B'))).toBe(true);
  });
  it('reverting a night to its original room is no change for that night', () => {
    expect(changedNights(n('A', 'A'), n('A', 'A'))).toEqual([]);
  });
});

describe('planFromBlocks and stayOf', () => {
  it('reads the room of each night from the blocks', () => {
    const blocks = [
      { roomId: 'A', startDate: '2026-10-15', endDate: '2026-10-17' },
      { roomId: 'B', startDate: '2026-10-17', endDate: '2026-10-19' },
    ];
    expect(planFromBlocks(blocks, '2026-10-16', '2026-10-19')).toEqual([
      { date: '2026-10-16', roomId: 'A' },
      { date: '2026-10-17', roomId: 'B' },
      { date: '2026-10-18', roomId: 'B' },
    ]);
  });
  it('stayOf is the stay id of a segment, else the block id', () => {
    expect(
      stayOf({ id: 'rr-2~3', roomChange: { part: 'next', index: 3, count: 3, stayId: 'rr-2' } }),
    ).toBe('rr-2');
    expect(stayOf({ id: 'rr-2' })).toBe('rr-2');
  });
});
