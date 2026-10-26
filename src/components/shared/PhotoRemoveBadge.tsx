import { useReadOnly } from '../../app/readOnlyContext';
import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import ButtonBase, { type ButtonBaseProps } from '@mui/material/ButtonBase';

export interface PhotoRemoveBadgeProps {
  /** Accessible name, e.g. "Remove photo pool.jpg". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Moves the badge off the default corner inset (a rounded logo needs it further out). */
  sx?: ButtonBaseProps['sx'];
}

// The remove control on a loaded photo (room photos, folio logo): a small round red badge with a
// white X and a white halo, pinned to the photo's corner by the parent (it is `position: absolute`,
// the parent sets the corner). The circle is 20px; the button around it is 24px, the minimum target.
export default function PhotoRemoveBadge({ label, onClick, disabled, sx }: PhotoRemoveBadgeProps) {
  // View-only mode removes nothing, so the control is not there.
  if (useReadOnly()) return null;
  return (
    <ButtonBase
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      focusRipple
      sx={[
        (t) => ({
          position: 'absolute',
          top: t.spacing(0.25),
          right: t.spacing(0.25),
          width: t.spacing(3),
          height: t.spacing(3),
          borderRadius: '50%',
          '&.Mui-focusVisible': {
            outline: `2px solid ${t.palette.primary.main}`,
            outlineOffset: t.spacing(0.25),
          },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        component="span"
        data-testid="photo-remove-circle"
        sx={(t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: t.spacing(2.5),
          height: t.spacing(2.5),
          borderRadius: '50%',
          bgcolor: 'error.main',
          color: 'error.contrastText',
          // The white halo keeps the badge readable on any photo.
          boxShadow: `0 0 0 ${t.spacing(0.25)} ${t.palette.background.paper}`,
          'button:hover > &': { bgcolor: 'error.dark' },
        })}
      >
        <Close sx={(t) => ({ fontSize: t.spacing(1.75) })} />
      </Box>
    </ButtonBase>
  );
}
