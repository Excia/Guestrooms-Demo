import EditOnly from '../EditOnly';
import AddCircle from '@mui/icons-material/AddCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import type { BookingRules, BookingRulesOptions, MemberTypeRule } from '../../../api/types';
import { newMemberTypeRule, type BookingRulesErrors } from '../../../app/bookingRules';
import RemoveIconButton from '../../shared/RemoveIconButton';
import CellSelect from './CellSelect';
import PeriodField from './PeriodField';
import RoomTypesField from './RoomTypesField';
import { UNIQUE_RULES_ID } from './RulesMatrix';

export const memberTypeCellId = (ruleId: string, field: string) =>
  `booking-rules-memberType-${ruleId}-${field}`;

export interface MemberTypeRulesTableProps {
  rules: BookingRules;
  onChange: (next: BookingRules) => void;
  errors: BookingRulesErrors;
  options: BookingRulesOptions;
  /** Makes ids for new rows (the page owns the counter). */
  nextId: () => string;
}

const cellSx = (t: import('@mui/material/styles').Theme) => ({
  border: `1px solid ${t.palette.divider}`,
  px: 2,
  py: 1.5,
  verticalAlign: 'middle',
});

// Unique Member Type Rules (Figma 15957:83735): rows that override the member default for one
// member type. Shown only while the checkbox in the Member Online Booking column is ticked.
export default function MemberTypeRulesTable({
  rules,
  onChange,
  errors,
  options,
  nextId,
}: MemberTypeRulesTableProps) {
  const setRow = (id: string, patch: Partial<MemberTypeRule>) =>
    onChange({
      ...rules,
      memberTypeRules: rules.memberTypeRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  const used = new Set(rules.memberTypeRules.map((r) => r.memberTypeId));
  const typeLabel = (r: MemberTypeRule) =>
    options.memberTypes.find((m) => m.id === r.memberTypeId)?.label ?? 'new member type';
  return (
    <Box component="section" aria-labelledby={UNIQUE_RULES_ID} sx={{ mt: 4 }}>
      <Typography
        id={UNIQUE_RULES_ID}
        variant="h4_fixed"
        component="h2"
        tabIndex={-1}
        sx={{ mb: 1 }}
      >
        Unique Member Type Rules
      </Typography>
      <Table
        aria-label="Unique member type rules"
        sx={{ tableLayout: 'fixed', minWidth: (t) => t.spacing(120), borderCollapse: 'collapse' }}
      >
        <TableHead>
          <TableRow>
            {[
              'Member Type',
              'Exclude from Online Booking',
              'Excluded Room Types',
              'Booking Opens',
              'Booking Closes',
            ].map((h) => (
              <TableCell key={h} scope="col" sx={(t) => ({ ...cellSx(t), fontWeight: 'bold' })}>
                {h}
              </TableCell>
            ))}
            <TableCell scope="col" sx={(t) => ({ ...cellSx(t), width: (u) => u.spacing(7) })}>
              <Box component="span" sx={visuallyHidden}>
                Remove
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.memberTypeRules.map((row) => {
            const typeError = errors[`memberType.${row.id}.memberTypeId`];
            const excluded = row.excludeFromOnlineBooking;
            const label = typeLabel(row);
            return (
              <TableRow key={row.id}>
                <TableCell sx={cellSx}>
                  <CellSelect<string>
                    id={memberTypeCellId(row.id, 'memberTypeId')}
                    ariaLabel={`Member type, ${label}`}
                    value={row.memberTypeId ?? ''}
                    options={options.memberTypes.map((m) => ({
                      value: m.id,
                      label: m.label,
                      disabled: used.has(m.id) && m.id !== row.memberTypeId,
                    }))}
                    onChange={(memberTypeId) => setRow(row.id, { memberTypeId })}
                    error={Boolean(typeError)}
                    describedBy={
                      typeError ? `${memberTypeCellId(row.id, 'memberTypeId')}-error` : undefined
                    }
                  />
                  {typeError ? (
                    <FormHelperText id={`${memberTypeCellId(row.id, 'memberTypeId')}-error`} error>
                      {typeError}
                    </FormHelperText>
                  ) : null}
                </TableCell>
                <TableCell align="center" sx={cellSx}>
                  <Checkbox
                    checked={excluded}
                    onChange={(e) => setRow(row.id, { excludeFromOnlineBooking: e.target.checked })}
                    slotProps={{ input: { 'aria-label': `Exclude ${label} from online booking` } }}
                  />
                </TableCell>
                <TableCell sx={cellSx}>
                  <RoomTypesField
                    id={memberTypeCellId(row.id, 'excludedRoomTypeIds')}
                    label={`Excluded room types, ${label}`}
                    options={options.roomTypes}
                    value={row.excludedRoomTypeIds}
                    onChange={(excludedRoomTypeIds) => setRow(row.id, { excludedRoomTypeIds })}
                    disabled={excluded}
                  />
                </TableCell>
                <TableCell sx={cellSx}>
                  <PeriodField
                    id={memberTypeCellId(row.id, 'opens')}
                    label={`Booking opens, ${label}`}
                    value={row.opens}
                    onChange={(opens) => opens && setRow(row.id, { opens })}
                    disabled={excluded}
                    error={errors[`memberType.${row.id}.opens`]}
                  />
                </TableCell>
                <TableCell sx={cellSx}>
                  <PeriodField
                    id={memberTypeCellId(row.id, 'closes')}
                    label={`Booking closes, ${label}`}
                    value={row.closes}
                    onChange={(closes) => setRow(row.id, { closes })}
                    allowNone
                    disabled={excluded}
                    error={errors[`memberType.${row.id}.closes`]}
                  />
                </TableCell>
                <TableCell align="center" sx={cellSx}>
                  <RemoveIconButton
                    label={`rule for ${label}`}
                    onClick={() =>
                      onChange({
                        ...rules,
                        memberTypeRules: rules.memberTypeRules.filter((r) => r.id !== row.id),
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <EditOnly>
        <Button
          startIcon={<AddCircle />}
          onClick={() =>
            onChange({
              ...rules,
              memberTypeRules: [...rules.memberTypeRules, newMemberTypeRule(nextId())],
            })
          }
          sx={{ mt: 1 }}
        >
          Add Member Type
        </Button>
      </EditOnly>
    </Box>
  );
}
