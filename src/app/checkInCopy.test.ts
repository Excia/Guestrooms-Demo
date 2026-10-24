import { decideCheckIn } from './checkInDecision';
import {
  checkInFailureText,
  checkInSuccessMessage,
  formatPromptDate,
  integrationErrorMessage,
  pastDatePrompt,
  splitConfirmation,
} from './checkInCopy';

const plan = (split: boolean) => {
  const d = decideCheckIn({
    rooms: [
      { id: 'a', status: 'nyci', assigned: true, dirty: false, arrival: '2026-10-20', departure: '2026-10-27' },
      ...(split
        ? [{ id: 'b', status: 'checked-in' as const, assigned: true, dirty: false, arrival: '2026-10-20', departure: '2026-10-27' }]
        : []),
    ],
    targetIds: ['a'],
    checkOutTime: '12:00',
    clock: { date: '2026-10-24', time: '14:00' },
    level: 'any-time',
    paymentOnFile: true,
  });
  if (d.kind !== 'needsPastDateConfirmation') throw new Error('expected a past date answer');
  return d;
};

describe('pastDatePrompt', () => {
  it('names the original arrival date in the title', () => {
    expect(pastDatePrompt(plan(false), 'any-time').title).toBe(
      'The check-in date of 10/20/2026 has passed',
    );
  });

  it('any time: adjust the dates or check in for the original date', () => {
    const p = pastDatePrompt(plan(false), 'any-time');
    expect(p).toMatchObject({
      firstKind: 'adjust',
      firstLabel: 'Adjust reservation dates',
      continueKind: 'continue',
      continueLabel: 'Check in for original date',
    });
    expect(p.message).toMatch(/adjust the reservation dates\?/);
  });

  it('arrival date only: the second choice is an override', () => {
    const p = pastDatePrompt(plan(false), 'arrival-date-only');
    expect(p).toMatchObject({ continueKind: 'override', continueLabel: 'Override and check in' });
    expect(p.message).toMatch(/enter an override code/);
  });

  it('partial case: adjust becomes split', () => {
    const p = pastDatePrompt(plan(true), 'any-time');
    expect(p).toMatchObject({
      firstKind: 'split',
      firstLabel: 'Split this room from the reservation',
    });
    expect(p.message).toMatch(/already checked in or out/);
    expect(pastDatePrompt(plan(true), 'arrival-date-only').message).toMatch(/Split this room.*override code/);
  });
});

describe('splitConfirmation', () => {
  it('names the room and the reservation', () => {
    const c = splitConfirmation({ roomNumber: '106', confirmationNumber: 'GR-50396' });
    expect(c.message).toContain('Room 106');
    expect(c.message).toContain('#GR-50396');
    expect(c.confirmLabel).toBe('Yes, split Room 106');
    expect(c.keepLabel).toBe('No, keep rooms together');
  });
  it('handles an unassigned room', () => {
    expect(splitConfirmation({ roomNumber: null, confirmationNumber: 'X' }).confirmLabel).toBe(
      'Yes, split the unassigned room',
    );
  });
});

describe('checkInSuccessMessage', () => {
  it('names the room of a one-room reservation', () => {
    expect(
      checkInSuccessMessage({ reservationRooms: 1, alreadyCheckedIn: 0, checkedIn: 1, roomNumbers: ['203'] }),
    ).toBe('You have successfully checked in Room 203.');
  });
  it('says "all rooms" when the rest of the reservation is in', () => {
    expect(
      checkInSuccessMessage({ reservationRooms: 3, alreadyCheckedIn: 1, checkedIn: 2, roomNumbers: [] }),
    ).toBe('You have successfully checked in all rooms.');
  });
  it('counts rooms otherwise', () => {
    expect(
      checkInSuccessMessage({ reservationRooms: 3, alreadyCheckedIn: 0, checkedIn: 1, roomNumbers: [] }),
    ).toBe('You have successfully checked in 1 room.');
    expect(
      checkInSuccessMessage({ reservationRooms: 4, alreadyCheckedIn: 0, checkedIn: 2, roomNumbers: [] }),
    ).toBe('You have successfully checked in 2 rooms.');
  });
});

describe('failure and integration text', () => {
  it('has a reason for every failure code', () => {
    expect(checkInFailureText('unassigned')).toBe('No room assigned.');
    expect(checkInFailureText('no-payment-method')).toBe('No payment method on file.');
    expect(checkInFailureText('room-not-ready')).toMatch(/dirty or not ready/);
    expect(checkInFailureText('occupied')).toMatch(/still checked in to the assigned room/);
    expect(checkInFailureText(undefined)).toMatch(/Try again/);
  });
  it('names each failing integration once', () => {
    expect(
      integrationErrorMessage([
        { kind: 'key-card', message: 'x' },
        { kind: 'key-card', message: 'y' },
        { kind: 'tms', message: 'z' },
      ]),
    ).toBe('Checked in, but the Key card and TMS integration reported an error. Verify the integration status.');
  });
  it('formats the prompt date', () => {
    expect(formatPromptDate('2026-10-20')).toBe('10/20/2026');
  });
});
