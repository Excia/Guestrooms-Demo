import { ApiError } from '../api/types';
import type { ReservationGuest } from '../api/types';
import {
  canStep,
  confirmationsToSend,
  draftFromRoom,
  guestFromMember,
  guestSlots,
  guestsAccess,
  guestsFailure,
  guestsSuccessMessage,
  isGuestsDirty,
  MAX_PARTY,
  roomParty,
  setSlot,
  stepCount,
  toUpdateGuestsRequest,
} from './roomGuests';

const err = (status: number, code?: string) =>
  new ApiError(status, 'x', code ? { code } : undefined);

const guest = (kind: 'adult' | 'child', name: string, extra = {}): ReservationGuest => ({
  id: `g-${name}`,
  kind,
  slot: 0,
  name,
  memberNumber: null,
  ...extra,
});
const one = { adults: 2, children: 1, rooms: [{}] } as never;

describe('roomParty', () => {
  it('uses the room party, else the totals of a one-room reservation, else one adult', () => {
    expect(roomParty(one, { adults: 3, children: 0 })).toEqual({
      adults: 3,
      children: 0,
      guests: [],
    });
    expect(roomParty(one, {})).toEqual({ adults: 2, children: 1, guests: [] });
    expect(roomParty({ adults: 4, children: 2, rooms: [{}, {}] } as never, {})).toEqual({
      adults: 1,
      children: 0,
      guests: [],
    });
  });
});

describe('the draft and its slots', () => {
  const room = {
    adults: 3,
    children: 2,
    guests: [guest('adult', 'Ann'), guest('child', 'Cy')],
  };
  const draft = draftFromRoom(one, room);

  it('one slot per person besides the lead occupant, named ones filled in order', () => {
    expect(draft.adultSlots.map((g) => g?.name ?? null)).toEqual(['Ann', null]);
    expect(draft.childSlots.map((g) => g?.name ?? null)).toEqual(['Cy', null]);
  });

  it('labels the rows Guest 2... (the lead occupant is Guest 1), adults first', () => {
    expect(guestSlots(draft).map((s) => `${s.label}/${s.kind}`)).toEqual([
      'Guest 2/adult',
      'Guest 3/adult',
      'Guest 4/child',
      'Guest 5/child',
    ]);
  });

  it('a single adult has no adult slots', () => {
    expect(draftFromRoom(one, { adults: 1, children: 0, guests: [] }).adultSlots).toEqual([]);
  });

  it('steppers: at least one adult, no negative children, a party limit', () => {
    const d = draftFromRoom(one, { adults: 1, children: 0, guests: [] });
    expect(canStep(d, 'adult', -1)).toBe(false);
    expect(canStep(d, 'child', -1)).toBe(false);
    expect(stepCount(d, 'adult', -1)).toBe(d);
    const full = draftFromRoom(one, { adults: MAX_PARTY - 1, children: 1, guests: [] });
    expect(canStep(full, 'adult', 1)).toBe(false);
    expect(canStep(full, 'adult', -1)).toBe(true);
  });

  it('adding a person adds a TBD slot; removing one drops the last slot of that kind', () => {
    const more = stepCount(draft, 'adult', 1);
    expect(more.adults).toBe(4);
    expect(more.adultSlots).toHaveLength(3);
    expect(more.adultSlots[2]).toBeNull();
    const fewer = stepCount(draft, 'adult', -1);
    expect(fewer.adultSlots.map((g) => g?.name)).toEqual(['Ann']);
    const noChild = stepCount(stepCount(draft, 'child', -1), 'child', -1);
    expect(noChild.children).toBe(0);
    expect(noChild.childSlots).toEqual([]);
  });

  it('putting someone in a slot, and Update vs Cancel (dirty)', () => {
    expect(isGuestsDirty(draft, draft)).toBe(false);
    const named = setSlot(
      draft,
      'adult',
      1,
      guestFromMember({ id: 'm9', memberNumber: 'MEM-9', name: 'Bo', email: 'b@x.org', phone: '' }),
    );
    expect(named.adultSlots[1]).toMatchObject({ name: 'Bo', sendConfirmation: false });
    expect(isGuestsDirty(draft, named)).toBe(true);
    expect(isGuestsDirty(draft, setSlot(named, 'adult', 1, null))).toBe(false);
    expect(isGuestsDirty(draft, stepCount(draft, 'child', 1))).toBe(true);
    expect(setSlot(draft, 'adult', 9, null)).toBe(draft);
  });

  it('moving a guest to another slot is a change', () => {
    const moved = setSlot(setSlot(draft, 'adult', 0, null), 'adult', 1, draft.adultSlots[0]);
    expect(moved.adultSlots.map((g) => g?.name ?? null)).toEqual([null, 'Ann']);
    expect(isGuestsDirty(draft, moved)).toBe(true);
  });

  it('slot positions survive a save and a reload: Guest 3 named, Guest 2 still TBD', () => {
    const wide = { adults: 3, children: 2, guests: [] };
    const empty = draftFromRoom(one, wide);
    const named = setSlot(
      setSlot(
        empty,
        'adult',
        1,
        guestFromMember({ id: 'm1', memberNumber: 'M1', name: 'Bo', email: '', phone: '' }),
      ),
      'child',
      1,
      guestFromMember({ id: 'm2', memberNumber: 'M2', name: 'Di', email: '', phone: '' }),
    );
    const request = toUpdateGuestsRequest(
      named,
      { id: 'rs-1', version: 'r1' },
      'rr-1',
      'req-12345678',
    );
    expect(request.guests).toEqual([
      { kind: 'adult', slot: 1, name: 'Bo', memberId: 'm1' },
      { kind: 'child', slot: 1, name: 'Di', memberId: 'm2' },
    ]);
    // the backend answers with the same slots
    const reloaded = draftFromRoom(one, {
      ...wide,
      guests: request.guests.map((g, i) => ({ ...g, id: `g${i}`, memberNumber: null })),
    });
    expect(reloaded.adultSlots.map((g) => g?.name ?? null)).toEqual([null, 'Bo']);
    expect(reloaded.childSlots.map((g) => g?.name ?? null)).toEqual([null, 'Di']);
    expect(isGuestsDirty(reloaded, named)).toBe(false);
  });

  it('a guest without a usable slot takes the first free one', () => {
    const d = draftFromRoom(one, {
      adults: 3,
      children: 0,
      guests: [
        guest('adult', 'A', { slot: 1 }),
        guest('adult', 'B', { slot: 1 }),
        guest('adult', 'C', { slot: 9 }),
      ],
    });
    expect(d.adultSlots.map((g) => g?.name)).toEqual(['B', 'A']);
  });
});

describe('the request and the confirmation emails', () => {
  const reservation = { id: 'rs-1', version: 'r2' };
  const base = draftFromRoom(one, { adults: 3, children: 1, guests: [] });
  const named = setSlot(
    setSlot(base, 'adult', 0, {
      ...guestFromMember({
        id: 'm1',
        memberNumber: 'MEM-1',
        name: 'Ann',
        email: 'a@x.org',
        phone: '',
      }),
      sendConfirmation: true,
    }),
    'child',
    0,
    { name: 'Cy', memberNumber: null, sendConfirmation: true, confirmationSent: false },
  );

  it('sends the party and only the named guests; confirmation only with an address', () => {
    const request = toUpdateGuestsRequest(named, reservation, 'rr-1', 'req-12345678');
    expect(request).toEqual({
      requestId: 'req-12345678',
      reservationId: 'rs-1',
      reservationRoomId: 'rr-1',
      version: 'r2',
      adults: 3,
      children: 1,
      guests: [
        {
          kind: 'adult',
          slot: 0,
          name: 'Ann',
          memberId: 'm1',
          email: 'a@x.org',
          sendConfirmation: true,
        },
        { kind: 'child', slot: 0, name: 'Cy' },
      ],
    });
    expect(confirmationsToSend(named)).toBe(1);
    expect(confirmationsToSend(base)).toBe(0);
  });

  it('the confirmation toggle starts off', () => {
    expect(
      guestFromMember({ id: 'm', memberNumber: 'x', name: 'n', email: 'e@x.org', phone: '' })
        .sendConfirmation,
    ).toBe(false);
  });

  it('says how many confirmations went out', () => {
    expect(guestsSuccessMessage(0)).toBe('Guests updated.');
    expect(guestsSuccessMessage(1)).toMatch(/A confirmation was sent/);
    expect(guestsSuccessMessage(2)).toMatch(/2 confirmations were sent/);
  });
});

describe('guestsAccess', () => {
  it('is read-only once the room is checked in or out, or the reservation is cancelled', () => {
    expect(guestsAccess('confirmed', { status: 'nyci' }, true)).toEqual({
      editable: true,
      reason: null,
    });
    expect(guestsAccess('checked-in', { status: 'checked-in' }, true)).toMatchObject({
      editable: false,
      reason: expect.stringMatching(/checked in/),
    });
    expect(guestsAccess('checked-in', { status: 'checked-out' }, true).editable).toBe(false);
    expect(guestsAccess('cancelled', { status: 'nyci' }, true).editable).toBe(false);
  });
  it('is read-only without permission, with nothing to explain', () => {
    expect(guestsAccess('confirmed', { status: 'nyci' }, false)).toEqual({
      editable: false,
      reason: null,
    });
  });
  it('a multi-room reservation is judged per room', () => {
    expect(guestsAccess('checked-in', { status: 'nyci' }, true).editable).toBe(true);
  });
});

describe('guestsFailure', () => {
  it('maps the answers', () => {
    expect(guestsFailure(err(403)).refetch).toBe(false);
    expect(guestsFailure(err(409, 'stale')).refetch).toBe(true);
    expect(guestsFailure(err(409, 'not-editable')).message).toMatch(/checked in/);
    expect(guestsFailure(err(400)).refetch).toBe(false);
    expect(guestsFailure(err(503))).toMatchObject({ refetch: true, outcomeUnknown: true });
    expect(guestsFailure(new Error('offline')).outcomeUnknown).toBe(true);
  });
});
