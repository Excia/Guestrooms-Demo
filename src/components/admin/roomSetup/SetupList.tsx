import Add from '@mui/icons-material/Add';
import ContentCopy from '@mui/icons-material/ContentCopyOutlined';
import Delete from '@mui/icons-material/Delete';
import History from '@mui/icons-material/History';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { visuallyHidden } from '@mui/utils';
import { useRef, useState } from 'react';
import type { ChangeLogPageId } from '../../../api/changeLogTypes';
import { useReadOnly } from '../../../app/readOnlyContext';
import { setupMoreMenuLabels, showsMoreMenu } from '../../../app/setupMoreMenu';
import ReorderIcon from '../../shared/ReorderIcon';
import ChangeLogOverlay from '../changeLog/ChangeLogOverlay';

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

export interface SetupMoreMenu {
  /** Title-case item name: "Room", "Room Type", "Add-On", "Rate Category". */
  noun: string;
  changeLogPage: ChangeLogPageId;
  /** Omitted where copying makes no sense (Employees): the Copy item is left out. */
  onCopy?: () => void;
  onDelete: () => void;
  /** Replaces "Delete <noun>" (Employees: "Remove Employee"). */
  deleteLabel?: string;
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
  /** The three-dot menu (Change Log, Copy, Delete) of the selected active row. */
  more?: SetupMoreMenu;
  /** False hides the New button (a view-only user, Employees). */
  canCreate?: boolean;
  /** An icon button next to the New button (Rooms: reorder). */
  reorder?: { label: string; onClick: () => void };
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
  creating: creatingProp,
  onSelect,
  onNew,
  singleNewRow = false,
  canCreate = true,
  more,
  reorder,
}: SetupListProps) {
  // View-only: no New, no reorder, and the three-dot menu keeps only the Change Log.
  const readOnly = useReadOnly();
  // Nothing can be created in View-only mode, so no unsaved "New" row either.
  const creating = creatingProp && !readOnly;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  // The item whose log is open, fixed when the menu item is chosen (the selection can change behind the dialog).
  const [logRecord, setLogRecord] = useState<{ id: string; name: string } | undefined>();
  // A new key on every opening gives the dialog fresh sort, filters, page and rows (D-97-5).
  const [logSession, setLogSession] = useState(0);
  const closeMenu = () => setMenuAnchor(null);
  const onCopy = more?.onCopy;
  // Copy and Delete open a dialog (or switch the selection). They run after the menu has finished
  // closing, so the menu hands focus back to its button first and the dialog returns focus there.
  const afterMenu = useRef<(() => void) | null>(null);
  const chooseAfterClose = (action: () => void) => {
    afterMenu.current = action;
    closeMenu();
  };
  const row = (
    key: string,
    label: string,
    selected: boolean,
    onClick?: () => void,
    inactive?: boolean,
    isNew?: boolean,
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
          // Room for the three-dot button on the selected row.
          ...(more && showsMoreMenu({ selected, inactive, isNew }) ? { pr: t.spacing(6) } : {}),
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
              variant={selected ? 'filled' : 'outlined'}
              color="error"
              label="Inactive"
              sx={(t) => ({
                ml: 'auto',
                textTransform: 'none',
                flexShrink: 0,
                fontWeight: 'bold',
                // Unselected: red outline on white. Selected (green row): a white chip with dark
                // text, which keeps AA contrast where red on green does not.
                bgcolor: 'background.paper',
                ...(selected ? { color: 'text.primary', borderColor: 'background.paper' } : {}),
                pointerEvents: 'none',
                height: t.spacing(2.75),
                '& .MuiChip-label': { px: 1 },
              })}
            />
          </>
        ) : null}
      </Button>
      {more && showsMoreMenu({ selected, inactive, isNew }) ? (
        <IconButton
          aria-label={setupMoreMenuLabels(more.noun, label).button}
          aria-haspopup="menu"
          aria-expanded={menuAnchor ? 'true' : undefined}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={(t) => ({
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            right: t.spacing(0.5),
            color: 'primary.contrastText',
            '&.Mui-focusVisible': {
              outline: `2px solid ${t.palette.primary.contrastText}`,
              outlineOffset: -2,
            },
            [t.breakpoints.up('lg')]: { right: t.spacing(2.375) },
          })}
        >
          <MoreHoriz />
        </IconButton>
      ) : null}
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
    readOnly ? null : creating ? (
      row('new', newTitle, true, undefined, false, true)
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
      {singleNewRow || readOnly || !canCreate ? null : (
        <Box
          sx={(t) => ({
            display: 'flex',
            gap: 1,
            mb: 1.25,
            [t.breakpoints.up('lg')]: { mr: t.spacing(1.875) },
          })}
        >
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<Add />}
            onClick={onNew}
            sx={(t) => ({
              minHeight: t.spacing(7.375),
              borderColor: 'primary.outlinedBorder',
              minWidth: 0,
              // One line, next to the reorder button.
              whiteSpace: 'nowrap',
              px: 1.25,
              '& .MuiButton-startIcon': { mr: 0.5 },
            })}
          >
            {newLabel}
          </Button>
          {reorder ? (
            <IconButton
              aria-label={reorder.label}
              onClick={reorder.onClick}
              color="primary"
              sx={(t) => ({
                flexShrink: 0,
                alignSelf: 'center',
                p: 1,
                '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}` },
              })}
            >
              <ReorderIcon />
            </IconButton>
          ) : null}
        </Box>
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
        {singleNewRow
          ? addRow()
          : creating
            ? row('new', newTitle, true, undefined, false, true)
            : null}
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
      {more ? (
        <>
          <Menu
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={closeMenu}
            slotProps={{
              transition: {
                onExited: () => {
                  const action = afterMenu.current;
                  afterMenu.current = null;
                  action?.();
                },
              },
              list: { 'aria-label': setupMoreMenuLabels(more.noun, '').menu },
            }}
          >
            <MenuItem
              onClick={() => {
                const selectedItem = items.find((i) => i.id === selectedId);
                // The menu only exists on a selected item; never fall back to the page-wide log.
                if (!selectedItem) {
                  closeMenu();
                  return;
                }
                chooseAfterClose(() => {
                  setLogRecord({ id: selectedItem.id, name: selectedItem.label });
                  setLogSession((n) => n + 1);
                  setLogOpen(true);
                });
              }}
            >
              <ListItemIcon>
                <History />
              </ListItemIcon>
              <ListItemText>{setupMoreMenuLabels(more.noun, '').changeLog}</ListItemText>
            </MenuItem>
            {onCopy && !readOnly ? (
              <MenuItem
                onClick={() => {
                  chooseAfterClose(onCopy);
                }}
              >
                <ListItemIcon>
                  <ContentCopy color="primary" />
                </ListItemIcon>
                <ListItemText>{setupMoreMenuLabels(more.noun, '').copy}</ListItemText>
              </MenuItem>
            ) : null}
            {readOnly ? null : (
              <MenuItem
                onClick={() => {
                  chooseAfterClose(more.onDelete);
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <Delete color="error" />
                </ListItemIcon>
                <ListItemText>
                  {more.deleteLabel ?? setupMoreMenuLabels(more.noun, '').delete}
                </ListItemText>
              </MenuItem>
            )}
          </Menu>
          <ChangeLogOverlay
            key={logSession}
            page={more.changeLogPage}
            record={logRecord}
            open={logOpen}
            onClose={() => setLogOpen(false)}
          />
        </>
      ) : null}
    </Box>
  );
}
