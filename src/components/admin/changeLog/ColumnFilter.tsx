import FilterAlt from '@mui/icons-material/FilterAlt';
import FilterList from '@mui/icons-material/FilterList';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import type {
  ChangeEventType,
  ChangeLogSort,
  ChangeLogSortField,
  SortDirection,
} from '../../../api/changeLogTypes';
import { rangeProblem, type ChangeLogFilters } from '../../../app/changeLog';
import DateField from '../../shared/DateField';
import TimeField from '../../shared/TimeField';

export interface ColumnFilterProps {
  field: ChangeLogSortField;
  /** Column title, used in the accessible names. */
  label: string;
  sort: ChangeLogSort;
  onSort: (direction: SortDirection) => void;
  filters: ChangeLogFilters;
  onApply: (next: ChangeLogFilters) => void;
  eventTypes: readonly ChangeEventType[];
  /** Whether the event types have arrived; the Change Type filter has nothing to list before. */
  typesStatus: 'loading' | 'error' | 'ready';
  /** True while this column has a filter. */
  active: boolean;
}

const SORT_LABELS: Record<ChangeLogSortField, readonly [string, string]> = {
  date: ['Oldest first', 'Newest first'],
  time: ['Earliest first', 'Latest first'],
  changeType: ['A to Z', 'Z to A'],
  actionBy: ['A to Z', 'Z to A'],
};

// The sort and filter icon of a column header (Figma 16734:6811: green filter icon after the title).
// It opens a small popover: sort direction, this column's filter, Apply and Clear.
export default function ColumnFilter(props: ColumnFilterProps) {
  const { label, active } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return (
    <>
      <IconButton
        size="small"
        color="primary"
        aria-label={`Sort and filter ${label}${active ? ' (filter on)' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? id : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {active ? <FilterAlt fontSize="small" /> : <FilterList fontSize="small" />}
      </IconButton>
      <Popover
        id={id}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { 'aria-label': `Sort and filter ${label}`, role: 'dialog' } }}
      >
        <FilterForm {...props} onDone={() => setAnchor(null)} />
      </Popover>
    </>
  );
}

function FilterForm({
  field,
  label,
  sort,
  onSort,
  filters,
  onApply,
  eventTypes,
  typesStatus,
  onDone,
}: ColumnFilterProps & { onDone: () => void }) {
  const [draft, setDraft] = useState<ChangeLogFilters>(filters);
  const sortName = useId();
  const set = (patch: Partial<ChangeLogFilters>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const problem =
    field === 'date'
      ? rangeProblem(draft.dateFrom, draft.dateTo, 'date')
      : field === 'time'
        ? rangeProblem(draft.timeFrom, draft.timeTo, 'time')
        : null;

  const clear = () => {
    const cleared: ChangeLogFilters = { ...filters };
    if (field === 'date') {
      cleared.dateFrom = undefined;
      cleared.dateTo = undefined;
    }
    if (field === 'time') {
      cleared.timeFrom = undefined;
      cleared.timeTo = undefined;
    }
    if (field === 'changeType') cleared.changeTypes = undefined;
    if (field === 'actionBy') cleared.actionBy = undefined;
    onApply(cleared);
    onDone();
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    onApply({
      ...filters,
      dateFrom: field === 'date' ? draft.dateFrom || undefined : filters.dateFrom,
      dateTo: field === 'date' ? draft.dateTo || undefined : filters.dateTo,
      timeFrom: field === 'time' ? draft.timeFrom || undefined : filters.timeFrom,
      timeTo: field === 'time' ? draft.timeTo || undefined : filters.timeTo,
      changeTypes: field === 'changeType' ? draft.changeTypes : filters.changeTypes,
      actionBy: field === 'actionBy' ? draft.actionBy?.trim() || undefined : filters.actionBy,
    });
    onDone();
  };

  const [ascLabel, descLabel] = SORT_LABELS[field];
  const selectedTypes = new Set(draft.changeTypes ?? []);

  return (
    <Box
      component="form"
      onSubmit={apply}
      sx={(t) => ({
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: t.spacing(35),
        maxWidth: t.spacing(45),
      })}
    >
      <FormControl>
        <FormLabel id={`${sortName}-label`}>Sort {label}</FormLabel>
        <RadioGroup
          aria-labelledby={`${sortName}-label`}
          value={sort.field === field ? sort.direction : ''}
          onChange={(_, v) => onSort(v as SortDirection)}
        >
          <FormControlLabel value="asc" control={<Radio />} label={ascLabel} />
          <FormControlLabel value="desc" control={<Radio />} label={descLabel} />
        </RadioGroup>
      </FormControl>

      {field === 'date' ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <DateField
            label="From date"
            value={draft.dateFrom ?? ''}
            onChange={(v) => set({ dateFrom: v || undefined })}
            fullWidth
          />
          <DateField
            label="To date"
            value={draft.dateTo ?? ''}
            onChange={(v) => set({ dateTo: v || undefined })}
            fullWidth
          />
        </Box>
      ) : null}
      {field === 'time' ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TimeField
            label="From time"
            value={draft.timeFrom ?? ''}
            onChange={(v) => set({ timeFrom: v || undefined })}
            sx={{ flex: 1 }}
          />
          <TimeField
            label="To time"
            value={draft.timeTo ?? ''}
            onChange={(v) => set({ timeTo: v || undefined })}
            sx={{ flex: 1 }}
          />
        </Box>
      ) : null}
      {field === 'changeType' ? (
        <FormControl component="fieldset">
          <FormLabel component="legend">Show these change types</FormLabel>
          {typesStatus === 'loading' ? (
            <Typography role="status" variant="body2" color="text.secondary">
              Loading change types…
            </Typography>
          ) : null}
          {typesStatus === 'error' ? (
            <Typography role="alert" variant="body2" color="error">
              The change types could not be loaded.
            </Typography>
          ) : null}
          {typesStatus === 'ready' && eventTypes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              There are no change types to filter by.
            </Typography>
          ) : null}
          <FormGroup>
            {eventTypes.map((type) => (
              <FormControlLabel
                key={type.id}
                label={type.label}
                control={
                  <Checkbox
                    checked={selectedTypes.has(type.id)}
                    onChange={(e) => {
                      const next = new Set(selectedTypes);
                      if (e.target.checked) next.add(type.id);
                      else next.delete(type.id);
                      set({ changeTypes: next.size ? [...next] : undefined });
                    }}
                  />
                }
              />
            ))}
          </FormGroup>
        </FormControl>
      ) : null}
      {field === 'actionBy' ? (
        <TextField
          label="Employee name"
          value={draft.actionBy ?? ''}
          onChange={(e) => set({ actionBy: e.target.value })}
          fullWidth
        />
      ) : null}

      {problem ? (
        <Box role="alert" sx={{ color: 'error.main', typography: 'caption' }}>
          {problem}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button type="button" onClick={clear}>
          Clear filter
        </Button>
        <Button type="submit" variant="contained" disabled={Boolean(problem)}>
          Apply
        </Button>
      </Box>
    </Box>
  );
}
