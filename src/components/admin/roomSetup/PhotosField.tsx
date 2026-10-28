import { useDisabled, useReadOnly } from '../../../app/readOnlyContext';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternateOutlined';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useRef, useState } from 'react';
import { useApi } from '../../../api';
import type { PhotoOwner, RoomPhoto } from '../../../api/types';
import {
  acceptPhotoFiles,
  MAX_PHOTOS,
  PHOTO_RULES_HINT,
  PHOTO_TYPES,
  removePhoto,
  sniffPhotoType,
  storedPhotoName,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_SUCCESS_MESSAGE,
} from '../../../app/photos';
import { readFileHead } from '../../../lib/readFileHead';
import ReorderIcon from '../../shared/ReorderIcon';
import PhotoRemoveBadge from '../../shared/PhotoRemoveBadge';
import { ErrorLines } from '../systemSettings/fieldParts';
import PhotoOrderDialog from './PhotoOrderDialog';
import PhotoThumb from './PhotoThumb';
import { usePendingDelete } from './usePendingDelete';

export interface PhotosFieldProps {
  /** What the photos belong to; the upload request names it. */
  owner: PhotoOwner;
  /** The saved record's id; null or undefined while the record is new. */
  entityId?: string | null;
  photos: readonly RoomPhoto[];
  onChange: (photos: RoomPhoto[]) => void;
  disabled?: boolean;
  /** Validation message (a room type needs at least one photo). */
  error?: string;
  id?: string;
}

const previewUrl = (file: File) =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
const revokePreview = (url: string) => {
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
};

type FocusTarget = { kind: 'badge'; id: string } | { kind: 'add' } | null;

// "Photos" with ADD PHOTOS, an order dialog and removable thumbnails (Figma 11964:28502 and Image
// Placeholder 11964:13054; behavior of the legacy ImageContainerInput, ImageUploadInput and
// ImageEditOrder). Picked files go through the photo API (it re-checks the rules and answers the
// stored photos); the form previews the local file. Remove asks twice, like the legacy button.
// Photos are part of the record: adding, removing and reordering change the form and are saved
// with it (Q-190-2).
export default function PhotosField({
  owner,
  entityId = null,
  photos,
  onChange,
  disabled: disabledProp,
  error,
  id,
}: PhotosFieldProps) {
  const api = useApi();
  const disabled = useDisabled(disabledProp);
  const readOnly = useReadOnly();
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // The live region: upload result, "Delete is armed", "Photo removed".
  const [announcement, setAnnouncement] = useState('');
  const [ordering, setOrdering] = useState(false);
  const removeRefs = useRef(new Map<string, HTMLElement>());
  const focusNext = useRef<FocusTarget>(null);
  const errorId = useId();
  const headingId = useId();
  const hintId = useId();
  // A lapsed Delete that still had the focus hands it back to the photo's remove button.
  const pending = usePendingDelete((lapsedId) => {
    const del = removeRefs.current.get(lapsedId)?.querySelector('[data-photo-delete]');
    if (del && document.activeElement === del) focusNext.current = { kind: 'badge', id: lapsedId };
  });

  // The latest photos and callback, for the upload that finishes after the form changed.
  const latest = useRef({ photos, onChange });
  useEffect(() => {
    latest.current = { photos, onChange };
  });
  // An upload still running when the record changes (or the field goes away) is dropped.
  const aborter = useRef<AbortController | null>(null);
  useEffect(() => () => aborter.current?.abort(), [entityId]);

  // Preview (blob) URLs made here are revoked once their photo leaves the list (removed, or the
  // draft replaced by the saved record or discarded) and when the field goes away.
  const blobs = useRef(new Set<string>());
  const shown = useRef(new Set<string>());
  useEffect(() => {
    const current = new Set(photos.map((p) => p.url));
    for (const url of [...blobs.current]) {
      if (current.has(url)) shown.current.add(url);
      else if (shown.current.has(url)) {
        revokePreview(url);
        blobs.current.delete(url);
        shown.current.delete(url);
      }
    }
  }, [photos]);
  useEffect(() => {
    const made = blobs.current;
    return () => {
      made.forEach(revokePreview);
      made.clear();
    };
  }, []);

  // Focus once when a photo is armed: on its Delete button.
  useEffect(() => {
    if (pending.armedId === null) return;
    removeRefs.current
      .get(pending.armedId)
      ?.querySelector<HTMLElement>('[data-photo-delete]')
      ?.focus();
  }, [pending.armedId]);
  // Focus handed on after a removal, an Escape or a lapse.
  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    if (target.kind === 'add') addRef.current?.focus();
    else removeRefs.current.get(target.id)?.querySelector<HTMLElement>('button')?.focus();
  });

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    setAnnouncement('');
    const byRules = acceptPhotoFiles(files, photos.length);
    aborter.current?.abort();
    const controller = new AbortController();
    aborter.current = controller;
    setUploading(true);
    try {
      // The extension and type are the user's word; the first bytes must agree.
      const heads = await Promise.all(
        byRules.accepted.map((f) => readFileHead(f).catch(() => new Uint8Array())),
      );
      if (controller.signal.aborted) return;
      const accepted: File[] = [];
      const errors = [...byRules.errors];
      byRules.accepted.forEach((f, i) => {
        if (sniffPhotoType(heads[i]) === f.type) accepted.push(f);
        else errors.push(`${f.name} is not a valid JPG or PNG image.`);
      });
      setUploadErrors(errors);
      if (accepted.length === 0) {
        setUploading(false);
        return;
      }
      const stored = await api.photos.upload(
        {
          owner,
          entityId,
          existingCount: photos.length,
          files: accepted.map((f) => ({
            name: storedPhotoName(f.name),
            type: f.type,
            size: f.size,
          })),
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (stored.length !== accepted.length) throw new Error('Unexpected upload answer');
      const added = stored.map((p, i) => {
        if (p.url) return p;
        const url = previewUrl(accepted[i]);
        if (url) blobs.current.add(url);
        return { ...p, url };
      });
      latest.current.onChange([...latest.current.photos, ...added]);
      setAnnouncement(UPLOAD_SUCCESS_MESSAGE);
    } catch {
      if (controller.signal.aborted) return;
      setUploadErrors((prev) => [...prev, UPLOAD_FAILED_MESSAGE]);
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  };

  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 2,
        }}
      >
        <Typography
          id={headingId}
          variant="body2"
          component="h3"
          sx={{ fontWeight: 'bold', color: disabled ? 'text.disabled' : 'text.secondary' }}
        >
          Photos
        </Typography>
        {readOnly ? null : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {photos.length > 1 ? (
              <Button
                variant="outlined"
                startIcon={<ReorderIcon />}
                disabled={disabled || uploading}
                onClick={() => setOrdering(true)}
              >
                Edit photo order
              </Button>
            ) : null}
            <Button
              id={id}
              ref={addRef}
              variant="outlined"
              startIcon={<AddPhotoAlternate />}
              disabled={disabled || atLimit || uploading}
              onClick={() => inputRef.current?.click()}
              aria-describedby={[hintId, error ? errorId : undefined].filter(Boolean).join(' ')}
            >
              {uploading ? 'Uploading…' : 'Add photos'}
            </Button>
          </Box>
        )}
        {readOnly ? null : (
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={PHOTO_TYPES.join(',')}
            hidden
            aria-label="Photo files"
            tabIndex={-1}
            onChange={(e) => void onFiles(e.target.files)}
          />
        )}
      </Box>
      <ErrorLines id={errorId} messages={error ? [error] : undefined} />
      {uploadErrors.length > 0 ? (
        <Box role="alert">
          <ErrorLines id={`${errorId}-upload`} messages={uploadErrors} />
        </Box>
      ) : null}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
      {photos.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No photos
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label="Photos"
          aria-busy={uploading}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 2 }}
        >
          {photos.map((photo) => {
            const armed = pending.armedId === photo.id;
            return (
              <Box
                component="li"
                key={photo.id}
                ref={(el: HTMLElement | null) => {
                  if (el) removeRefs.current.set(photo.id, el);
                  else removeRefs.current.delete(photo.id);
                }}
              >
                <PhotoThumb photo={photo} dimmed={disabled}>
                  {armed ? (
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      // Focus lands here when it is armed (effect on armedId). aria-disabled (not disabled) keeps the
                      // focus during the first half second, when a press does nothing.
                      data-photo-delete=""
                      aria-disabled={!pending.ready}
                      aria-label={`Confirm remove photo ${photo.name}`}
                      onClick={() => {
                        if (!pending.ready) return;
                        pending.cancel();
                        const index = photos.findIndex((p) => p.id === photo.id);
                        const rest = removePhoto(photos, photo.id);
                        const next = rest[index] ?? rest[index - 1];
                        focusNext.current = next ? { kind: 'badge', id: next.id } : { kind: 'add' };
                        setAnnouncement('Photo removed');
                        onChange(rest);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          pending.cancel();
                          focusNext.current = { kind: 'badge', id: photo.id };
                        }
                      }}
                      onBlur={pending.cancel}
                      sx={(t) => ({
                        position: 'absolute',
                        top: t.spacing(0.5),
                        right: t.spacing(0.5),
                        minWidth: 0,
                      })}
                    >
                      Delete
                    </Button>
                  ) : (
                    <PhotoRemoveBadge
                      label={`Remove photo ${photo.name}`}
                      disabled={disabled}
                      onClick={() => {
                        setAnnouncement(
                          `Press Delete to remove ${photo.name}, or Escape to cancel`,
                        );
                        pending.arm(photo.id);
                      }}
                    />
                  )}
                </PhotoThumb>
              </Box>
            );
          })}
        </Box>
      )}
      <FormHelperText sx={{ mt: 1 }}>
        {photos.length} of {MAX_PHOTOS} photos
      </FormHelperText>
      <FormHelperText id={hintId} sx={{ mt: 0 }}>
        {PHOTO_RULES_HINT}
      </FormHelperText>
      <PhotoOrderDialog
        open={ordering}
        photos={photos}
        onClose={() => setOrdering(false)}
        onSave={(next) => {
          onChange(next);
          setOrdering(false);
        }}
      />
    </Box>
  );
}
