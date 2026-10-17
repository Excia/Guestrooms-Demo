import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import {
  changePeriodKind,
  monthLabel,
  monthOf,
  monthOptions,
  PERIOD_KINDS,
  PERIOD_LABELS,
  PRESET_LABELS,
  rangePresets,
  setCompare,
  setRangePreset,
  todayIso,
  updateComparison,
  updatePeriod,
  validateValue,
  type Comparison,
  type DateSelectionValue,
  type IsoDate,
  type IsoMonth,
  type Period,
  type PeriodKind,
  type RangePreset,
  type WeekStart,
} from '../../app/dateSelection';
import Select from './Select';

export interface DateSelectionProps {
  value: DateSelectionValue;
  onChange: (value: DateSelectionValue) => void;
  /** Local calendar date treated as "today"; injectable for tests and the demo. */
  today?: IsoDate;
  weekStartsOn?: WeekStart;
  /** Shows validation messages under the fields (off for the static Figma comparison). */
  showErrors?: boolean;
}

const FIELD_WIDTH = 27.5; // theme spacing units: 220px, the Figma control width.

interface DateFieldProps {
  label: string;
  value: IsoDate;
  onChange?: (value: IsoDate) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Half-width field: hides the picker icon so the full date fits (typing still works). */
  compact?: boolean;
}

// Native date input: keyboard operable, no extra dependency, value is already yyyy-mm-dd.
function DateField({
  label,
  value,
  onChange,
  readOnly,
  invalid,
  describedBy,
  compact,
}: DateFieldProps) {
  return (
    <TextField
      type="date"
      label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      error={invalid}
      fullWidth
      sx={{ minWidth: 0 }}
      slotProps={{
        inputLabel: { shrink: true },
        // Figma sets the dates in the 12px label style so two fit side by side in 220px.
        input: {
          sx: {
            // Two date fields share 220px (minus the 10px gap), so the native input must shrink.
            '& input': {
              fontSize: (t) => t.typography.caption.fontSize,
              height: (t) => t.spacing(3),
              minWidth: 0,
              // Figma input padding is 12px; the picker icon is tightened so the date is not clipped.
              px: 1.5,
              '&::-webkit-calendar-picker-indicator': compact
                ? { display: 'none' }
                : { m: 0, ml: 0.5, p: 0 },
            },
          },
        },
        htmlInput: { readOnly, 'aria-describedby': invalid ? describedBy : undefined },
      }}
    />
  );
}

function RangeFields({
  from,
  to,
  onChange,
  readOnly,
  invalid,
  describedBy,
}: {
  from: IsoDate;
  to: IsoDate;
  onChange?: (range: { from: IsoDate; to: IsoDate }) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', width: '100%' }}>
      <DateField
        label="From"
        compact
        value={from}
        readOnly={readOnly}
        invalid={invalid}
        describedBy={describedBy}
        onChange={(v) => onChange?.({ from: v, to })}
      />
      <DateField
        label="To"
        compact
        value={to}
        readOnly={readOnly}
        invalid={invalid}
        describedBy={describedBy}
        onChange={(v) => onChange?.({ from, to: v })}
      />
    </Box>
  );
}

// Reports the message once under the pair; the fields only show the red state.
function ErrorText({ id, message }: { id: string; message?: string }) {
  return message ? (
    <Typography id={id} role="alert" variant="caption" color="error" sx={{ mt: -1 }}>
      {message}
    </Typography>
  ) : null;
}

/**
 * Date Selection (Figma 120:8668): a period select plus its fields and a "Compare Dates" switch.
 * Controlled; the value object is typed in app/dateSelection.ts (ISO local dates).
 */
export default function DateSelection({
  value,
  onChange,
  today: todayProp,
  weekStartsOn = 0,
  showErrors = true,
}: DateSelectionProps) {
  const id = useId();
  const today = todayProp ?? todayIso();
  const { period, comparison } = value;
  const errors = showErrors ? validateValue(value) : {};
  const periodErrorId = `${id}-period-error`;
  const compareErrorId = `${id}-compare-error`;

  const periodOptions = PERIOD_KINDS.map((k) => ({ value: k, label: PERIOD_LABELS[k] }));
  const months = (selected: IsoMonth) =>
    monthOptions(monthOf(today), selected).map((m) => ({ value: m, label: monthLabel(m) }));

  const setPeriod = (next: Period) => onChange(updatePeriod(value, next));

  const periodFields = () => {
    switch (period.kind) {
      case 'custom':
        return (
          <RangeFields
            from={period.from}
            to={period.to}
            invalid={Boolean(errors.period)}
            describedBy={periodErrorId}
            onChange={(r) => setPeriod({ kind: 'custom', ...r })}
          />
        );
      case 'thisWeek':
        return <RangeFields from={period.from} to={period.to} readOnly />;
      case 'singleDay':
        return (
          <DateField
            label="Date"
            value={period.date}
            invalid={Boolean(errors.period)}
            describedBy={periodErrorId}
            onChange={(date) => setPeriod({ kind: 'singleDay', date })}
          />
        );
      case 'asOf':
        return (
          <DateField
            label="As of Date"
            value={period.date}
            invalid={Boolean(errors.period)}
            describedBy={periodErrorId}
            onChange={(date) => setPeriod({ kind: 'asOf', date })}
          />
        );
      case 'month':
        return (
          <Select
            label="Month"
            value={period.month}
            options={months(period.month)}
            onChange={(month) => setPeriod({ kind: 'month', month })}
          />
        );
    }
  };

  const comparisonFields = (c: Comparison) => {
    switch (c.kind) {
      case 'range': {
        const presetOptions = rangePresets(period.kind).map((p) => ({
          value: p,
          label: PRESET_LABELS[p],
        }));
        return (
          <>
            <Select<RangePreset>
              label="Date Range"
              value={c.preset}
              options={presetOptions}
              onChange={(preset) => onChange(setRangePreset(value, preset))}
            />
            <RangeFields
              from={c.from}
              to={c.to}
              readOnly={c.preset !== 'custom'}
              invalid={Boolean(errors.comparison)}
              describedBy={compareErrorId}
              onChange={(r) => onChange(updateComparison(value, { ...c, ...r }))}
            />
          </>
        );
      }
      case 'month':
        return (
          <Select
            label="Month"
            value={c.month}
            options={months(c.month)}
            onChange={(month) => onChange(updateComparison(value, { kind: 'month', month }))}
          />
        );
      case 'date':
        return (
          <DateField
            label={period.kind === 'asOf' ? 'As of Date' : 'Date'}
            value={c.date}
            invalid={Boolean(errors.comparison)}
            describedBy={compareErrorId}
            onChange={(date) => onChange(updateComparison(value, { kind: 'date', date }))}
          />
        );
    }
  };

  return (
    <Box
      role="group"
      aria-label="Date selection"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Figma column gap is 15px.
        gap: 1.875,
        alignItems: 'flex-start',
        width: (t) => t.spacing(FIELD_WIDTH),
      }}
    >
      <Select<PeriodKind>
        label="Date Range"
        value={period.kind}
        options={periodOptions}
        onChange={(kind) => onChange(changePeriodKind(value, kind, today, weekStartsOn))}
      />
      {periodFields()}
      <ErrorText id={periodErrorId} message={errors.period} />
      <FormControlLabel
        label="Compare Dates"
        control={
          <Switch
            checked={comparison !== null}
            onChange={(e) => onChange(setCompare(value, e.target.checked))}
          />
        }
      />
      {comparison ? (
        <>
          <Typography
            variant="button"
            component="p"
            sx={{ fontSize: (t) => t.typography.pxToRem(13), lineHeight: 22 / 13 }}
          >
            Compare to:
          </Typography>
          {comparisonFields(comparison)}
          <ErrorText id={compareErrorId} message={errors.comparison} />
        </>
      ) : null}
    </Box>
  );
}
