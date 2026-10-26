import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import Close from '@mui/icons-material/Close';
import SwapVert from '@mui/icons-material/SwapVert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useRef, useState } from 'react';
import { moveItem, reconcileOrder, sameOrder } from '../../../app/roomOrder';
import ConfirmDialog from '../../shared/ConfirmDialog';

export interface RoomOrderItem {
  id: string;
  label: string;
}

export interface RoomOrderPanelProps {
  /** The rooms to order, in their saved order. */
  items: readonly RoomOrderItem[];
  saving: boolean;
  error: string | null;
  /** "Room" / "Dining Room": the nouns of the labels. */
  noun?: string;
  onSave: (ids: string[]) => void;
  /** The X, after discarding any change. */
  onClose: () => void;
}

// The reorder view that replaces the list in the Rooms left column: a drag handle per room, move up
// and move down buttons (keyboard and screen reader operation), Save Order and a close X. Closing
// with a changed order asks first. Drag and drop is native HTML5 on the handle.
export default function RoomOrderPanel({
  items,
  saving,
  error,
  noun = 'Room',
  onSave,
  onClose,
}: RoomOrderPanelProps) {
  const original = items.map((i) => i.id);
  // The user's moves; the shown order is reconciled with the current items on every render, so a room
  // that was deleted, retired or added while the view is open never shows blank or gets sent.
  const [moves, setMoves] = useState(original);
  const order = reconcileOrder(moves, original);
  const setOrder = setMoves;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [confirming, setConfirming] = useState(false);
  const rows = useRef(new Map<string, HTMLElement>());
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const labelOf = new Map(items.map((i) => [i.id, i.label]));
  const dirty = !sameOrder(order, original);

  const move = (from: number, to: number, focusButton?: string) => {
    if (to < 0 || to >= order.length || from === to) return;
    const id = order[from];
    setOrder(moveItem(order, from, to));
    setAnnouncement(`${labelOf.get(id)} moved to position ${to + 1} of ${order.length}`);
    if (focusButton) {
      // Keep the focus on the same button of the moved row; at the top or bottom that button is
      // disabled, so the focus goes to the opposite one instead of falling to the page.
      const last = order.length - 1;
      const target =
        (focusButton === 'up' && to === 0) || (focusButton === 'down' && to === last)
          ? focusButton === 'up'
            ? 'down'
            : 'up'
          : focusButton;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        rows.current.get(id)?.querySelector<HTMLElement>(`[data-move="${target}"]`)?.focus();
      });
    }
  };
  const close = () => (dirty ? setConfirming(true) : onClose());

  return (
    <Box>
      {/* The same row as New Room and the reorder button in the list (SetupList), so the views line up. */}
      <Box
        sx={(t) => ({
          display: 'flex',
          gap: 1,
          mb: 1.25,
          [t.breakpoints.up('lg')]: { mr: t.spacing(1.875) },
        })}
      >
        <Typography variant="subtitle2" component="h2" sx={visuallyHidden}>
          {noun} Order
        </Typography>
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={saving || !dirty}
          onClick={() => onSave(order)}
          sx={(t) => ({ minHeight: t.spacing(7.375), minWidth: 0, whiteSpace: 'nowrap' })}
        >
          {saving ? 'Saving…' : 'Save Order'}
        </Button>
        <IconButton
          aria-label={`Close ${noun.toLowerCase()} order`}
          onClick={close}
          sx={(t) => ({
            flexShrink: 0,
            width: t.spacing(7.375),
            borderRadius: 1,
            border: `1px solid ${t.palette.primary.outlinedBorder}`,
          })}
        >
          <Close />
        </IconButton>
      </Box>
      {error ? (
        <Typography role="alert" variant="body2" sx={{ color: 'error.main', mb: 1.25 }}>
          {error}
        </Typography>
      ) : null}
      {order.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No active {noun.toLowerCase()}s to order.
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label={`${noun} order`}
          sx={(t) => ({
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            [t.breakpoints.up('lg')]: { pr: t.spacing(1.875) },
          })}
        >
          {order.map((id, index) => (
            <Box
              component="li"
              key={id}
              ref={(el: HTMLElement | null) => {
                if (el) rows.current.set(id, el);
                else rows.current.delete(id);
              }}
              onDragOver={(e: React.DragEvent) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setOver(index);
              }}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, index);
                setDragFrom(null);
                setOver(null);
              }}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minHeight: t.spacing(6),
                pl: 0.5,
                pr: 0.5,
                borderRadius: 1,
                border: `1px solid ${t.palette.divider}`,
                bgcolor: 'background.paper',
                opacity: dragFrom === index ? 0.5 : 1,
                borderColor: over === index && dragFrom !== null ? 'primary.main' : 'divider',
              })}
            >
              <Box
                data-testid={`drag-handle-${id}`}
                draggable
                aria-hidden
                onDragStart={(e: React.DragEvent) => {
                  setDragFrom(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', id);
                  const row = rows.current.get(id);
                  if (row) e.dataTransfer.setDragImage(row, 0, 0);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setOver(null);
                }}
                sx={{ display: 'flex', cursor: 'grab', color: 'primary.main' }}
              >
                <SwapVert />
              </Box>
              <Typography sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                {labelOf.get(id)}
              </Typography>
              <IconButton
                size="small"
                sx={(t) => ({ minWidth: t.spacing(4), minHeight: t.spacing(4) })}
                data-move="up"
                aria-label={`Move ${labelOf.get(id)} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1, 'up')}
              >
                <ArrowUpward fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                sx={(t) => ({ minWidth: t.spacing(4), minHeight: t.spacing(4) })}
                data-move="down"
                aria-label={`Move ${labelOf.get(id)} down`}
                disabled={index === order.length - 1}
                onClick={() => move(index, index + 1, 'down')}
              >
                <ArrowDownward fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
      <ConfirmDialog
        open={confirming}
        title={`The ${noun.toLowerCase()} order has not been saved.`}
        message="Are you sure you want to close without saving?"
        confirmLabel="Keep editing"
        discardLabel="Close without saving"
        onClose={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
        onDiscard={() => {
          setConfirming(false);
          onClose();
        }}
      />
    </Box>
  );
}
