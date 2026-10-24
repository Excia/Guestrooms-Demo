import { describe, expect, it } from 'vitest';
import {
  blockContent,
  blockTooltipLines,
  extraGuests,
  initials,
  isCompactMonth,
  type BlockContentSource,
} from './scheduleBlockContent';

const base: BlockContentSource = {
  guestName: 'Daniel Whitfield',
  guestType: 'member',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-13',
  status: 'confirmed',
};

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Daniel Whitfield')).toBe('D.W.');
    expect(initials('  mary ann  van der berg ')).toBe('M.B.');
    expect(initials('Madonna')).toBe('M.');
    expect(initials('  ')).toBe('');
    expect(initials('')).toBe('');
  });
  it('skips leading punctuation and keeps astral characters whole', () => {
    expect(initials('(TBD) Guest')).toBe('T.G.');
    expect(initials('"O\'Neil" Jones')).toBe('O.J.');
    expect(initials('\u{1F600} Smith')).toBe('S.');
    expect(initials('\u{1D4D0}na Lee')).toBe('\u{1D4D0}.L.');
    expect(initials('--- ...')).toBe('');
  });
});

describe('extraGuests', () => {
  it('is the guests beyond the lead', () => {
    expect(extraGuests(undefined)).toBe(0);
    expect(extraGuests(1)).toBe(0);
    expect(extraGuests(4)).toBe(3);
  });
});

describe('isCompactMonth', () => {
  it('is only the 30 day view and stays under 2 nights', () => {
    expect(isCompactMonth(30, '2026-10-10', '2026-10-11')).toBe(true);
    expect(isCompactMonth(30, '2026-10-10', '2026-10-12')).toBe(false);
    expect(isCompactMonth(14, '2026-10-10', '2026-10-11')).toBe(false);
    expect(isCompactMonth(7, '2026-10-10', '2026-10-11')).toBe(false);
  });
});

describe('blockContent title', () => {
  it('is the lead occupant, with +N for the other guests', () => {
    expect(blockContent(base, 14).title).toBe('Daniel Whitfield');
    expect(blockContent({ ...base, occupantCount: 3 }, 14).title).toBe('Daniel Whitfield +2');
  });
  it('falls back to the reserver, then the block name, then the guest count', () => {
    const none = { ...base, guestName: '' };
    expect(blockContent({ ...none, reserverName: 'Ann Lee', occupantCount: 2 }, 14).title).toBe(
      'Ann Lee +1',
    );
    expect(blockContent({ ...none, blockName: 'Spring Retreat' }, 14).title).toBe('Spring Retreat');
    expect(blockContent({ ...none, occupantCount: 2 }, 14).title).toBe('2 guests');
    expect(blockContent({ ...none, occupantCount: 1 }, 14).title).toBe('1 guest');
    expect(blockContent(none, 14).title).toBe('');
  });
  it('is initials, with +N, in the month view for a stay under 2 nights, and hides the icon', () => {
    const short = { ...base, endDate: '2026-10-11', occupantCount: 2 };
    expect(blockContent(short, 30)).toMatchObject({
      title: 'D.W. +1',
      showIcon: false,
      compact: true,
    });
    expect(blockContent(short, 14)).toMatchObject({ title: 'Daniel Whitfield +1', showIcon: true });
    expect(blockContent(base, 30)).toMatchObject({ title: 'Daniel Whitfield', showIcon: true });
  });
  it('uses initials of the reserver when it stands in for the lead', () => {
    const c = blockContent(
      { ...base, guestName: '', reserverName: 'Ann Lee', endDate: '2026-10-11' },
      30,
    );
    expect(c.title).toBe('A.L.');
  });
});

describe('blockContent detail', () => {
  it('is the room type while there is no room (it wins over everything)', () => {
    const c = blockContent(
      {
        ...base,
        roomId: '',
        roomTypeName: 'King Deluxe',
        reserverName: 'Ann Lee',
        balanceCents: 500,
      },
      14,
    );
    expect(c.detail).toBe('King Deluxe');
  });
  it('is the balance while checked in or out and the folio is open, else the reserver', () => {
    const open = {
      ...base,
      status: 'checked-in' as const,
      balanceCents: 12345,
      reserverName: 'Ann Lee',
    };
    expect(blockContent(open, 14).detail).toBe('Balance due: $123.45');
    expect(blockContent({ ...open, balanceCents: 0 }, 14).detail).toBe('Ann Lee');
    expect(blockContent({ ...open, balanceCents: -500 }, 14).detail).toBe('Ann Lee');
    // The reserver carries no "+N" (that belongs to the lead) and is not repeated when it is the lead.
    expect(blockContent({ ...open, balanceCents: 0, occupantCount: 3 }, 14).detail).toBe('Ann Lee');
    expect(
      blockContent(
        { ...open, balanceCents: 0, occupantCount: 4, reserverName: 'Daniel Whitfield' },
        14,
      ).detail,
    ).toBe('');
    expect(blockContent({ ...open, balanceCents: 0, reserverName: undefined }, 14).detail).toBe('');
  });
  it('does not show the balance before check in', () => {
    expect(blockContent({ ...base, balanceCents: 900 }, 14).detail).toBe('');
  });
  it('is the reserver when someone else made the reservation', () => {
    expect(blockContent({ ...base, reserverName: 'Ann Lee' }, 14).detail).toBe('Ann Lee');
    expect(blockContent({ ...base, reserverName: 'daniel whitfield' }, 14).detail).toBe('');
  });
  it('is Maintenance when the room needs it and nothing else applies', () => {
    expect(blockContent({ ...base, housekeeping: 'needs-maintenance' }, 14).detail).toBe(
      'Maintenance',
    );
    expect(
      blockContent({ ...base, housekeeping: 'needs-maintenance', reserverName: 'Ann Lee' }, 14)
        .detail,
    ).toBe('Ann Lee');
  });
  it('is the block name last, unless the title already is', () => {
    expect(blockContent({ ...base, blockName: 'Spring Retreat' }, 14).detail).toBe(
      'Spring Retreat',
    );
    expect(blockContent({ ...base, guestName: '', blockName: 'Spring Retreat' }, 14).detail).toBe(
      '',
    );
  });
});

describe('blockTooltipLines', () => {
  it('lists the summary, guest type, reserver, every occupant with TBD, and the open balance', () => {
    const lines = blockTooltipLines(
      {
        ...base,
        guestType: 'owner',
        occupantCount: 4,
        occupants: ['Daniel Whitfield', 'Eve Whitfield'],
        reserverName: 'Ann Lee',
        balanceCents: 5000,
        blockName: 'Spring Retreat',
      },
      'Daniel Whitfield, GR-1, Room 201',
    );
    expect(lines).toEqual([
      'Daniel Whitfield, GR-1, Room 201',
      'Room owner',
      'Reserver: Ann Lee',
      'Occupants: Daniel Whitfield, Eve Whitfield, TBD, TBD',
      'Block: Spring Retreat',
      'Balance due: $50.00',
    ]);
  });
  it('skips what is not there', () => {
    expect(blockTooltipLines({ ...base, guestType: 'none' }, 'summary')).toEqual(['summary']);
  });
  it('names the room type of an unassigned reservation', () => {
    expect(
      blockTooltipLines({ ...base, roomId: '', roomTypeName: 'Suite', guestType: 'guest' }, 's'),
    ).toEqual(['s', 'Non-member guest', 'Room type: Suite']);
  });
});

describe('placeholder and blank names', () => {
  it('uses the first named occupant when the lead is blank or TBD', () => {
    const src = { ...base, guestName: 'TBD', occupants: [' ', 'Eve Whitfield'], occupantCount: 2 };
    expect(blockContent(src, 14).title).toBe('Eve Whitfield +1');
    expect(blockContent({ ...src, guestName: '' }, 14).title).toBe('Eve Whitfield +1');
  });
  it('lists named occupants without blanks, the rest as TBD', () => {
    const lines = blockTooltipLines(
      { ...base, occupants: ['Daniel Whitfield', '  ', ''], occupantCount: 3 },
      's',
    );
    expect(lines).toContain('Occupants: Daniel Whitfield, TBD, TBD');
  });
});
