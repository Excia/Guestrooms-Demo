import { useDisabled } from '../../../app/readOnlyContext';
import Search from '@mui/icons-material/Search';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useState } from 'react';
import type { LookupRef } from '../../../api/types';

/** Wait this long after the last keystroke before asking the backend (async lookups). */
export const SEARCH_DEBOUNCE_MS = 250;

interface BaseProps {
  label: string;
  value: LookupRef | null;
  onChange: (value: LookupRef | null) => void;
  id: string;
  placeholder?: string;
  /** Validation message; shown under the input and tied to it. */
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Id of an element that describes the input (read after the label). */
  describedBy?: string;
  /** Shown when nothing matches. */
  noOptionsText?: string;
  /** Field height: "small" (40px) for dense rows; the default is the form size. */
  size?: 'small' | 'medium';
}

export type LookupFieldProps = BaseProps &
  (
    | {
        /** A fixed list, filtered in the browser. */
        options: readonly LookupRef[];
        search?: undefined;
      }
    | {
        /**
         * Async mode: asks for the records matching the typed text (an empty text lists the first
         * few). Pass a stable function; a new one starts a new search.
         */
        search: (query: string, signal: AbortSignal) => Promise<LookupRef[]>;
        options?: undefined;
      }
  );

// 'idle' until the first answer; 'ready' once the options belong to the current text.
type Status = 'idle' | 'loading' | 'ready' | 'error';

// Lookup with the green search icon (Figma "Item | SKU", "Area", "Guest Member", "House Account").
// With `options` it filters a fixed list; with `search` it is a type-ahead that asks the backend.
export default function LookupField({
  label,
  value,
  onChange,
  id,
  placeholder,
  error,
  disabled,
  required,
  describedBy,
  noOptionsText = 'No results',
  size,
  options,
  search,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value?.label ?? '');
  const [found, setFound] = useState<LookupRef[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  // Text equal to the chosen record is not a search: list everything instead of just that one.
  const queryFor = (text: string) => (value && text === value.label ? '' : text.trim());
  const query = queryFor(input);

  useEffect(() => {
    if (!search || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        search(query, controller.signal)
          .then((records) => {
            if (controller.signal.aborted) return;
            setFound(records);
            setStatus('ready');
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setFound([]);
            setStatus('error');
          });
      },
      query === '' ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, open, query]);

  // Old answers are hidden the moment the text or the popup changes, not when the next one lands.
  const startSearching = () => {
    setFound([]);
    setStatus('loading');
  };

  const isSearching = Boolean(search) && open && (status === 'loading' || status === 'idle');
  // MUI's own status region already speaks "Searching..." and the no-options text; the count is ours.
  const announcement =
    search && open && status === 'ready' && found.length > 0
      ? `${found.length} results available`
      : '';

  return (
    <>
      <Autocomplete<LookupRef>
        id={id}
        disabled={useDisabled(disabled)}
        size={size}
        value={value}
        options={search ? found : (options as LookupRef[])}
        onChange={(_, next) => onChange(next)}
        {...(search
          ? {
              open,
              onOpen: () => {
                setOpen(true);
                startSearching();
              },
              onClose: () => setOpen(false),
              inputValue: input,
              onInputChange: (_: unknown, next: string) => {
                if (queryFor(next) !== query) startSearching();
                setInput(next);
              },
              // The backend already filtered; show its answer as is.
              filterOptions: (all: LookupRef[]) => all,
              loading: isSearching,
              loadingText: 'Searching...',
            }
          : {})}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={
          status === 'error' && search ? (
            <span role="alert">Search failed. Try again.</span>
          ) : (
            noOptionsText
          )
        }
        popupIcon={<Search />}
        forcePopupIcon
        slotProps={{
          popupIndicator: {
            sx: {
              transform: 'none',
              color: 'primary.main',
              '&.Mui-disabled': { color: 'action.disabled' },
            },
            'aria-label': `Search ${label}`,
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            required={required}
            error={Boolean(error)}
            helperText={error}
            // Keep the slots Autocomplete wires up (the input ref, ARIA attributes), only add `shrink`.
            slotProps={{
              ...params.slotProps,
              inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
              htmlInput: {
                ...params.slotProps?.htmlInput,
                ...(describedBy ? { 'aria-describedby': describedBy } : {}),
              },
            }}
          />
        )}
      />
      {search ? (
        <span role="status" style={visuallyHidden}>
          {announcement}
        </span>
      ) : null}
    </>
  );
}
