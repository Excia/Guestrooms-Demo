import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import type { Member } from '../../api';
import { GUEST_TBD } from '../../api';
import { useMemberSearch } from './useMemberSearch';

export interface GuestAutocompleteProps {
  /** Accessible name of the field, e.g. "Booking guest". */
  label: string;
  value: Member | null;
  onChange: (member: Member | null) => void;
  /** The "+" button: add a new person to the directory (opens the Add guest dialog). */
  onAdd: () => void;
  addLabel: string;
  /** An X beside the field that puts the field back to TBD (the lead occupant). */
  clearLabel?: string;
}

/**
 * A directory person picker: TBD until someone is chosen, the first directory people as soon as the
 * field is focused, matches as you type. "+" beside it adds a new person; with `clearLabel` an X
 * beside it clears the choice. TBD is a real, valid state, not an error.
 */
export default function GuestAutocomplete({
  label,
  value,
  onChange,
  onAdd,
  addLabel,
  clearLabel,
}: GuestAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  // Typing searches; showing the chosen name must not (it would filter the list to that one person).
  const [typed, setTyped] = useState('');
  const search = useMemberSearch(typed, open);
  const inputEl = useRef<HTMLInputElement>(null);
  const members = search.status === 'success' ? search.members : [];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Autocomplete<Member>
        // With the outside X the field's own clear button would be a second way to do the same.
        sx={{
          flex: 1,
          minWidth: 0,
          ...(clearLabel && { '& .MuiAutocomplete-clearIndicator': { display: 'none' } }),
        }}
        options={members}
        value={value}
        inputValue={input}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        openOnFocus
        // The built-in buttons would only be named "Open" and "Clear".
        slotProps={{
          popupIndicator: {
            'aria-label': `Show ${label.toLowerCase()}s`,
            title: `Show ${label.toLowerCase()}s`,
          },
          clearIndicator: {
            'aria-label': `Clear ${label.toLowerCase()}`,
            title: `Clear ${label.toLowerCase()}`,
          },
        }}
        autoHighlight
        onChange={(_, member) => onChange(member)}
        onInputChange={(_, text, reason) => {
          setInput(text);
          if (reason === 'input') setTyped(text);
          else setTyped('');
        }}
        filterOptions={(all) => all}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionLabel={(m) => m.name}
        getOptionKey={(m) => m.id}
        loading={open && search.status === 'loading'}
        loadingText="Searching…"
        noOptionsText={
          search.status === 'error' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>Guests could not be loaded.</span>
              <Button size="small" onMouseDown={(e) => e.preventDefault()} onClick={search.retry}>
                Retry
              </Button>
            </Box>
          ) : (
            'No matching guests.'
          )
        }
        renderOption={({ key, ...props }, m) => (
          <li key={key} {...props}>
            <Box>
              <Typography variant="body2">
                {m.name} ({m.memberNumber})
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {m.email}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            inputRef={inputEl}
            placeholder={GUEST_TBD}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, 'aria-label': label },
            }}
          />
        )}
      />
      <IconButton aria-label={addLabel} color="primary" onClick={onAdd}>
        <Add />
      </IconButton>
      {clearLabel ? (
        <IconButton
          aria-label={clearLabel}
          color="primary"
          disabled={value === null}
          onClick={() => {
            onChange(null);
            setTyped('');
            // The X is disabled once cleared: focus moves to the field, not to nowhere.
            inputEl.current?.focus();
          }}
        >
          <Close />
        </IconButton>
      ) : null}
    </Box>
  );
}
