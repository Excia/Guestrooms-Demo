import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { RoomPhoto } from '../../../api/types';
import { cssUrl } from '../../../app/photos';

export interface PhotoThumbProps {
  photo: RoomPhoto;
  /** The loaded photo's name for assistive technology; the order dialog labels it with its position. */
  label?: string;
  dimmed?: boolean;
  /** Controls pinned over the photo (remove badge, move buttons). */
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

// One photo tile (Figma Image Placeholder 11964:13054): the picture, or the striped placeholder when
// the file has no preview (the mock stores no files).
export default function PhotoThumb({ photo, label, dimmed, children, sx }: PhotoThumbProps) {
  return (
    <Box
      sx={[
        (t) => ({
          position: 'relative',
          width: t.spacing(14.5),
          height: t.spacing(15),
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          backgroundImage: photo.url
            ? cssUrl(photo.url)
            : `repeating-linear-gradient(135deg, ${t.palette.action.disabledBackground} 0 ${t.spacing(1.5)}, ${t.palette.action.hover} ${t.spacing(1.5)} ${t.spacing(3)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: dimmed ? 0.6 : 1,
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        component="span"
        sx={{ position: 'absolute', inset: 0 }}
        role="img"
        aria-label={label ?? photo.name}
      />
      {children}
    </Box>
  );
}
