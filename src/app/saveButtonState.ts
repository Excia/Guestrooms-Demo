export type SaveButtonState = 'save' | 'saving' | 'saved' | 'blocked';

// Which state the page-level Save button shows. Legacy: no unsaved changes reads "Saved" (white,
// cannot be pressed); changes read "Save <noun>" (filled); a save in flight cannot be repeated;
// changes that may not be saved (View-only access) show the filled label but cannot be pressed.
export function saveButtonState(opts: {
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
}): SaveButtonState {
  if (opts.saving) return 'saving';
  if (!opts.dirty) return 'saved';
  return opts.disabled ? 'blocked' : 'save';
}
