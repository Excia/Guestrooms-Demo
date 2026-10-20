import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useId, useState } from 'react';

export interface SplitButtonItem {
  id: string;
  label: string;
}

export interface SplitButtonProps {
  /** The primary action (Figma "Res Panel Split CTAs"). */
  primary: SplitButtonItem & { variant?: 'contained' | 'outlined' };
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
        <Button onClick={onPrimary} sx={{ flexGrow: 1 }}>
          {primary.label}
        </Button>
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
