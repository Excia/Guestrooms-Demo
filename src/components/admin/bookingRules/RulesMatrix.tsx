import { useReadOnly } from '../../../app/readOnlyContext';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Link from '@mui/material/Link';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useState, type ReactNode } from 'react';
import type {
  AudienceRules,
  BookingRules,
  BookingRulesOptions,
  ContactRequirement,
  NamedOccupants,
  DepositType,
  PaymentRequirement,
  RoomSelection,
} from '../../../api/types';
import {
  setUniqueMemberTypeRules,
  toggleColumn,
  withDepositType,
  withPayment,
  type Audience,
  type BookingRulesErrors,
} from '../../../app/bookingRules';
import CellSelect from './CellSelect';
import { cellSx, matrixTableSx, notApplicableSx } from './matrixStyles';
import PeriodField from './PeriodField';
import RoomTypesField from './RoomTypesField';

export const UNIQUE_RULES_ID = 'booking-rules-unique-member-type-rules';
export const cellId = (audience: Audience, field: string) => `booking-rules-${audience}-${field}`;

const COLUMNS: { audience: Audience; label: string }[] = [
  { audience: 'employee', label: 'Admin Booking' },
  { audience: 'member', label: 'Member Online Booking' },
  { audience: 'nonMember', label: 'Non-Member Online Booking' },
];

const NAMED: { value: NamedOccupants; label: string }[] = [
  { value: 'all', label: 'All Occupants' },
  { value: 'lead', label: 'Lead Occupant Only' },
  { value: 'none', label: 'None (Reserver must be named)' },
];
const CONTACT: { value: ContactRequirement; label: string }[] = [
  { value: 'email', label: 'Email Only' },
  { value: 'phone', label: 'Phone Only' },
  { value: 'email-and-phone', label: 'Email and Phone' },
  { value: 'email-or-phone', label: 'Email OR Phone' },
];
const PAYMENT: { value: PaymentRequirement; label: string }[] = [
  { value: 'optional', label: 'Optional' },
  { value: 'on-file', label: 'Payment on File Required' },
  { value: 'deposit', label: 'Deposit Required' },
  { value: 'prepayment', label: 'Prepayment Required' },
];
const ROOM_SELECTION: { value: RoomSelection; label: string }[] = [
  { value: 'room-optional', label: 'Room Optional' },
  { value: 'room-only', label: 'Room Only' },
  { value: 'room-type-only', label: 'Room Type Only' },
];

interface Ctx {
  audience: Audience;
  columnLabel: string;
  /** Null while the column is switched off: its cells are cleared and disabled. */
  col: AudienceRules | null;
  set: (patch: Partial<AudienceRules>) => void;
  errors: BookingRulesErrors;
  options: BookingRulesOptions;
  /** View-only: every direct field is disabled, whatever the column state. */
  readOnly: boolean;
}

type Cell = ReactNode | 'na';

interface RowDef {
  id: string;
  label: string;
  hint?: string;
  cell: (ctx: Ctx, rowLabel: string) => Cell;
}

const name = (ctx: Ctx, row: string) => `${row}, ${ctx.columnLabel}`;
const err = (
  ctx: Ctx,
  field: 'opens' | 'closes' | 'holdMinutes' | 'deposit' | 'maxRoomsPerReservation',
) => ctx.errors[`${ctx.audience}.${field}`];

function NumberCell({
  ctx,
  field,
  row,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  ctx: Ctx;
  field: 'holdMinutes' | 'maxRoomsPerReservation';
  row: string;
  value: number | undefined;
  min: number;
  max: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  const message = err(ctx, field);
  const id = cellId(ctx.audience, field);
  const readOnly = useReadOnly();
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TextField
          id={id}
          type="number"
          variant="standard"
          size="small"
          value={value ? String(value) : ''}
          disabled={!ctx.col || readOnly}
          error={Boolean(message)}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          slotProps={{
            htmlInput: {
              min,
              max,
              'aria-label': name(ctx, row),
              'aria-describedby': message ? `${id}-error` : undefined,
            },
          }}
          sx={{ width: (t) => t.spacing(12) }}
        />
        {suffix ? <Typography variant="body2">{suffix}</Typography> : null}
      </Box>
      {message ? (
        <FormHelperText id={`${id}-error`} error>
          {message}
        </FormHelperText>
      ) : null}
    </Box>
  );
}

const toText = (type: DepositType, value: number | null) =>
  value === null ? '' : String(type === 'percent' ? value : value / 100);

/** Parses what was typed; null for an empty box, undefined for text that is not a number yet. */
function parseDeposit(type: DepositType, text: string): number | null | undefined {
  if (text === '') return null;
  if (!/^\d*\.?\d{0,2}$/.test(text) || text === '.') return undefined;
  const n = Number(text);
  return type === 'percent' ? n : Math.round(n * 100);
}

// Keeps what the person typed ("1.", "12.50") while the stored value is the parsed number.
function DepositField({
  id,
  type,
  value,
  message,
  ariaLabelSuffix,
  onChange,
}: {
  id: string;
  type: DepositType;
  value: number | null;
  message: string | undefined;
  ariaLabelSuffix: string;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(toText(type, value));
  // Follow outside changes (type switch, reload) but not our own commits.
  if (parseDeposit(type, draft) !== value && !(draft === '.' && value === null)) {
    setDraft(toText(type, value));
  }
  const percent = type === 'percent';
  const label = percent ? 'Percent of stay' : 'Amount';
  return (
    <TextField
      id={id}
      label={label}
      size="small"
      value={draft}
      error={Boolean(message)}
      helperText={message}
      onChange={(e) => {
        const parsed = parseDeposit(type, e.target.value);
        if (parsed === undefined) return;
        setDraft(e.target.value);
        onChange(parsed);
      }}
      onBlur={() => setDraft(toText(type, value))}
      slotProps={{
        inputLabel: { shrink: true },
        input: percent
          ? { endAdornment: <InputAdornment position="end">%</InputAdornment> }
          : { startAdornment: <InputAdornment position="start">$</InputAdornment> },
        htmlInput: {
          inputMode: 'decimal',
          'aria-label': `${label}, ${ariaLabelSuffix}`,
          'aria-describedby': message ? `${id}-helper-text` : undefined,
        },
      }}
      sx={{ width: (t) => t.spacing(16) }}
    />
  );
}

const ROWS: RowDef[] = [
  {
    id: 'requireMemberReserver',
    label: 'Require Member Reserver',
    hint: 'non-member occupants must have a member reserver',
    cell: (ctx, row) =>
      ctx.col && ctx.col.requireMemberReserver === null ? (
        'na'
      ) : ctx.audience === 'nonMember' && ctx.col === null ? (
        <Checkbox disabled slotProps={{ input: { 'aria-label': name(ctx, row) } }} />
      ) : (
        <Checkbox
          id={cellId(ctx.audience, 'requireMemberReserver')}
          checked={Boolean(ctx.col?.requireMemberReserver)}
          disabled={!ctx.col || ctx.readOnly}
          onChange={(e) => ctx.set({ requireMemberReserver: e.target.checked })}
          slotProps={{ input: { 'aria-label': name(ctx, row) } }}
        />
      ),
  },
  {
    id: 'namedOccupants',
    label: 'Required Named Occupants',
    hint: 'Named occupants cannot be set to TBD',
    cell: (ctx, row) => (
      <CellSelect<NamedOccupants>
        id={cellId(ctx.audience, 'namedOccupants')}
        ariaLabel={name(ctx, row)}
        label="Require Name for:"
        value={ctx.col?.namedOccupants ?? ''}
        options={NAMED}
        onChange={(namedOccupants) => ctx.set({ namedOccupants })}
        disabled={!ctx.col}
      />
    ),
  },
  {
    id: 'contactInfo',
    label: 'Require Contact Information',
    cell: (ctx, row) => (
      <CellSelect<ContactRequirement>
        id={cellId(ctx.audience, 'contactInfo')}
        ariaLabel={name(ctx, row)}
        value={ctx.col?.contactInfo ?? ''}
        options={CONTACT}
        onChange={(contactInfo) => ctx.set({ contactInfo })}
        disabled={!ctx.col}
      />
    ),
  },
  {
    id: 'opens',
    label: 'Booking Opens',
    hint: 'Time prior to check in',
    cell: (ctx, row) => (
      <PeriodField
        id={cellId(ctx.audience, 'opens')}
        label={name(ctx, row)}
        value={ctx.col?.opens ?? null}
        onChange={(opens) => opens && ctx.set({ opens })}
        disabled={!ctx.col}
        error={err(ctx, 'opens')}
      />
    ),
  },
  {
    id: 'closes',
    label: 'Booking Closes',
    hint: 'Time prior to check in',
    cell: (ctx, row) => (
      <PeriodField
        id={cellId(ctx.audience, 'closes')}
        label={name(ctx, row)}
        value={ctx.col?.closes ?? null}
        onChange={(closes) => ctx.set({ closes })}
        allowNone
        disabled={!ctx.col}
        error={err(ctx, 'closes')}
      />
    ),
  },
  {
    id: 'cancellation',
    label: 'Cancellation Period',
    hint: 'Time prior to check in',
    cell: (ctx, row) => (
      <PeriodField
        id={cellId(ctx.audience, 'cancellation')}
        label={name(ctx, row)}
        value={ctx.col?.cancellation ?? null}
        onChange={(cancellation) => ctx.set({ cancellation })}
        allowNone
        disabled={!ctx.col}
      />
    ),
  },
  {
    id: 'holdMinutes',
    label: 'Reservation Hold',
    hint: 'once selected, hold reservation slot for X minutes',
    cell: (ctx, row) => (
      <NumberCell
        ctx={ctx}
        field="holdMinutes"
        row={row}
        value={ctx.col?.holdMinutes}
        min={1}
        max={99}
        suffix="Minutes"
        onChange={(holdMinutes) => ctx.set({ holdMinutes })}
      />
    ),
  },
  {
    id: 'payment',
    label: 'Payment Method at Booking',
    cell: (ctx, row) => {
      const message = err(ctx, 'deposit');
      const type = ctx.col?.depositType ?? 'amount';
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <CellSelect<PaymentRequirement>
            id={cellId(ctx.audience, 'payment')}
            ariaLabel={name(ctx, row)}
            value={ctx.col?.payment ?? ''}
            options={PAYMENT}
            onChange={(payment) => ctx.col && ctx.set(withPayment(ctx.col, payment))}
            disabled={!ctx.col}
          />
          {ctx.col?.payment === 'deposit' ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                color="primary"
                value={type}
                aria-label={`${name(ctx, row)} deposit type`}
                onChange={(_, next: DepositType | null) =>
                  next && ctx.col && ctx.set(withDepositType(ctx.col, next))
                }
              >
                <ToggleButton value="amount" aria-label="$ dollar amount">
                  $
                </ToggleButton>
                <ToggleButton value="percent" aria-label="% percentage of the total stay">
                  %
                </ToggleButton>
              </ToggleButtonGroup>
              <DepositField
                id={cellId(ctx.audience, 'deposit')}
                type={type}
                value={ctx.col.depositValue}
                message={message}
                ariaLabelSuffix={name(ctx, row)}
                onChange={(depositValue) => ctx.set({ depositType: type, depositValue })}
              />
            </Box>
          ) : null}
        </Box>
      );
    },
  },
  {
    id: 'roomSelection',
    label: 'Room Selection',
    cell: (ctx, row) => (
      <CellSelect<RoomSelection>
        id={cellId(ctx.audience, 'roomSelection')}
        ariaLabel={name(ctx, row)}
        value={ctx.col?.roomSelection ?? ''}
        options={ROOM_SELECTION}
        onChange={(roomSelection) => ctx.set({ roomSelection })}
        disabled={!ctx.col}
      />
    ),
  },
  {
    id: 'excludedRoomTypes',
    label: 'Excluded Room Types',
    cell: (ctx, row) =>
      ctx.audience === 'employee' ? (
        'na'
      ) : (
        <RoomTypesField
          id={cellId(ctx.audience, 'excludedRoomTypeIds')}
          label={name(ctx, row)}
          options={ctx.options.roomTypes}
          value={ctx.col?.excludedRoomTypeIds ?? []}
          onChange={(excludedRoomTypeIds) => ctx.set({ excludedRoomTypeIds })}
          disabled={!ctx.col}
        />
      ),
  },
  {
    id: 'maxRooms',
    label: 'Max. Rooms per Reservation',
    cell: (ctx, row) => (
      <NumberCell
        ctx={ctx}
        field="maxRoomsPerReservation"
        row={row}
        value={ctx.col?.maxRoomsPerReservation}
        min={1}
        max={99}
        onChange={(maxRoomsPerReservation) => ctx.set({ maxRoomsPerReservation })}
      />
    ),
  },
  {
    id: 'addOnPopup',
    label: 'Display Add-On Popup',
    hint: 'displays add-on popup after room select (online only)',
    cell: (ctx, row) =>
      ctx.audience === 'employee' ? (
        'na'
      ) : (
        <Checkbox
          id={cellId(ctx.audience, 'addOnPopup')}
          checked={Boolean(ctx.col?.addOnPopup)}
          disabled={!ctx.col || ctx.readOnly}
          onChange={(e) => ctx.set({ addOnPopup: e.target.checked })}
          slotProps={{ input: { 'aria-label': name(ctx, row) } }}
        />
      ),
  },
];

export interface RulesMatrixProps {
  rules: BookingRules;
  onChange: (next: BookingRules) => void;
  errors: BookingRulesErrors;
  options: BookingRulesOptions;
}

// The rules matrix (Figma 15957:83580): one row per rule, one column per audience. The rows are
// data (`ROWS`); an "N/A" cell is a gray cell, a switched-off column shows cleared, disabled cells.
export default function RulesMatrix({ rules, onChange, errors, options }: RulesMatrixProps) {
  const column = (audience: Audience) => rules[audience];
  const setColumn = (audience: Audience, patch: Partial<AudienceRules>) => {
    const current = column(audience);
    if (current) onChange({ ...rules, [audience]: { ...current, ...patch } });
  };
  const memberOn = rules.member !== null;
  const readOnly = useReadOnly();
  return (
    <Table
      aria-label="Booking rules"
      sx={matrixTableSx}
    >
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: (t) => t.spacing(27.5), border: 0 }}>
            <Box component="span" sx={visuallyHidden}>
              Rule
            </Box>
          </TableCell>
          <TableCell scope="col" sx={(t) => ({ ...cellSx(t), verticalAlign: 'top' })}>
            <Typography variant="h4_fixed" component="span">
              Admin Booking
            </Typography>
          </TableCell>
          <TableCell scope="col" sx={(t) => ({ ...cellSx(t), verticalAlign: 'top' })}>
            <FormControlLabel
              label={
                <Typography variant="h4_fixed" component="span">
                  Member Online Booking
                </Typography>
              }
              control={
                <Switch
                  id="booking-rules-member-toggle"
                  checked={memberOn}
                  onChange={(e) => onChange(toggleColumn(rules, 'memberOnline', e.target.checked))}
                />
              }
            />
            <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
              <Checkbox
                id="booking-rules-unique-toggle"
                checked={memberOn && rules.uniqueMemberTypeRules}
                disabled={!memberOn || readOnly}
                onChange={(e) => onChange(setUniqueMemberTypeRules(rules, e.target.checked))}
                slotProps={{ input: { 'aria-label': 'Unique Member Type Rules' } }}
              />
              <Link href={`#${UNIQUE_RULES_ID}`} underline="always" color="inherit">
                Unique Member Type Rules
              </Link>
            </Box>
          </TableCell>
          <TableCell scope="col" sx={(t) => ({ ...cellSx(t), verticalAlign: 'top' })}>
            <FormControlLabel
              label={
                <Typography variant="h4_fixed" component="span">
                  Non-Member Online Booking
                </Typography>
              }
              control={
                <Switch
                  id="booking-rules-nonmember-toggle"
                  checked={rules.nonMember !== null}
                  disabled={!memberOn || readOnly}
                  onChange={(e) =>
                    onChange(toggleColumn(rules, 'nonMemberOnline', e.target.checked))
                  }
                />
              }
            />
            <Typography variant="body2" sx={{ pl: 1 }}>
              Enable to allow non-members to book reservations online.
            </Typography>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell
              component="th"
              scope="row"
              sx={(t) => ({ ...cellSx(t), fontWeight: 'normal' })}
            >
              <Typography component="span" sx={{ display: 'block' }}>
                {row.label}
              </Typography>
              {row.hint ? (
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ display: 'block', color: 'text.secondary' }}
                >
                  {row.hint}
                </Typography>
              ) : null}
            </TableCell>
            {COLUMNS.map(({ audience, label }) => {
              const ctx: Ctx = {
                audience,
                columnLabel: label,
                col: column(audience),
                set: (patch) => setColumn(audience, patch),
                errors,
                options,
                readOnly,
              };
              const content = row.cell(ctx, row.label);
              return content === 'na' ? (
                <TableCell
                  key={audience}
                  align="center"
                  sx={notApplicableSx}
                >
                  N/A
                </TableCell>
              ) : (
                <TableCell
                  key={audience}
                  align={
                    row.id === 'requireMemberReserver' || row.id === 'addOnPopup'
                      ? 'center'
                      : 'left'
                  }
                  sx={cellSx}
                >
                  {content}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
