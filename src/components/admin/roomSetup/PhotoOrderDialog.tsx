import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import IconButton from '@mui/material/IconButton';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useRef, useState } from 'react';
import type { RoomPhoto } from '../../../api/types';
import { movePhoto, nudgePhoto, samePhotoOrder } from '../../../app/photos';
import DialogHeader from '../../shared/DialogHeader';
import PhotoThumb from './PhotoThumb';

export interface PhotoOrderDialogProps {
  open: boolean;
  photos: readonly RoomPhoto[];
  /** Save: the photos in the new order. */
  onSave: (photos: RoomPhoto[]) => void;
  /** Cancel, the X, Escape: the order is left as it was. */
  onClose: () => void;
}

// "Edit Photo Order" (legacy ImageEditOrder): drag a photo to a new place, or use the earlier and
// later buttons (keyboard and screen reader operation). Save applies the order, Cancel drops it.
export default function PhotoOrderDialog({ open, photos, onSave, onClose }: PhotoOrderDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
    >
      <DialogHeader id={`${id}-title`} title="Edit Photo Order" onClose={onClose} />
      {/* Mounted only while open, so every opening starts from the current order. */}
      {open ? (
        <OrderBody hintId={`${id}-hint`} photos={photos} onSave={onSave} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function OrderBody({
  hintId,
  photos,
  onSave,
  onClose,
}: {
  hintId: string;
  photos: readonly RoomPhoto[];
  onSave: (photos: RoomPhoto[]) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<RoomPhoto[]>([...photos]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const tiles = useRef(new Map<string, HTMLElement>());
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const dirty = !samePhotoOrder(order, photos);

  const apply = (next: RoomPhoto[], photo: RoomPhoto, focusButton?: 'earlier' | 'later') => {
    const to = next.findIndex((p) => p.id === photo.id);
    setOrder(next);
    setAnnouncement(`${photo.name} moved to position ${to + 1} of ${next.length}`);
    if (!focusButton) return;
    // Keep the focus on the same button of the moved photo; at an end that button is disabled, so
    // the focus goes to the opposite one.
    const target =
      (focusButton === 'earlier' && to === 0) || (focusButton === 'later' && to === next.length - 1)
        ? focusButton === 'earlier'
          ? 'later'
          : 'earlier'
        : focusButton;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      tiles.current.get(photo.id)?.querySelector<HTMLElement>(`[data-move="${target}"]`)?.focus();
    });
  };

  return (
    <>
      <DialogContent>
        <DialogContentText id={hintId} sx={{ mb: 2 }}>
          Drag a photo to a new place, or use the arrow buttons.
        </DialogContentText>
        <Box
          component="ul"
          aria-label="Photo order"
          sx={(t) => ({
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${t.spacing(14.5)}, 1fr))`,
            gap: 2,
            justifyItems: 'center',
          })}
        >
          {order.map((photo, index) => (
            <Box
              component="li"
              key={photo.id}
              ref={(el: HTMLElement | null) => {
                if (el) tiles.current.set(photo.id, el);
                else tiles.current.delete(photo.id);
              }}
              draggable
              onDragStart={(e: React.DragEvent) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', photo.id);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setOver(null);
              }}
              onDragOver={(e: React.DragEvent) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setOver(index);
              }}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== index) {
                  apply(movePhoto(order, dragFrom, index), order[dragFrom]);
                }
                setDragFrom(null);
                setOver(null);
              }}
              sx={(t) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'grab',
                borderRadius: 1,
                outline:
                  over === index && dragFrom !== null
                    ? `2px dashed ${t.palette.primary.main}`
                    : 'none',
                outlineOffset: t.spacing(0.5),
                opacity: dragFrom === index ? 0.5 : 1,
              })}
            >
              <PhotoThumb photo={photo} label={`Photo ${index + 1}: ${photo.name}`} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  data-move="earlier"
                  aria-label={`Move ${photo.name} earlier`}
                  disabled={index === 0}
                  onClick={() => apply(nudgePhoto(order, index, -1), photo, 'earlier')}
                >
                  <ArrowBack fontSize="small" />
                </IconButton>
                <Box component="span" sx={{ typography: 'body2', color: 'text.secondary' }}>
                  {index + 1}
                </Box>
                <IconButton
                  size="small"
                  data-move="later"
                  aria-label={`Move ${photo.name} later`}
                  disabled={index === order.length - 1}
                  onClick={() => apply(nudgePhoto(order, index, 1), photo, 'later')}
                >
                  <ArrowForward fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {announcement}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!dirty} onClick={() => onSave(order)}>
          Save
        </Button>
      </DialogActions>
    </>
  );
}
