import { useDisabled, useReadOnly } from '../../../app/readOnlyContext';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternateOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';
import { useId, useRef, useState } from 'react';
import type { RoomPhoto } from '../../../api/types';
import { acceptPhotoFiles, MAX_PHOTOS, PHOTO_TYPES, removePhoto } from '../../../app/roomSetup';
import { newRequestId } from '../../../lib/requestId';
import PhotoRemoveBadge from '../../shared/PhotoRemoveBadge';
import { ErrorLines } from '../systemSettings/fieldParts';

export interface PhotosFieldProps {
  photos: readonly RoomPhoto[];
  onChange: (photos: RoomPhoto[]) => void;
  disabled?: boolean;
  /** Validation message (a room type needs at least one photo). */
  error?: string;
  id?: string;
}

const previewUrl = (file: File) =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';

// "Photos" with ADD PHOTOS and removable thumbnails (Figma 11964:28502 and Image Placeholder
// 11964:13054). Files are previewed locally; where they are stored is open (Q-72-1). A photo
// without a preview shows the striped placeholder.
export default function PhotosField({
  photos,
  onChange,
  disabled: disabledProp,
  error,
  id,
}: PhotosFieldProps) {
  const disabled = useDisabled(disabledProp);
  const readOnly = useReadOnly();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const errorId = useId();
  const headingId = useId();

  const onFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const { accepted, errors } = acceptPhotoFiles(files, photos.length);
    setUploadErrors(errors);
    if (accepted.length > 0) {
      onChange([
        ...photos,
        ...accepted.map((f) => ({ id: newRequestId(), name: f.name, url: previewUrl(f) })),
      ]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          id={headingId}
          variant="body2"
          component="h3"
          sx={{ fontWeight: 'bold', color: disabled ? 'text.disabled' : 'text.secondary' }}
        >
          Photos
        </Typography>
        {readOnly ? null : (
          <Button
            id={id}
            variant="outlined"
            startIcon={<AddPhotoAlternate />}
            disabled={disabled || photos.length >= MAX_PHOTOS}
            onClick={() => inputRef.current?.click()}
            aria-describedby={error ? errorId : undefined}
          >
            Add photos
          </Button>
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
            onChange={(e) => onFiles(e.target.files)}
          />
        )}
      </Box>
      <ErrorLines id={errorId} messages={error ? [error] : undefined} />
      <ErrorLines id={`${errorId}-upload`} messages={uploadErrors} />
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 2 }}
      >
        {photos.map((photo) => (
          <Box
            component="li"
            key={photo.id}
            sx={(t) => ({
              position: 'relative',
              width: t.spacing(14.5),
              height: t.spacing(15),
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              backgroundImage: photo.url
                ? `url("${photo.url}")`
                : `repeating-linear-gradient(135deg, ${t.palette.action.disabledBackground} 0 ${t.spacing(1.5)}, ${t.palette.action.hover} ${t.spacing(1.5)} ${t.spacing(3)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: disabled ? 0.6 : 1,
            })}
          >
            <Box
              component="span"
              sx={{ position: 'absolute', inset: 0 }}
              role="img"
              aria-label={photo.name}
            />
            <PhotoRemoveBadge
              label={`Remove photo ${photo.name}`}
              disabled={disabled}
              onClick={() => onChange(removePhoto(photos, photo.id))}
            />
          </Box>
        ))}
      </Box>
      <FormHelperText sx={{ mt: 1 }}>
        {photos.length} of {MAX_PHOTOS} photos
      </FormHelperText>
    </Box>
  );
}
