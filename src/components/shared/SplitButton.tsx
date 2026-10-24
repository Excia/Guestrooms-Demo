import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import { visuallyHidden } from '@mui/utils';
import { useId, useState } from 'react';

export interface SplitButtonItem {
  id: string;
  label: string;
}

export interface SplitButtonProps {
  /** The primary action (Figma "Res Panel Split CTAs"). */
  primary: SplitButtonItem & {
    variant?: 'contained' | 'outlined';
    /** Why the primary action cannot run now: it is aria-disabled with this as its description (still focusable and clickable, so the click can explain). */
    blocked?: string;
  };
  /** The secondary actions behind the arrow. */
  items: readonly SplitButtonItem[];
  onPrimary: () => void;
  onItem: (id: string) => void;
  /** Accessible name of the arrow button. */
  menuLabel?: string;
}

/**
 * Split button: a primary action and an arrow that opens a menu of secondary actions. The arrow is
 * a menu button (Enter, Space or ArrowDown open it; Escape closes it and focus returns to the arrow).
 */
export default function SplitButton({
  primary,
  items,
  onPrimary,
  onItem,
  menuLabel = 'More actions',
}: SplitButtonProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const variant = primary.variant ?? 'contained';
  return (
    <>
      <ButtonGroup
        variant={variant}
        fullWidth
        sx={{
          '& .MuiButton-root': { minHeight: (t) => t.spacing(5.25) },
          ...(variant === 'outlined' && {
            '& .MuiButton-root': { borderColor: 'primary.outlinedBorder' },
          }),
        }}
      >
        {/* A blocked primary explains itself in a tooltip as well as the hidden description below
            (`describeChild`: the tooltip describes the button, it does not rename it). */}
        <Tooltip title={primary.blocked ?? ''} describeChild disableInteractive>
          <Button
            onClick={onPrimary}
            aria-disabled={primary.blocked ? true : undefined}
            aria-describedby={primary.blocked ? `${id}-blocked` : undefined}
            className={primary.blocked ? 'Mui-disabled' : undefined}
            sx={{ flexGrow: 1, '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' } }}
          >
            {primary.label}
          </Button>
        </Tooltip>
        <Button
          size="small"
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ flexGrow: 0, width: (t) => t.spacing(5.5), minWidth: 0 }}
        >
          <ArrowDropDown />
        </Button>
      </ButtonGroup>
      {primary.blocked ? (
        <Box id={`${id}-blocked`} sx={visuallyHidden}>
          {primary.blocked}
        </Box>
      ) : null}
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: { 'aria-label': menuLabel },
          paper: { sx: { minWidth: (t) => t.spacing(30) } },
        }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => {
              setAnchor(null);
              onItem(item.id);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
