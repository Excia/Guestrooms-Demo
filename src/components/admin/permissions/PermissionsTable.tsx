import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import type { ReactNode } from 'react';
import { ADMIN_PAGE_IDS } from '../../../app/permissions';
import {
  ACCESS_LEVEL_LABEL,
  CHECK_IN_OPTIONS,
  PERMISSION_ROWS,
  rowApplies,
  SETUP_LEVEL_LABEL,
  SETUP_LEVELS,
  SETUP_PAGE_LABEL,
  setupLevel,
  updateSet,
  withAccessLevel,
  withCheckIn,
  withFunction,
  withPinOverride,
  withSetupLevel,
  type AccessLevel,
  type CheckInSetting,
  type PermissionRow,
  type PermissionSet,
  type SetupLevel,
} from '../../../app/permissionSets';
import { routes } from '../../../app/routes';
import CellSelect from '../bookingRules/CellSelect';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

const pageTitle = (id: string) =>
  SETUP_PAGE_LABEL[id] ?? routes.find((r) => r.id === id)?.title ?? id;

export const permissionCellId = (setId: string, key: string) => `permissions-${setId}-${key}`;

export interface PermissionsTableProps {
  sets: readonly PermissionSet[];
  onChange: (sets: PermissionSet[]) => void;
}

const headCell = {
  bgcolor: 'background.paper',
  fontWeight: 'bold',
} as const;

// Permissions table (Admin Setup): one column per editable set, rows grouped as the legacy screen
// has them. Admin Setup pages first (No Access / View / Edit), then the Access sets with their
// Function sets indented under the area they belong to, then the PIN override row.
export default function PermissionsTable({ sets, onChange }: PermissionsTableProps) {
  const edit = (setId: string, change: (set: PermissionSet) => PermissionSet) =>
    onChange(updateSet(sets, setId, change));

  const section = (title: string, id: string) => (
    <TableRow>
      <TableCell
        id={id}
        component="th"
        scope="colgroup"
        colSpan={sets.length + 1}
        sx={(t) => ({
          bgcolor: 'action.hover',
          borderBottom: `1px solid ${t.palette.divider}`,
          py: 1,
        })}
      >
        <Typography variant="subtitle2" component="span">
          {title}
        </Typography>
      </TableCell>
    </TableRow>
  );

  const rowHead = (label: string, hint?: string, indent = false) => (
    <TableCell
      component="th"
      scope="row"
      sx={(t) => ({
        fontWeight: indent ? 'normal' : 'bold',
        pl: indent ? 4 : 2,
        borderBottom: `1px solid ${t.palette.divider}`,
        width: t.spacing(45),
      })}
    >
      <Typography component="span" sx={{ display: 'block', fontWeight: 'inherit' }}>
        {label}
      </Typography>
      {hint ? (
        <Typography
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          {hint}
        </Typography>
      ) : null}
    </TableCell>
  );

  const cell = (setId: string, content: ReactNode) => (
    <TableCell
      key={setId}
      sx={(t) => ({ borderBottom: `1px solid ${t.palette.divider}`, minWidth: t.spacing(24) })}
    >
      {content}
    </TableCell>
  );

  const na = (setId: string) => (
    <TableCell
      key={setId}
      align="center"
      sx={(t) => ({
        bgcolor: 'action.disabledBackground',
        borderBottom: `1px solid ${t.palette.divider}`,
      })}
    >
      N/A
    </TableCell>
  );

  const setupRow = (pageId: string) => (
    <TableRow key={`setup-${pageId}`}>
      {rowHead(pageTitle(pageId), undefined, true)}
      {sets.map((set) =>
        cell(
          set.id,
          <CellSelect<SetupLevel>
            id={permissionCellId(set.id, `setup-${pageId}`)}
            ariaLabel={`${pageTitle(pageId)}, ${set.name}`}
            value={setupLevel(set, pageId)}
            options={SETUP_LEVELS.map((value) => ({ value, label: SETUP_LEVEL_LABEL[value] }))}
            onChange={(level) => edit(set.id, (s) => withSetupLevel(s, pageId, level))}
          />,
        ),
      )}
    </TableRow>
  );

  const permissionRow = (row: PermissionRow) => {
    const key = row.kind === 'checkIn' ? 'checkIn' : row.key;
    const indent = row.kind !== 'access';
    return (
      <TableRow key={key}>
        {rowHead(row.label, 'hint' in row ? row.hint : undefined, indent)}
        {sets.map((set) => {
          if (!rowApplies(set, row)) return na(set.id);
          const id = permissionCellId(set.id, key);
          const ariaLabel = `${row.label}, ${set.name}`;
          if (row.kind === 'access') {
            return cell(
              set.id,
              <CellSelect<AccessLevel>
                id={id}
                ariaLabel={ariaLabel}
                value={set.access[row.key]}
                options={row.levels.map((value) => ({ value, label: ACCESS_LEVEL_LABEL[value] }))}
                onChange={(level) => edit(set.id, (s) => withAccessLevel(s, row.key, level))}
              />,
            );
          }
          if (row.kind === 'checkIn') {
            return cell(
              set.id,
              <CellSelect<CheckInSetting>
                id={id}
                ariaLabel={ariaLabel}
                value={set.checkIn}
                options={CHECK_IN_OPTIONS.map((o) => ({ ...o }))}
                onChange={(value) => edit(set.id, (s) => withCheckIn(s, value))}
              />,
            );
          }
          return cell(
            set.id,
            <CellSelect<'yes' | 'no'>
              id={id}
              ariaLabel={ariaLabel}
              value={set.functions[row.key] ? 'yes' : 'no'}
              options={YES_NO.map((o) => ({ ...o }))}
              onChange={(value) => edit(set.id, (s) => withFunction(s, row.key, value === 'yes'))}
            />,
          );
        })}
      </TableRow>
    );
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table aria-label="Permission sets" sx={{ tableLayout: 'auto', borderCollapse: 'collapse' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headCell, border: 0 }}>
              <Box component="span" sx={visuallyHidden}>
                Permission
              </Box>
            </TableCell>
            {sets.map((set) => (
              <TableCell key={set.id} scope="col" sx={{ ...headCell, border: 0 }}>
                <Typography variant="h4_fixed" component="span">
                  {set.name}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {section('Admin Setup', 'permissions-section-setup')}
          {ADMIN_PAGE_IDS.map(setupRow)}
          {section('Access Sets and Function Sets', 'permissions-section-access')}
          {PERMISSION_ROWS.map(permissionRow)}
          {section('PIN Override', 'permissions-section-pin')}
          <TableRow>
            {rowHead(
              'Authorize Overrides with PIN',
              'May enter a PIN to let another employee do what they are not allowed to',
            )}
            {sets.map((set) =>
              cell(
                set.id,
                <CellSelect<'yes' | 'no'>
                  id={permissionCellId(set.id, 'pinOverride')}
                  ariaLabel={`Authorize Overrides with PIN, ${set.name}`}
                  value={set.pinOverride ? 'yes' : 'no'}
                  options={YES_NO.map((o) => ({ ...o }))}
                  onChange={(value) => edit(set.id, (s) => withPinOverride(s, value === 'yes'))}
                />,
              ),
            )}
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}
