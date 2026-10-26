import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useContext, useMemo, type ReactNode } from 'react';
import { ReadOnlyContext } from '../../app/readOnlyContext';
import { readOnlyTheme } from '../../app/readOnlyTheme';

/**
 * Puts a page into View-only mode: sets the flag and disables the MUI field controls below it by
 * default. It reaches portals too (dialogs, menus), because both are React context.
 * `readOnly={false}` adds nothing, so editable pages render exactly as before.
 */
export default function ReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  const base = useTheme();
  const state = useMemo(() => ({ readOnly: true, baseTheme: base }), [base]);
  const theme = useMemo(() => readOnlyTheme(base), [base]);
  if (!readOnly) return <>{children}</>;
  return (
    <ReadOnlyContext value={state}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ReadOnlyContext>
  );
}

/**
 * Inside a View-only page, a part that is only for looking things up (the Change Log filters) stays
 * usable: it gets the original theme and the editable flag back.
 */
export function EditableIsland({ children }: { children: ReactNode }) {
  const { readOnly, baseTheme } = useContext(ReadOnlyContext);
  const free = useMemo(() => ({ readOnly: false, baseTheme: null }), []);
  if (!readOnly || !baseTheme) return <>{children}</>;
  return (
    <ReadOnlyContext value={free}>
      <ThemeProvider theme={baseTheme}>{children}</ThemeProvider>
    </ReadOnlyContext>
  );
}
