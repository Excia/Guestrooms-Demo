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
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_SUCCESS_MESSAGE,
} from '../../../app/photos';
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
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [ordering, setOrdering] = useState(false);
  const pending = usePendingDelete();
  const removeRefs = useRef(new Map<string, HTMLElement>());
  const focusBadge = useRef<string | null>(null);
  const errorId = useId();
  const headingId = useId();
  const hintId = useId();

  // The latest photos and callback, for the upload that finishes after the form changed.
  const latest = useRef({ photos, onChange });
  useEffect(() => {
    latest.current = { photos, onChange };
  });
  const aborter = useRef<AbortController | null>(null);
  useEffect(() => () => aborter.current?.abort(), []);

  // After Escape on an armed Delete, the focus returns to that photo's remove badge.
  useEffect(() => {
    if (focusBadge.current === null) return;
    removeRefs.current.get(focusBadge.current)?.querySelector<HTMLElement>('button')?.focus();
    focusBadge.current = null;
  });

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    setSuccess('');
    const { accepted, errors } = acceptPhotoFiles(files, photos.length);
    setUploadErrors(errors);
    if (accepted.length === 0) return;
    aborter.current?.abort();
    const controller = new AbortController();
    aborter.current = controller;
    setUploading(true);
    try {
      const stored = await api.photos.upload(
        {
          owner,
          entityId,
          existingCount: photos.length,
          files: accepted.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const added = stored.map((p, i) => ({ ...p, url: p.url || previewUrl(accepted[i]) }));
      latest.current.onChange([...latest.current.photos, ...added]);
      setSuccess(UPLOAD_SUCCESS_MESSAGE);
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
        {success}
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
                      // Focus lands here when it is armed. aria-disabled (not disabled) keeps the
                      // focus during the first half second, when a press does nothing.
                      ref={(el: HTMLButtonElement | null) => el?.focus()}
                      aria-disabled={!pending.ready}
                      aria-label={`Confirm remove photo ${photo.name}`}
                      onClick={() => {
                        if (!pending.ready) return;
                        pending.cancel();
                        onChange(removePhoto(photos, photo.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          pending.cancel();
                          focusBadge.current = photo.id;
                        }
                      }}
                      onBlur={pending.cancel}
                      sx={(t) => ({
                        position: 'absolute',
                        top: t.spacing(0.5),
                        right: t.spacing(0.5),
                        minWidth: 0,
                        opacity: pending.ready ? 1 : 0.7,
                      })}
                    >
                      Delete
                    </Button>
                  ) : (
                    <PhotoRemoveBadge
                      label={`Remove photo ${photo.name}`}
                      disabled={disabled}
                      onClick={() => pending.arm(photo.id)}
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
