import CallSplit from '@mui/icons-material/CallSplit';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined';
import IndeterminateCheckBoxOutlined from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import type { FolioCharge } from '../../api';
import { chargeStatusLabel, chargeTypeLabel } from '../../app/folio';
import { formatDisplayDate } from '../../app/folioFormat';
import type { LineActions } from '../../app/folioLine';
import { formatMoney } from '../../app/quickStats';

export interface FolioLineProps {
  charge: FolioCharge;
  /** From `lineActions`: which controls this line has. */
  actions: LineActions;
  /** A closed folio keeps the icons but disables them. */
  open: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onPost: (charge: FolioCharge) => void;
  /** Controls whose dialogs belong to later tickets (4.5, 4.13, 4.10) report here. */
  onStub: (message: string) => void;
}

/**
 * One row of the charges table (Figma "All Folio Line Types / Variations" 16480:83130). Type label,
 * status text and available controls differ per type and state; state is never carried by color
 * alone: unposted, posted, settled (italic, with the references) and split each have their own text.
 */
export default function FolioLine({
  charge,
  actions,
  open,
  selected,
  onToggle,
  onPost,
  onStub,
}: FolioLineProps) {
  const status = chargeStatusLabel(charge);
  const name = charge.description;
  const settled = charge.status === 'settled';
  const parent = charge.type === 'split-parent';
  const statusText = status.full ? (
    <Tooltip title={status.full}>
      <span tabIndex={0} aria-label={status.full}>
        {status.text}
      </span>
    </Tooltip>
  ) : (
    status.text
  );
  return (
    <TableRow
      selected={selected && actions.select}
      data-line-type={charge.type}
      data-line-status={charge.status}
      sx={[settled && { '& td': { fontStyle: 'italic' } }, parent && { bgcolor: 'action.hover' }]}
    >
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 28 }}>
          {actions.select ? (
            <Checkbox
              size="small"
              checked={selected}
              onChange={() => onToggle(charge.id)}
              slotProps={{ input: { 'aria-label': `Select ${name}` } }}
            />
          ) : parent ? (
            // The parent is replaced by its parts: a minus mark instead of a checkbox.
            <Box sx={{ width: 38, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <IndeterminateCheckBoxOutlined fontSize="small" color="disabled" aria-hidden />
            </Box>
          ) : (
            <Box sx={{ width: 38, flexShrink: 0 }} />
          )}
          {chargeTypeLabel(charge)}
        </Box>
      </TableCell>
      <TableCell>{formatDisplayDate(charge.date)}</TableCell>
      <TableCell>{charge.description}</TableCell>
      <TableCell>{formatMoney(charge.amountCents)}</TableCell>
      <TableCell>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
        >
          <Box component="span" sx={{ minWidth: 0 }}>
            {statusText}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {actions.post ? (
              <Button
                size="small"
                color="info"
                startIcon={<GppMaybeOutlined />}
                disabled={!open}
                aria-label={`Post ${name}`}
                onClick={() => onPost(charge)}
              >
                Post
              </Button>
            ) : null}
            {actions.editSplit ? (
              <Button
                size="small"
                color="info"
                startIcon={<CallSplit />}
                disabled={!open}
                aria-label={`Edit or undo split ${name}`}
                onClick={() =>
                  onStub('Editing or undoing a split arrives with the split item ticket.')
                }
              >
                Split
              </Button>
            ) : null}
            {actions.edit ? (
              <IconButton
                size="small"
                color="info"
                disabled={!open}
                aria-label={`Edit ${name}`}
                onClick={() =>
                  onStub('Editing a room rate arrives with the rate adjustment ticket.')
                }
              >
                <Edit fontSize="small" />
              </IconButton>
            ) : null}
            {actions.delete ? (
              <IconButton
                size="small"
                disabled={!open}
                aria-label={`Delete ${name}`}
                onClick={() => onStub('Deleting a charge arrives with the manual charge ticket.')}
              >
                <Delete fontSize="small" />
              </IconButton>
            ) : null}
            {actions.transfer === 'allowed' ? (
              <IconButton
                size="small"
                disabled={!open}
                aria-label={
                  actions.transferUnassignedOnly
                    ? `Transfer ${name} to Unassigned`
                    : `Transfer ${name}`
                }
                onClick={() => onStub('Transfer arrives with the item transfer ticket.')}
              >
                <SwapHoriz fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        </Box>
      </TableCell>
    </TableRow>
  );
}
