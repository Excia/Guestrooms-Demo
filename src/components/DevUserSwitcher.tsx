import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import { useId } from 'react';
import { MOCK_USERS, MOCK_USER_STORAGE_KEY, resolveMockUser } from '../api/mockUsers';

function readStoredUser(): string | null {
  try {
    return window.localStorage.getItem(MOCK_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Dev-only control (main.tsx renders it behind import.meta.env.DEV, lazy-loaded) that picks the
 * mock user so the admin, non-admin and partial-access variants can be demoed. The grant is read
 * when the app starts, so a change stores the choice and reloads.
 */
export default function DevUserSwitcher() {
  const id = useId();
  return (
    <FormControl
      size="small"
      variant="standard"
      sx={{
        position: 'fixed',
        left: (theme) => theme.spacing(2),
        bottom: (theme) => theme.spacing(2),
        // Above page content, below the menu overlay (zIndex 'drawer') so it never covers it.
        zIndex: 'speedDial',
        bgcolor: 'background.paper',
        px: 1,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        // Visible focus ring (the native select's own is hard to see on the paper background).
        '&:has(select:focus-visible)': {
          outline: (theme) => `${theme.spacing(0.25)} solid ${theme.palette.primary.main}`,
          outlineOffset: (theme) => theme.spacing(0.25),
        },
      }}
    >
      <InputLabel htmlFor={id} shrink sx={{ px: 1 }}>
        Mock user (dev)
      </InputLabel>
      <NativeSelect
        value={resolveMockUser(readStoredUser()).id}
        inputProps={{ id }}
        onChange={(event) => {
          try {
            window.localStorage.setItem(MOCK_USER_STORAGE_KEY, event.target.value);
          } catch {
            // storage unavailable; the reload falls back to the administrator
          }
          window.location.reload();
        }}
      >
        {MOCK_USERS.map((user) => (
          <option key={user.id} value={user.id}>
            {user.label}
          </option>
        ))}
      </NativeSelect>
    </FormControl>
  );
}
