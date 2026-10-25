import Search from '@mui/icons-material/Search';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import type { LookupRef } from '../../../api/types';

export const SEARCH_DEBOUNCE_MS = 250;

export interface SearchLookupFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: LookupRef | null;
  onChange: (value: LookupRef | null) => void;
  /** Answers the records matching the typed text; an empty text lists the first few. */
  search: (query: string, signal: AbortSignal) => Promise<LookupRef[]>;
  /** Validation message; shown under the input and tied to it. */
  error?: string;
  disabled?: boolean;
}

type Status = 'idle' | 'loading' | 'error';

// Lookup that asks the backend while the user types (House Account). Same look as LookupField:
// a search icon in the theme's primary color; the clear (X) button comes with Autocomplete.
export default function SearchLookupField({
  id,
  label,
  placeholder,
  value,
  onChange,
  search,
  error,
  disabled,
}: SearchLookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value?.label ?? '');
  const [options, setOptions] = useState<LookupRef[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  // Text equal to the chosen record is not a search: list everything instead of just that one.
  const query = value && input === value.label ? '' : input.trim();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setStatus('loading');
        search(query, controller.signal)
          .then((found) => {
            if (controller.signal.aborted) return;
            setOptions(found);
            setStatus('idle');
          })
          .catch(() => {
            if (!controller.signal.aborted) setStatus('error');
          });
      },
      query === '' ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, search]);

  return (
    <Autocomplete<LookupRef>
      id={id}
      disabled={disabled}
      value={value}
      options={options}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      onChange={(_, next) => onChange(next)}
      // The backend already filtered; showing its answer as is.
      filterOptions={(all) => all}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={status === 'loading'}
      loadingText="Searching..."
      noOptionsText={status === 'error' ? 'Search failed. Try again.' : 'No house accounts found'}
      popupIcon={<Search />}
      forcePopupIcon
      slotProps={{
        popupIndicator: {
          sx: { transform: 'none', color: 'primary.main' },
          'aria-label': `Search ${label}`,
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={Boolean(error)}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
          }}
        />
      )}
    />
  );
}
