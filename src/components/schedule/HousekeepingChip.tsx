import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import { type Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useId, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import type { HousekeepingStatus, ScheduleBlock, SettableHousekeepingStatus } from '../../api';
import { MAX_NOTES_LENGTH } from '../../api/validation';
import {
  HOUSEKEEPING_OPTIONS,
  type HousekeepingChip as ChipSpec,
  type HousekeepingPatch,
} from '../../app/scheduleGrid';

/** Saves a change; resolves true when it was accepted, false when it failed (and was reverted). */
export type SetHousekeeping = (block: ScheduleBlock, patch: HousekeepingPatch) => Promise<boolean>;

export interface HousekeepingChipProps {
  block: ScheduleBlock;
  chip: ChipSpec;
  fill: string;
  /** The status shown (the stored one, or the default of a stay with none); defaults to `block.housekeeping`. */
  status?: HousekeepingStatus;
  /** The statuses the pop-up offers for this stay's lifecycle (`housekeepingOptionsFor`); defaults to all. */
  options?: readonly { value: SettableHousekeepingStatus; label: string }[];
  /** Absent when the user may not change housekeeping: the chip is then only drawn. */
  onSave?: SetHousekeeping;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

// The chip and its popover sit inside the schedule grid (in the React tree, also the portal), whose
// pointer, click and key handlers drag, open and pick up blocks. None of that is meant here.
const stopKeys = (event: KeyboardEvent) => {
  if (event.key !== 'Tab') event.stopPropagation();
};

function isSettable(status: HousekeepingStatus | undefined): status is SettableHousekeepingStatus {
  return HOUSEKEEPING_OPTIONS.some((o) => o.value === status);
}

/**
 * The "H" chip after a block's departure edge (Figma "Housekeeping Block") and, for users who may
 * change it, the small pop-up that sets the status and the note (functional doc 15.13.4; no Figma
 * design exists, so this is plain themed MUI). Picking a status saves at once; the note is saved
 * with Save; the X closes.
 */
export default function HousekeepingChip({
  block,
  chip,
  fill,
  status: shown,
  options = HOUSEKEEPING_OPTIONS,
  onSave,
}: HousekeepingChipProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = block.housekeepingNotes ?? '';
  const current = shown ?? block.housekeeping;
  const status = isSettable(current) ? current : undefined;

  const look = (t: Theme) => ({
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: '100%',
    ml: 0.25,
    boxSizing: 'border-box' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 0,
    border: 0,
    borderRadius: t.spacing(0.625),
    bgcolor: fill,
    color: t.palette.common.black,
    fontFamily: 'inherit',
    fontSize: t.typography.pxToRem(10),
    lineHeight: 1,
  });
  const glyph = chip.letter ? (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'flex-start' }}>
      H
      {chip.plus ? (
        <Box component="span" sx={(t) => ({ fontSize: t.typography.pxToRem(8) })}>
          +
        </Box>
      ) : null}
    </Box>
  ) : null;

  if (!onSave) {
    return (
      <Tooltip title={chip.title} disableInteractive>
        <Box
          role="img"
          aria-label={chip.readOnlyName}
          data-housekeeping={current}
          style={{ width: chip.width }}
          sx={(t) => ({ ...look(t), overflow: 'hidden' })}
        >
          {glyph}
        </Box>
      </Tooltip>
    );
  }

  const open = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDraft(saved);
    setEditing(saved !== '');
    setAnchor(event.currentTarget);
  };
  const close = () => setAnchor(null);

  const run = async (patch: HousekeepingPatch) => {
    setSaving(true);
    try {
      return await onSave(block, patch);
    } finally {
      setSaving(false);
    }
  };
  const pick = (value: SettableHousekeepingStatus) => {
    if (!saving && value !== status) void run({ status: value });
  };
  const trimmed = draft.trim();
  const dirty = trimmed !== saved;
  const saveNotes = async () => {
    if (!status || !dirty) return;
    if (await run({ status, notes: trimmed })) close();
  };

  return (
    <>
      <Tooltip title={chip.title} disableInteractive>
        <Box
          component="button"
          type="button"
          aria-label={chip.name}
          aria-haspopup="dialog"
          aria-expanded={anchor ? true : undefined}
          data-housekeeping={current}
          style={{ width: chip.width }}
          onPointerDown={stop}
          onClick={open}
          onKeyDown={stopKeys}
          sx={(t) => ({
            ...look(t),
            cursor: 'pointer',
            '&:focus-visible': {
              outline: `2px solid ${t.palette.primary.main}`,
              outlineOffset: 1,
              zIndex: 6,
            },
          })}
        >
          {glyph}
        </Box>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClick={stop}
        onPointerDown={stop}
        onKeyDown={stopKeys}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': `${id}-title`,
            sx: { width: (t) => t.spacing(32), p: 2, mt: 0.5 },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography id={`${id}-title`} variant="subtitle1" component="h2">
            Housekeeping
          </Typography>
          <IconButton aria-label="Close housekeeping" size="small" edge="end" onClick={close}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
        <TextField
          select
          fullWidth
          size="small"
          label="Status"
          value={status ?? ''}
          // Not disabled while saving: that would drop focus from the select. Busy, and picks are ignored.
          slotProps={{ select: { SelectDisplayProps: { 'aria-busy': saving || undefined } } }}
          onChange={(e) => pick(e.target.value as SettableHousekeepingStatus)}
          sx={{ mt: 1.5 }}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        {editing ? (
          <TextField
            fullWidth
            multiline
            minRows={3}
            size="small"
            label="Notes"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_NOTES_LENGTH } }}
            sx={{ mt: 1.5 }}
          />
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
          {editing ? (
            <Button
              size="small"
              onClick={() => {
                setDraft('');
                setEditing(false);
              }}
            >
              Remove Notes
            </Button>
          ) : (
            <Button size="small" onClick={() => setEditing(true)}>
              Add Notes
            </Button>
          )}
          <Button variant="contained" size="small" disabled={!dirty || saving} onClick={saveNotes}>
            Save
          </Button>
        </Box>
      </Popover>
    </>
  );
}
