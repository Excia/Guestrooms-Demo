import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { visuallyHidden } from '@mui/utils';

// A save can re-sort the list; keep the selected row in view without moving the page.
function scrollSelectedIntoView(el: HTMLElement | null) {
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
}

export interface SetupListItem {
  id: string;
  label: string;
  /** Outside its active dates: listed last with an inactive indicator (PDF 9.4.2.4). */
  inactive?: boolean;
}

export interface SetupListProps {
  items: readonly SetupListItem[];
  /** Id of the selected item; null while an unsaved new item is selected. */
  selectedId: string | null;
  newLabel: string;
  /** Title of the unsaved item, e.g. "New Room Type". */
  newTitle: string;
  /** Shown first and selected while a new (or duplicated) item is being edited. */
  creating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  /**
   * Legacy `SideBarControl` shows the add action and the new item as ONE row (Rate Categories): the
   * outlined add button, which becomes the selected row while the new item is edited. Clicking the
   * selected row does nothing. Off by default: Room Types, Rooms and Add-Ons keep the separate button.
   */
  singleNewRow?: boolean;
}

// Left list of Room Types, Rooms, Add-Ons and Rate Categories (Figma 11964:24902): the NEW button,
// then the items; the selected one is filled and has the green bar on the panel edge. Geometry follows
// the legacy SideBarControl and the Primary Setup navigation (D-SL-1): 59px tall items, 10px apart,
// the tab 15px short of the bar, 5px bar. Inactive items carry a red "Inactive" tag and are greyed.
export default function SetupList({
  items,
  selectedId,
  newLabel,
  newTitle,
  creating,
  onSelect,
  onNew,
  singleNewRow = false,
}: SetupListProps) {
  const row = (
    key: string,
    label: string,
    selected: boolean,
    onClick?: () => void,
    inactive?: boolean,
  ) => (
    <Box
      component="li"
      key={key}
      ref={selected ? scrollSelectedIntoView : undefined}
      sx={{ display: 'flex', position: 'relative' }}
    >
      <Button
        fullWidth
        size="large"
        variant={selected ? 'contained' : 'text'}
        color={selected ? 'primary' : 'inherit'}
        aria-current={selected ? 'true' : undefined}
        data-inactive={inactive ? 'true' : undefined}
        onClick={onClick}
        sx={(t) => ({
          justifyContent: 'flex-start',
          minHeight: t.spacing(7.375),
          // Active items read in the primary text colour, inactive ones are greyed (still AA).
          color: selected ? undefined : inactive ? 'text.secondary' : 'text.primary',
          fontStyle: inactive ? 'italic' : undefined,
          [t.breakpoints.up('lg')]: { mr: t.spacing(1.875) },
        })}
      >
        <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere', textAlign: 'left' }}>
          {label}
        </Box>
        {inactive ? (
          <>
            {/* Read as "Cottage, Inactive": a pause between the name and the tag. */}
            <Box component="span" sx={visuallyHidden}>
              ,{' '}
            </Box>
            <Chip
              component="span"
              size="small"
              variant="outlined"
              color="error"
              label="Inactive"
              sx={(t) => ({
                ml: 'auto',
                textTransform: 'none',
                flexShrink: 0,
                fontStyle: 'normal',
                fontWeight: 'bold',
                // Opaque, so the red text stays AA on the selected (green) item too.
                bgcolor: 'background.paper',
                pointerEvents: 'none',
                height: t.spacing(2.75),
                '& .MuiChip-label': { px: 1 },
              })}
            />
          </>
        ) : null}
      </Button>
      {selected ? (
        <Box
          aria-hidden
          data-testid="setup-list-active-bar"
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
  // The add action as the first row of the list (singleNewRow): outlined until the new item is edited.
  const addRow = () =>
    creating ? (
      row('new', newTitle, true)
    ) : (
      <Box component="li" key="new" sx={{ display: 'flex' }}>
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<Add />}
          onClick={onNew}
          sx={(t) => ({
            justifyContent: 'flex-start',
            minHeight: t.spacing(7.375),
            borderColor: 'primary.outlinedBorder',
            whiteSpace: 'nowrap',
            px: 1.25,
            '& .MuiButton-startIcon': { mr: 0.5 },
            [t.breakpoints.up('lg')]: { mr: t.spacing(1.875) },
          })}
        >
          {newLabel}
        </Button>
      </Box>
    );
  return (
    <Box>
      {singleNewRow ? null : (
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<Add />}
          onClick={onNew}
          sx={(t) => ({
            mb: 1.25,
            minHeight: t.spacing(7.375),
            borderColor: 'primary.outlinedBorder',
            [t.breakpoints.up('lg')]: { width: `calc(100% - ${t.spacing(1.875)})` },
          })}
        >
          {newLabel}
        </Button>
      )}
      <Box
        component="ul"
        sx={(t) => ({
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.25,
          [t.breakpoints.up('lg')]: { flexDirection: 'column', flexWrap: 'nowrap' },
        })}
      >
        {singleNewRow ? addRow() : creating ? row('new', newTitle, true) : null}
        {items.map((item) =>
          row(
            item.id,
            item.label,
            !creating && item.id === selectedId,
            () => onSelect(item.id),
            item.inactive,
          ),
        )}
      </Box>
    </Box>
  );
}
