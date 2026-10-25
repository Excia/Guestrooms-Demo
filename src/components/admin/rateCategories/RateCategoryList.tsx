import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { SetupListItem } from '../roomSetup/SetupList';

export interface RateCategoryListProps {
  items: readonly SetupListItem[];
  /** Id of the selected item; null while an unsaved new category is selected. */
  selectedId: string | null;
  /** Label of the add action and of the new category while it is being edited. */
  newLabel: string;
  /** An unsaved new category is being edited: the add row itself shows as selected. */
  creating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

// Left list of Rate Categories, built to look like the Admin Setup navigation (AdminShell): the same
// row height (59px), no gap between rows, the same 15px between a row and the panel edge, the
// same filled active row with the green bar. Legacy (SideBarControl) puts "New Rate Category" first,
// in the list, so the add action and the new category are ONE row: it is the outlined add button until
// a new category is being edited, then it is that category's selected row.
export default function RateCategoryList({
  items,
  selectedId,
  newLabel,
  creating,
  onSelect,
  onNew,
}: RateCategoryListProps) {
  const row = (
    key: string,
    selected: boolean,
    button: {
      label: string;
      onClick: () => void;
      add?: boolean;
      inactive?: boolean;
    },
  ) => (
    <Box
      component="li"
      key={key}
      sx={(t) => ({
        display: 'flex',
        position: 'relative',
        // A little air between the add row and the categories under it.
        ...(button.add ? { [t.breakpoints.up('lg')]: { mb: 1 } } : {}),
      })}
    >
      <Button
        fullWidth
        size="large"
        variant={selected ? 'contained' : button.add ? 'outlined' : 'text'}
        color={selected ? 'primary' : button.add ? 'primary' : 'inherit'}
        startIcon={button.add && !selected ? <Add /> : undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={button.onClick}
        sx={(t) => ({
          justifyContent: 'flex-start',
          minHeight: t.spacing(7.375),
          color: selected || button.add ? undefined : 'text.secondary',
          borderColor: button.add && !selected ? 'primary.outlinedBorder' : undefined,
          opacity: button.inactive && !selected ? 0.7 : 1,
          // The add row stays on one line (legacy: padding-left 10px, then the label).
          ...(button.add
            ? { whiteSpace: 'nowrap', px: 1.25, '& .MuiButton-startIcon': { mr: 0.5 } }
            : {}),
          // 15px gap between the row and the bar (legacy: the tab's margin-right).
          [t.breakpoints.up('lg')]: { mr: t.spacing(1.875) },
        })}
      >
        {button.label}
        {button.inactive ? (
          <Box component="span" sx={{ ml: 1, fontWeight: 'normal', textTransform: 'none' }}>
            (Inactive)
          </Box>
        ) : null}
      </Button>
      {selected ? (
        <Box
          aria-hidden
          data-testid="rate-list-active-bar"
          sx={(t) => ({
            display: { xs: 'none', lg: 'block' },
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: t.spacing(0.625),
            bgcolor: 'primary.main',
            borderRadius: `${t.spacing(0.5)} 0 0 ${t.spacing(0.5)}`,
          })}
        />
      ) : null}
    </Box>
  );
  return (
    <Box
      component="ul"
      sx={(t) => ({
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        [t.breakpoints.up('lg')]: { flexDirection: 'column', flexWrap: 'nowrap', gap: 0 },
      })}
    >
      {row('new', creating, { label: newLabel, onClick: onNew, add: true })}
      {items.map((item) =>
        row(item.id, !creating && item.id === selectedId, {
          label: item.label,
          onClick: () => onSelect(item.id),
          inactive: item.inactive,
        }),
      )}
    </Box>
  );
}
