import { mockReservations } from './mockData';
import type {
  LookupRef,
  RateAmounts,
  RateCategoryOptions,
  RateCategorySetup,
  RateSeason,
  RateSku,
} from './types';
import { blankAmounts } from '../app/rateCategories';

// PLACEHOLDER sample data until the backend exists (see entries/184-rate-categories.md). The four
// names come from the designs (Comp Rate, Member Rate, Non-Member Rate, Owner Rate); the SKUs, the
// amounts and the seasons are invented.
export const RATE_CATEGORY_IDS = {
  comp: 'rc-comp',
  member: 'rc-member',
  nonMember: 'rc-non-member',
  owner: 'rc-owner',
} as const;

export const MOCK_RATE_SKUS: RateSku[] = [
  { id: 'sku-room-comp', label: 'Room night, complimentary', kind: 'item' },
  { id: 'sku-room-member', label: 'Room night, member', kind: 'item' },
  { id: 'sku-room-guest', label: 'Room night, non-member', kind: 'item' },
  { id: 'sku-room-owner', label: 'Room night, owner', kind: 'item' },
  { id: 'sku-package', label: 'Stay and play package', kind: 'combo' },
];

export function mockRateCategoryOptions(roomTypes: readonly LookupRef[]): RateCategoryOptions {
  return {
    skus: structuredClone(MOCK_RATE_SKUS),
    roomTypes: roomTypes.map((t) => ({ id: t.id, label: t.label })),
  };
}

/** The reference stored on a category (no kind). */
const plain = ({ id, label }: RateSku): LookupRef => ({ id, label });

const ROOM_TYPE_IDS = ['rt-double-queen', 'rt-king', 'rt-cottage'] as const;

/** Whole dollars to a full row; weekends cost a little more, extra guests a flat charge. */
function row(base: number, extras: Partial<RateAmounts> = {}): RateAmounts {
  const cents = (dollars: number) => dollars * 100;
  return {
    ...blankAmounts(),
    standardBase: cents(base),
    altBase1: cents(Math.round(base * 0.9)),
    altBase2: cents(Math.round(base * 0.8)),
    friday: cents(base + 20),
    saturday: cents(base + 30),
    guest3: base === 0 ? 0 : cents(15),
    guest4Plus: base === 0 ? 0 : cents(25),
    child: base === 0 ? 0 : cents(10),
    ...extras,
  };
}

function season(
  id: string,
  name: string,
  dates: [string, string] | null,
  bases: readonly [number, number, number],
): RateSeason {
  return {
    id,
    name,
    isDefault: dates === null,
    startDate: dates?.[0] ?? '',
    endDate: dates?.[1] ?? '',
    rates: Object.fromEntries(ROOM_TYPE_IDS.map((t, i) => [t, row(bases[i])])),
  };
}

/** How many sample reservations use each category (what blocks deleting it). */
export function reservationCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of mockReservations) counts[r.rateCategoryId] = (counts[r.rateCategoryId] ?? 0) + 1;
  return counts;
}

export function mockRateCategories(): RateCategorySetup[] {
  const counts = reservationCounts();
  const common = {
    startDate: '2024-01-01',
    endDate: null,
    kind: 'item' as const,
    roomTypeIds: [...ROOM_TYPE_IDS],
    settingNames: [] as string[],
  };
  return [
    {
      ...common,
      id: RATE_CATEGORY_IDS.comp,
      name: 'Comp Rate',
      sku: plain(MOCK_RATE_SKUS[0]),
      seasons: [season('rc-comp-default', '', null, [0, 0, 0])],
      reservationCount: counts[RATE_CATEGORY_IDS.comp] ?? 0,
    },
    {
      ...common,
      id: RATE_CATEGORY_IDS.member,
      name: 'Member Rate',
      sku: plain(MOCK_RATE_SKUS[1]),
      seasons: [
        season('rc-member-default', '', null, [150, 180, 220]),
        season('rc-member-summer', 'Summer', ['2026-06-01', '2026-08-31'], [175, 205, 250]),
        season('rc-member-holiday', 'Holidays', ['2026-12-20', '2027-01-02'], [195, 225, 275]),
      ],
      reservationCount: counts[RATE_CATEGORY_IDS.member] ?? 0,
      // Invented: the Default Rate Categories tab (a later ticket) will own this link.
      settingNames: ['Members default rate category'],
    },
    {
      ...common,
      id: RATE_CATEGORY_IDS.nonMember,
      name: 'Non-Member Rate',
      sku: plain(MOCK_RATE_SKUS[2]),
      seasons: [
        season('rc-guest-default', '', null, [200, 240, 290]),
        season('rc-guest-summer', 'Summer', ['2026-06-01', '2026-08-31'], [230, 270, 330]),
      ],
      reservationCount: counts[RATE_CATEGORY_IDS.nonMember] ?? 0,
    },
    {
      ...common,
      id: RATE_CATEGORY_IDS.owner,
      name: 'Owner Rate',
      sku: plain(MOCK_RATE_SKUS[3]),
      roomTypeIds: ['rt-double-queen', 'rt-king'],
      seasons: [
        {
          ...season('rc-owner-default', '', null, [90, 110, 0]),
          rates: {
            'rt-double-queen': row(90),
            'rt-king': row(110),
          },
        },
      ],
      reservationCount: counts[RATE_CATEGORY_IDS.owner] ?? 0,
    },
  ];
}
