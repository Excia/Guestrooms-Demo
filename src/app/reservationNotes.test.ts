import { ApiError } from '../api/types';
import {
  canEditNotes,
  isNotesDirty,
  MAX_NOTES_LENGTH,
  notesFailure,
  notesOf,
  validateNotes,
} from './reservationNotes';

const err = (status: number, code?: string) =>
  new ApiError(status, 'x', code ? { code } : undefined);

describe('notes', () => {
  it('reads both notes and tells when they changed', () => {
    const saved = notesOf({ publicNotes: 'a', privateNotes: 'b' } as never);
    expect(isNotesDirty(saved, { ...saved })).toBe(false);
    expect(isNotesDirty(saved, { ...saved, privateNotes: 'c' })).toBe(true);
  });
  it('limits the length of each note', () => {
    expect(validateNotes({ publicNotes: 'x'.repeat(MAX_NOTES_LENGTH), privateNotes: '' })).toEqual(
      {},
    );
    const errors = validateNotes({
      publicNotes: '',
      privateNotes: 'x'.repeat(MAX_NOTES_LENGTH + 1),
    });
    expect(errors.privateNotes).toMatch(/at most/);
    expect(errors.publicNotes).toBeUndefined();
  });
  it('can be edited until checked out or cancelled, with permission', () => {
    expect(canEditNotes('confirmed', true)).toBe(true);
    expect(canEditNotes('checked-in', true)).toBe(true);
    expect(canEditNotes('checked-out', true)).toBe(false);
    expect(canEditNotes('cancelled', true)).toBe(false);
    expect(canEditNotes('confirmed', false)).toBe(false);
  });
  it('maps failures', () => {
    expect(notesFailure(err(403)).refetch).toBe(false);
    expect(notesFailure(err(409, 'stale')).refetch).toBe(true);
    expect(notesFailure(err(400)).refetch).toBe(false);
    expect(notesFailure(err(500))).toMatchObject({ refetch: true, outcomeUnknown: true });
  });
});
