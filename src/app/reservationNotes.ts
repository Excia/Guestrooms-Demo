// Rules of the Notes accordion (ticket 151): when notes can be edited, whether they changed, the
// limit and what a failed save says. Pure, no React.
import type { ReservationDetail } from '../api/types';
import { ApiError } from '../api/types';
import { MAX_NOTES_LENGTH } from '../api/validation';

export { MAX_NOTES_LENGTH };

export interface NotesDraft {
  publicNotes: string;
  privateNotes: string;
}

export const notesOf = (
  d: Pick<ReservationDetail, 'publicNotes' | 'privateNotes'>,
): NotesDraft => ({
  publicNotes: d.publicNotes,
  privateNotes: d.privateNotes,
});

export const isNotesDirty = (saved: NotesDraft, draft: NotesDraft): boolean =>
  saved.publicNotes !== draft.publicNotes || saved.privateNotes !== draft.privateNotes;

export type NotesErrors = Partial<Record<keyof NotesDraft, string>>;

export function validateNotes(draft: NotesDraft): NotesErrors {
  const errors: NotesErrors = {};
  const tooLong = `Notes can have at most ${MAX_NOTES_LENGTH} characters.`;
  if (draft.publicNotes.length > MAX_NOTES_LENGTH) errors.publicNotes = tooLong;
  if (draft.privateNotes.length > MAX_NOTES_LENGTH) errors.privateNotes = tooLong;
  return errors;
}

/** Notes can be edited until the reservation is checked out or cancelled, with `reservation.edit`. */
export const canEditNotes = (status: ReservationDetail['status'], canEdit: boolean): boolean =>
  canEdit && status !== 'checked-out' && status !== 'cancelled';

export const NOTES_SAVED = 'Notes saved.';

export interface NotesFailure {
  message: string;
  refetch: boolean;
  outcomeUnknown?: boolean;
}

export function notesFailure(error: unknown): NotesFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  if (status === 403) return { message: 'You may not change this reservation.', refetch: false };
  if (code === 'stale') {
    return {
      message:
        'This reservation changed elsewhere. It was reloaded; review the notes and save again.',
      refetch: true,
    };
  }
  if (code === 'not-editable') {
    return {
      message: 'The notes can no longer be changed. The reservation was reloaded.',
      refetch: true,
    };
  }
  if (status === 404) return { message: 'The reservation could not be found.', refetch: true };
  if (status >= 400 && status < 500 && status !== 408) {
    return { message: 'The notes could not be saved. Check them and try again.', refetch: false };
  }
  return {
    message: 'Could not confirm whether the notes were saved. The reservation was reloaded.',
    refetch: true,
    outcomeUnknown: true,
  };
}
