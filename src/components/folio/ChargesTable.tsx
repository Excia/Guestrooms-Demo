import CallSplit from '@mui/icons-material/CallSplit';
import FilterAlt from '@mui/icons-material/FilterAlt';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useId, useMemo, useState } from 'react';
import type { Folio, FolioCharge, IsoDate } from '../../api';
import {
  ALL_OCCUPANTS,
  chargeCountText,
  filterCharges,
  isFilterApplied,
  occupantFilterOptions,
  selectionTotalCents,
  type OccupantFilter,
} from '../../app/folio';
import { lineActions, selectionActions } from '../../app/folioLine';
import { formatMoney } from '../../app/quickStats';
import FolioLine from './FolioLine';
import { tableBorder } from './tableStyles';

// Placeholder copy until the dialogs of tickets 4.5 (transfer) and 4.13 (split) exist (Q-42-1).
const SPLIT_ERROR = 'A part of a split cannot be split again. Undo the split first.';
const TRANSFER_ERROR = 'A part of a split cannot be transferred. Undo the split first.';

export interface ChargesTableProps {
  folio: Folio;
  labelledBy: string;
  /** Opens the "Post via Night Audit" dialog for one charge. */
  onPost: (charge: FolioCharge) => void;
  /** The folio's date today: an unposted room rate on or before it can be posted, a later one cannot. */
  today: IsoDate;
  /** Actions whose dialogs belong to later tickets report here. */
  onStub: (message: string) => void;
}

/** Occupant Filter (Figma 16252:5253 and 16252:5285): grey on All, green once a filter is applied. */
function OccupantFilterSelect({
  folio,
  value,
  onChange,
}: {
  folio: Folio;
  value: OccupantFilter;
  onChange: (value: OccupantFilter) => void;
}) {
  const id = useId();
  const options = useMemo(
    () => occupantFilterOptions(folio.rooms, folio.occupants),
    [folio.rooms, folio.occupants],
  );
  const applied = isFilterApplied(value, options);
  return (
    <FormControl size="small" sx={{ width: (t) => t.spacing(27.5) }}>
      <InputLabel
        id={`${id}-label`}
        shrink
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: applied ? 'primary.main' : undefined,
          '&.Mui-focused': { color: 'primary.main' },
        }}
      >
        {applied ? <FilterAlt fontSize="inherit" aria-hidden /> : null}
        Occupant Filter
      </InputLabel>
      <MuiSelect
        labelId={`${id}-label`}
        id={id}
        label={applied ? '    Occupant Filter' : 'Occupant Filter'}
        notched
        value={options.some((o) => o.value === value) ? value : ALL_OCCUPANTS}
        onChange={(e) => onChange(e.target.value)}
        sx={
          applied ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' } } : {}
        }
        renderValue={(v) => options.find((o) => o.value === v)?.label ?? 'All'}
      >
        {options.map((o) => [
          o.groupStart ? <Divider key={`${o.value}-divider`} component="li" /> : null,
          <MenuItem key={o.value} value={o.value} sx={o.indent ? { pl: 4 } : undefined}>
            {o.label}
          </MenuItem>,
        ])}
      </MuiSelect>
    </FormControl>
  );
}

// Charges table with the occupant filter, row selection and the action bar (Figma 12047:7965).
export default function ChargesTable({
  folio,
  labelledBy,
  today,
  onPost,
  onStub,
}: ChargesTableProps) {
  const [filter, setFilter] = useState<OccupantFilter>(ALL_OCCUPANTS);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const options = useMemo(
    () => occupantFilterOptions(folio.rooms, folio.occupants),
    [folio.rooms, folio.occupants],
  );
  const applied = isFilterApplied(filter, options);
  const visible = useMemo(
    () => filterCharges(folio.charges, applied ? filter : ALL_OCCUPANTS),
    [folio.charges, filter, applied],
  );
  const context = { today };
  const selectable = visible.filter((c) => lineActions(c, context).select);
  // A line hidden by the filter is not selected: the bar must only act on what the user can see.
  const selected = selectable.filter((c) => selectedIds.has(c.id));
  const total = selectionTotalCents(selected);
  const actions = selectionActions(selected, folio.open, context);
  const filterLabel = options.find((o) => o.value === filter)?.label ?? 'All';

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allSelected = selectable.length > 0 && selected.length === selectable.length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <OccupantFilterSelect folio={folio} value={filter} onChange={setFilter} />
      </Box>
      <TableContainer sx={tableBorder}>
        <Table size="small" aria-labelledby={labelledBy}>
          <TableHead>
            <TableRow>
              <TableCell component="th" scope="col" sx={{ width: '24%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={selected.length > 0 && !allSelected}
                    disabled={selectable.length === 0}
                    onChange={() =>
                      setSelectedIds(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))
                    }
                    slotProps={{ input: { 'aria-label': 'Select all charges' } }}
                  />
                  <Box component="span" sx={{ fontWeight: 'fontWeightBold' }}>
                    Type
                  </Box>
                </Box>
              </TableCell>
              {['Date', 'Description', 'Charge', 'Status'].map((c) => (
                <TableCell key={c} component="th" scope="col" sx={{ fontWeight: 'fontWeightBold' }}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No charges to show.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((c) => (
                <FolioLine
                  key={c.id}
                  charge={c}
                  actions={lineActions(c, context)}
                  open={folio.open}
                  selected={selectedIds.has(c.id)}
                  onToggle={toggle}
                  onPost={onPost}
                  onStub={onStub}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {applied ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            px: 1,
            py: 0.75,
            bgcolor: (t) => t.palette.folio.actionBar,
          }}
        >
          <Typography variant="body2" role="status">
            {chargeCountText(visible.length, folio.charges.length, filterLabel)}
          </Typography>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={() => setFilter(ALL_OCCUPANTS)}
          >
            View all
          </Link>
        </Box>
      ) : null}
      {/* Action bar (Figma 14648:5641): appears with the first selected line. */}
      {selected.length > 0 ? (
        <Box
          role="region"
          aria-label="Selection actions"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            py: 1,
            bgcolor: (t) => t.palette.folio.actionBar,
          }}
        >
          <Box sx={{ display: 'flex', gap: 5 }}>
            <Button
              startIcon={<CallSplit />}
              disabled={actions.split === 'no'}
              onClick={() =>
                onStub(
                  actions.split === 'error'
                    ? SPLIT_ERROR
                    : 'Split arrives with the split item ticket.',
                )
              }
            >
              Split
            </Button>
            <Button
              color="inherit"
              startIcon={<SwapHoriz />}
              disabled={actions.transfer === 'no'}
              onClick={() =>
                onStub(
                  actions.transfer === 'error'
                    ? TRANSFER_ERROR
                    : 'Transfer arrives with the item transfer ticket.',
                )
              }
            >
              Transfer
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{ color: 'text.secondary', fontWeight: 'fontWeightBold' }}
            >
              Selection Total {formatMoney(total)}
            </Typography>
            <Button
              variant="contained"
              size="large"
              disabled={!actions.settle}
              onClick={() => onStub('Settle arrives with the quick split and settle ticket.')}
            >
              Settle {formatMoney(total)}
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
