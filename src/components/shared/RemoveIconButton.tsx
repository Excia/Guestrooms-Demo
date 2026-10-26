import { useReadOnly } from '../../app/readOnlyContext';
import Delete from '@mui/icons-material/Delete';
import DeleteForever from '@mui/icons-material/DeleteForever';
import Box from '@mui/material/Box';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { visuallyHidden } from '@mui/utils';
import { useId } from 'react';

export interface RemoveIconButtonProps {
  /** What is removed, e.g. "Main Clubhouse". The accessible name is "Remove <label>". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why the button is disabled; shown in the tooltip and read as its description. */
  disabledReason?: string;
  /** "danger" (the standard for removing a row) uses the theme's error colour. */
  tone?: 'danger' | 'neutral';
  size?: IconButtonProps['size'];
  /** The legacy Employees screen draws `delete_forever` at 31px (Quasar lg). Default: the trash can. */
  icon?: 'delete' | 'delete-forever';
  sx?: IconButtonProps['sx'];
}

// The admin standard for removing a row or item: the trash can (the one Keycard Integration used
// first), in the error colour. Decision D-AP-1; whole-record deletes keep their own controls.
export default function RemoveIconButton({
  label,
  onClick,
  disabled = false,
  disabledReason,
  tone = 'danger',
  size = 'medium',
  icon = 'delete',
  sx,
}: RemoveIconButtonProps) {
  const reasonId = useId();
  // View-only mode removes nothing, so the control is not there.
  const readOnly = useReadOnly();
  if (readOnly) return null;
  const name = `Remove ${label}`;
  const reason = disabled ? disabledReason : undefined;
  return (
    <Tooltip title={reason ?? name}>
      {/* A disabled button cannot show a tooltip itself. */}
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <IconButton
          aria-label={name}
          aria-describedby={reason ? reasonId : undefined}
          color={tone === 'danger' ? 'error' : 'default'}
          size={size}
          disabled={disabled}
          onClick={onClick}
          sx={[
            (t) => ({
              minWidth: t.spacing(3),
              minHeight: t.spacing(3),
              '&.Mui-focusVisible': {
                outline: `2px solid ${t.palette.primary.main}`,
                outlineOffset: t.spacing(0.25),
              },
            }),
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {icon === 'delete-forever' ? (
            <DeleteForever sx={(t) => ({ fontSize: t.spacing(3.875) })} />
          ) : (
            <Delete fontSize={size === 'small' ? 'small' : 'medium'} />
          )}
        </IconButton>
        {reason ? (
          <Box id={reasonId} component="span" sx={visuallyHidden}>
            {reason}
          </Box>
        ) : null}
      </Box>
    </Tooltip>
  );
}
