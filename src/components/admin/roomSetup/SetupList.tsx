import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

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
}

// Left list of Room Types and Rooms (Figma 11964:24902): the NEW button, then the items; the
// selected one is filled and has the green tab on its edge.
export default function SetupList({
  items,
  selectedId,
  newLabel,
  newTitle,
  creating,
  onSelect,
  onNew,
}: SetupListProps) {
  const row = (
    key: string,
    label: string,
    selected: boolean,
    onClick?: () => void,
    inactive?: boolean,
  ) => (
    <Box component="li" key={key} sx={{ display: 'flex' }}>
      <Button
        fullWidth
        size="large"
        variant={selected ? 'contained' : 'text'}
        color={selected ? 'primary' : 'inherit'}
        aria-current={selected ? 'true' : undefined}
        onClick={onClick}
        sx={(t) => ({
          justifyContent: 'flex-start',
          minHeight: t.spacing(5.25),
          color: selected ? undefined : 'text.secondary',
          opacity: inactive && !selected ? 0.7 : 1,
        })}
      >
        {label}
        {inactive ? (
          <Box component="span" sx={{ ml: 1, fontWeight: 'normal', textTransform: 'none' }}>
            (Inactive)
          </Box>
        ) : null}
      </Button>
      {selected ? (
        <Box
          aria-hidden
          sx={(t) => ({
            display: { xs: 'none', lg: 'block' },
            width: t.spacing(0.875),
            bgcolor: 'primary.main',
            borderRadius: `${t.spacing(0.25)} 0 0 ${t.spacing(0.25)}`,
          })}
        />
      ) : null}
    </Box>
  );
  return (
    <Box>
      <Button
        fullWidth
        variant="outlined"
        size="large"
        startIcon={<Add />}
        onClick={onNew}
        sx={(t) => ({ mb: 1, minHeight: t.spacing(7.375), borderColor: 'primary.outlinedBorder' })}
      >
        {newLabel}
      </Button>
      <Box
        component="ul"
        sx={(t) => ({
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          [t.breakpoints.up('lg')]: { flexDirection: 'column', flexWrap: 'nowrap', gap: 0.5 },
        })}
      >
        {creating ? row('new', newTitle, true) : null}
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
