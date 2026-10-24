import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
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
import { useClubToday } from '../../app/useClubToday';
import DateField from './DateField';
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

function RangeFields({
  from,
  to,
  onChange,
  readOnly,
  invalid,
  describedBy,
  labelPrefix,
  today,
  weekStartsOn,
}: {
  today?: IsoDate;
  weekStartsOn?: WeekStart;
  from: IsoDate;
  to: IsoDate;
  onChange?: (range: { from: IsoDate; to: IsoDate }) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Prefix for the accessible names, e.g. "Compare to". */
  labelPrefix?: string;
}) {
  // The pair shares one calendar. A half-picked range (first click only) is kept inside the
  // calendar and only a complete one is reported, so the value always has both dates.
  const range = (role: 'from' | 'to') =>
    onChange
      ? {
          role,
          from,
          to,
          limits: { minNights: 0 },
          endNames: ['from', 'to'] as [string, string],
          onChange: (r: { from: IsoDate | ''; to: IsoDate | '' }) => {
            if (r.from && r.to) onChange({ from: r.from, to: r.to });
          },
        }
      : undefined;
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', width: '100%' }}>
      <DateField
        label="From"
        ariaLabel={labelPrefix ? `${labelPrefix} from` : undefined}
        compact
        today={today}
        weekStartsOn={weekStartsOn}
        value={from}
        readOnly={readOnly}
        error={invalid}
        describedBy={invalid ? describedBy : undefined}
        range={range('from')}
        onChange={(v) => onChange?.({ from: v, to })}
      />
      <DateField
        label="To"
        ariaLabel={labelPrefix ? `${labelPrefix} to` : undefined}
        compact
        today={today}
        weekStartsOn={weekStartsOn}
        value={to}
        readOnly={readOnly}
        error={invalid}
        describedBy={invalid ? describedBy : undefined}
        range={range('to')}
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
  const today = useClubToday(todayProp);
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
            today={today}
            weekStartsOn={weekStartsOn}
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
            today={today}
            weekStartsOn={weekStartsOn}
            error={Boolean(errors.period)}
            describedBy={errors.period ? periodErrorId : undefined}
            onChange={(date) => setPeriod({ kind: 'singleDay', date })}
          />
        );
      case 'asOf':
        return (
          <DateField
            label="As of Date"
            value={period.date}
            today={today}
            weekStartsOn={weekStartsOn}
            error={Boolean(errors.period)}
            describedBy={errors.period ? periodErrorId : undefined}
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
              today={today}
              weekStartsOn={weekStartsOn}
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
            today={today}
            weekStartsOn={weekStartsOn}
            error={Boolean(errors.comparison)}
            describedBy={errors.comparison ? compareErrorId : undefined}
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
