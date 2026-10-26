import type { Theme } from '@mui/material/styles';
import { createContext, useContext } from 'react';

// View-only mode of an Admin Setup page (Permissions, ticket 186). One flag, set once per page by
// `ReadOnlyProvider`; the shell, the save button, the setup lists and the field components read it.
// Defaults to editable: a component rendered outside an admin route (a test, the dev gallery) is
// editable. The route guard is what decides, and the backend enforces it on every request.
export interface ReadOnlyState {
  readOnly: boolean;
  /** The theme before the read-only defaults were applied; `EditableIsland` restores it. */
  baseTheme: Theme | null;
}

export const ReadOnlyContext = createContext<ReadOnlyState>({ readOnly: false, baseTheme: null });

/** True while the page is shown View-only: fields disabled, no Save / Add / Delete / Copy / Reorder. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext).readOnly;
}

/**
 * `disabled` for a field that sets it itself: always true in View-only mode, else the field's own
 * value. A MUI default prop cannot do this, because an explicit `disabled={false}` wins over it.
 */
export function useDisabled(disabled?: boolean): boolean | undefined {
  return useReadOnly() ? true : disabled;
}
