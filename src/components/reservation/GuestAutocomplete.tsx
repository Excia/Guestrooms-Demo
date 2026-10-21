import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';
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

/** Width of the control beside the field: the Lead Occupant's X, or an equal spacer, so both fields line up. */
const SIDE_SLOT = 5;

/**
 * A directory person picker: TBD until someone is chosen, the first directory people as soon as the
 * field is focused, matches as you type. "+" sits inside the field (after the dropdown button) and
 * adds a new person; with `clearLabel` a red X beside the field clears the choice. Both fields reserve
 * the same space beside them, so their boxes have the same width. TBD is a real, valid state.
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
          // MUI overlaps the clear and dropdown buttons by 2px; keep them apart.
          '& .MuiAutocomplete-clearIndicator': { marginRight: (t: Theme) => t.spacing(0.5) },
          ...(clearLabel && { '& .MuiAutocomplete-clearIndicator': { display: 'none' } }),
          // The input's right padding reserves room for the clear, dropdown and "+" buttons, so the
          // text never runs under them. !important: MUI's own padding rules are more specific.
          '& .MuiOutlinedInput-root': { pr: (t: Theme) => `${t.spacing(15)} !important` },
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
          // With the outside X the built-in clear button is hidden (display: none) and out of the
          // accessibility tree, so it cannot be a second "Clear lead occupant".
          clearIndicator: clearLabel
            ? { 'aria-hidden': true, tabIndex: -1 }
            : {
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
            inputRef={inputEl}
            placeholder={GUEST_TBD}
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                // One flex row inside the field: MUI's own buttons (clear, dropdown), then "+". They are
                // siblings, not stacked absolutely, so they cannot overlap.
                endAdornment: (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: (t) => t.spacing(1),
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      // MUI positions its own adornment absolutely; here it is a flex item.
                      '&& .MuiAutocomplete-endAdornment': {
                        position: 'static !important',
                        transform: 'none !important',
                        right: 'auto !important',
                        top: 'auto !important',
                      },
                    }}
                  >
                    {params.slotProps.input.endAdornment}
                    <IconButton
                      size="small"
                      aria-label={addLabel}
                      title={addLabel}
                      color="primary"
                      // The field's own handlers would focus the input and open the list.
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd();
                      }}
                    >
                      <Add />
                    </IconButton>
                  </Box>
                ),
              },
              htmlInput: { ...params.slotProps.htmlInput, 'aria-label': label },
            }}
          />
        )}
      />
      {clearLabel ? (
        <IconButton
          aria-label={clearLabel}
          color="error"
          disabled={value === null}
          sx={{
            width: (t) => t.spacing(SIDE_SLOT),
            height: (t) => t.spacing(SIDE_SLOT),
            flex: 'none',
            // The theme's icon-button hover is the green tint: this one is red.
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.error.main, t.palette.action.hoverOpacity),
            },
          }}
          onClick={() => {
            onChange(null);
            setTyped('');
            // The X is disabled once cleared: focus moves to the field, not to nowhere.
            inputEl.current?.focus();
          }}
        >
          <Close />
        </IconButton>
      ) : (
        <Box
          aria-hidden
          sx={{
            width: (t) => t.spacing(SIDE_SLOT),
            height: (t) => t.spacing(SIDE_SLOT),
            flex: 'none',
          }}
        />
      )}
    </Box>
  );
}
