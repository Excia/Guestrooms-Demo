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
  /** Accessible name when it must differ from the visible Figma label. */
  ariaLabel?: string;
  /** Half-width field: tighter padding so the full date and the picker icon fit in 105px. */
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
  ariaLabel,
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
              // Figma input padding is 12px; half-width fields use 8px so the date is not clipped
              // next to the picker icon (mouse users still get the calendar).
              px: compact ? 1 : 1.5,
              '&::-webkit-calendar-picker-indicator': { m: 0, ml: 0.25, p: 0 },
            },
          },
        },
        htmlInput: {
          readOnly,
          'aria-label': ariaLabel,
          'aria-describedby': invalid ? describedBy : undefined,
          // Derived values are display-only: keep them out of the tab order (three stops each).
          tabIndex: readOnly ? -1 : undefined,
        },
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
  labelPrefix,
}: {
  from: IsoDate;
  to: IsoDate;
  onChange?: (range: { from: IsoDate; to: IsoDate }) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Prefix for the accessible names, e.g. "Compare to". */
  labelPrefix?: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', width: '100%' }}>
      <DateField
        label="From"
        ariaLabel={labelPrefix ? `${labelPrefix} from` : undefined}
        compact
        value={from}
        readOnly={readOnly}
        invalid={invalid}
        describedBy={describedBy}
        onChange={(v) => onChange?.({ from: v, to })}
      />
      <DateField
        label="To"
        ariaLabel={labelPrefix ? `${labelPrefix} to` : undefined}
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
            fullWidth
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
              ariaLabel="Compare to date range"
              fullWidth
              value={c.preset}
              options={presetOptions}
              onChange={(preset) => onChange(setRangePreset(value, preset))}
            />
            <RangeFields
              from={c.from}
              to={c.to}
              readOnly={c.preset !== 'custom'}
              labelPrefix="Compare to"
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
            ariaLabel="Compare to month"
            fullWidth
            value={c.month}
            options={months(c.month)}
            onChange={(month) =>
              onChange(updateComparison(value, { kind: 'month', month, derived: false }))
            }
          />
        );
      case 'date':
        return (
          <DateField
            label={period.kind === 'asOf' ? 'As of Date' : 'Date'}
            ariaLabel={period.kind === 'asOf' ? 'Compare to as of date' : 'Compare to date'}
            value={c.date}
            invalid={Boolean(errors.comparison)}
            describedBy={compareErrorId}
            onChange={(date) =>
              onChange(updateComparison(value, { kind: 'date', date, derived: false }))
            }
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
        fullWidth
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
          <Typography variant="button_small" component="p">
            Compare to:
          </Typography>
          {comparisonFields(comparison)}
          <ErrorText id={compareErrorId} message={errors.comparison} />
        </>
      ) : null}
    </Box>
  );
}
