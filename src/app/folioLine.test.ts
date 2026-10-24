import { describe, expect, it } from 'vitest';
import type { FolioCharge, FolioChargeStatus, FolioLineType } from '../api/types';
import { lineActions, selectionActions, type LineActions } from './folioLine';

const TODAY = '2026-10-16';
const ctx = { today: TODAY };

const line = (
  type: FolioLineType,
  status: FolioChargeStatus,
  over: Partial<FolioCharge> = {},
): FolioCharge => ({
  id: 'x',
  type,
  date: TODAY,
  description: 'x',
  amountCents: 1000,
  status,
  references: status === 'settled' ? ['1'] : [],
  roomId: null,
  occupantId: null,
  ...over,
});

const NONE: LineActions = {
  select: false,
  split: 'no',
  transfer: 'no',
  transferUnassignedOnly: false,
  settle: false,
  post: false,
  edit: false,
  delete: false,
  editSplit: false,
};

// One case per variation of Figma 16480:83130, plus the fee lines the API adds on settle.
const CASES: [string, FolioCharge, Partial<LineActions>][] = [
  [
    'room rate, posted, not settled',
    line('room-rate', 'posted'),
    { select: true, split: 'allowed', settle: true },
  ],
  [
    'room rate, unposted on its date',
    line('room-rate', 'unposted', { date: TODAY }),
    { post: true, edit: true },
  ],
  [
    'room rate, unposted and overdue (before today)',
    line('room-rate', 'unposted', { date: '2026-10-14' }),
    { post: true, edit: true },
  ],
  [
    'room rate, unposted before its date',
    line('room-rate', 'unposted', { date: '2026-10-20' }),
    { select: true, settle: true, edit: true },
  ],
  ['room rate, settled', line('room-rate', 'settled'), {}],
  [
    'MPOS charge, posted, not settled',
    line('mpos', 'posted'),
    { select: true, split: 'allowed', transfer: 'allowed', settle: true },
  ],
  [
    'MPOS charge, settled (transfer to Unassigned only)',
    line('mpos', 'settled'),
    { transfer: 'allowed', transferUnassignedOnly: true },
  ],
  ['manual charge, unposted', line('manual', 'unposted'), { post: true, delete: true }],
  [
    'manual charge, posted, not settled',
    line('manual', 'posted'),
    { select: true, split: 'allowed', transfer: 'allowed', settle: true },
  ],
  ['manual charge, settled', line('manual', 'settled'), {}],
  ['add-on, unposted', line('add-on', 'unposted'), { post: true, delete: true }],
  [
    'add-on, posted, not settled (cannot transfer)',
    line('add-on', 'posted'),
    { select: true, split: 'allowed', settle: true },
  ],
  ['add-on, settled', line('add-on', 'settled'), {}],
  ['split item parent', line('split-parent', 'split'), { editSplit: true }],
  [
    'split item child, posted, not settled (split and transfer are refused with an error)',
    line('split-child', 'posted'),
    { select: true, split: 'error', transfer: 'error', settle: true },
  ],
  ['split item child, settled', line('split-child', 'settled'), {}],
  ['surcharge (settled)', line('surcharge', 'settled'), {}],
  ['service fee (settled)', line('service-fee', 'settled'), {}],
];

describe('lineActions', () => {
  it.each(CASES)('%s', (_name, charge, expected) => {
    expect(lineActions(charge, ctx)).toEqual({ ...NONE, ...expected });
  });

  it('never offers a checkbox on a settled line, whatever the type', () => {
    for (const type of ['room-rate', 'mpos', 'manual', 'add-on', 'split-child'] as const) {
      expect(lineActions(line(type, 'settled'), ctx).select).toBe(false);
    }
  });

  it('never lets daily room rates, add-ons or split items be transferred', () => {
    expect(lineActions(line('room-rate', 'posted'), ctx).transfer).toBe('no');
    expect(lineActions(line('add-on', 'posted'), ctx).transfer).toBe('no');
    expect(lineActions(line('split-parent', 'split'), ctx).transfer).toBe('no');
    expect(lineActions(line('split-child', 'posted'), ctx).transfer).toBe('error');
  });

  it('keeps Post to unposted lines only', () => {
    for (const type of ['room-rate', 'mpos', 'manual', 'add-on', 'split-child'] as const) {
      expect(lineActions(line(type, 'posted'), ctx).post).toBe(false);
    }
  });
});

describe('selectionActions', () => {
  const posted = line('manual', 'posted');
  it('offers nothing without a selection or on a closed folio', () => {
    expect(selectionActions([], true, ctx)).toEqual({
      split: 'no',
      transfer: 'no',
      settle: false,
    });
    expect(selectionActions([posted], false, ctx)).toEqual({
      split: 'no',
      transfer: 'no',
      settle: false,
    });
  });
  it('allows all three for a posted manual charge', () => {
    expect(selectionActions([posted], true, ctx)).toEqual({
      split: 'allowed',
      transfer: 'allowed',
      settle: true,
    });
  });
  it('allows transfer only when every line may be transferred', () => {
    expect(selectionActions([posted, line('room-rate', 'posted')], true, ctx).transfer).toBe('no');
  });
  it('turns split and transfer into errors when only split parts block them', () => {
    const part = line('split-child', 'posted');
    expect(selectionActions([part], true, ctx)).toEqual({
      split: 'error',
      transfer: 'error',
      settle: true,
    });
    expect(selectionActions([part, posted], true, ctx)).toMatchObject({
      split: 'error',
      transfer: 'error',
    });
    // A line that cannot do it at all wins over an error.
    expect(selectionActions([part, line('add-on', 'posted')], true, ctx).transfer).toBe('no');
  });
  it('settles an unposted room rate selected ahead of its date', () => {
    expect(
      selectionActions([line('room-rate', 'unposted', { date: '2026-10-20' })], true, ctx).settle,
    ).toBe(true);
  });
});
