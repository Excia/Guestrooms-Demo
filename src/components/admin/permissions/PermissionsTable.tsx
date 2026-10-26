import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import type { ReactNode } from 'react';
import {
  ACCESS_LEVEL_LABEL,
  ADMIN_SETUP_OPTIONS,
  adminSetupDisplay,
  CHECK_IN_OPTIONS,
  PERMISSION_ROWS,
  rowIsNotApplicable,
  SETUP_LEVEL_LABEL,
  updateSet,
  withAccessLevel,
  withAdminSetup,
  withCheckIn,
  withFunction,
  type AccessLevel,
  type AdminSetupLevel,
  type CheckInSetting,
  type PermissionRow,
  type PermissionSet,
} from '../../../app/permissionSets';
import CellSelect from '../bookingRules/CellSelect';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export const permissionCellId = (setId: string, key: string) => `permissions-${setId}-${key}`;

export interface PermissionsTableProps {
  sets: readonly PermissionSet[];
  onChange: (sets: PermissionSet[]) => void;
}

// The legacy Permissions table (PermissionsEdit.vue): a blank corner and one column per set
// (Management, Staff), then one row each for Admin Setup, the Access sets and, indented under the
// area they belong to, the Function sets. No sections and no per-page rows.
export default function PermissionsTable({ sets, onChange }: PermissionsTableProps) {
  const edit = (setId: string, change: (set: PermissionSet) => PermissionSet) =>
    onChange(updateSet(sets, setId, change));

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

  const permissionRow = (row: PermissionRow) => {
    const key = row.kind === 'checkIn' ? 'checkIn' : row.key;
    return (
      <TableRow key={key}>
        {rowHead(row.label, 'hint' in row ? row.hint : undefined, row.kind !== 'access')}
        {sets.map((set) => {
          if (rowIsNotApplicable(set, row)) return na(set.id);
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
            <TableCell sx={{ bgcolor: 'background.paper', border: 0 }}>
              <Box component="span" sx={visuallyHidden}>
                Permission
              </Box>
            </TableCell>
            {sets.map((set) => (
              <TableCell
                key={set.id}
                scope="col"
                sx={{ bgcolor: 'background.paper', fontWeight: 'bold', border: 0 }}
              >
                <Typography variant="h4_fixed" component="span">
                  {set.name}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            {rowHead('Admin Setup')}
            {sets.map((set) =>
              cell(
                set.id,
                <CellSelect<AdminSetupLevel | 'mixed'>
                  id={permissionCellId(set.id, 'adminSetup')}
                  ariaLabel={`Admin Setup, ${set.name}`}
                  value={adminSetupDisplay(set)}
                  options={[
                    ...ADMIN_SETUP_OPTIONS.map((value) => ({
                      value,
                      label: SETUP_LEVEL_LABEL[value],
                    })),
                    // Shown only while stored per-page levels differ; choosing View or No Access fixes it.
                    ...(adminSetupDisplay(set) === 'mixed'
                      ? [{ value: 'mixed' as const, label: 'Mixed (per page)', disabled: true }]
                      : []),
                  ]}
                  onChange={(level) =>
                    level !== 'mixed' && edit(set.id, (s) => withAdminSetup(s, level))
                  }
                />,
              ),
            )}
          </TableRow>
          {PERMISSION_ROWS.map(permissionRow)}
        </TableBody>
      </Table>
    </Box>
  );
}
