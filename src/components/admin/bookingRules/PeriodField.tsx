import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import type { TimePeriod, TimeUnit } from '../../../api/types';
import { PERIOD_AMOUNT, TIME_UNITS } from '../../../app/bookingRules';
import CellSelect from './CellSelect';

const NONE = 'na';
const AMOUNTS = Array.from({ length: PERIOD_AMOUNT.max - PERIOD_AMOUNT.min + 1 }, (_, i) => {
  const n = PERIOD_AMOUNT.min + i;
  return { value: String(n), label: String(n) };
});
const UNIT_OPTIONS = TIME_UNITS.map((u) => ({ value: u, label: u }));

export interface PeriodFieldProps {
  id: string;
  /** Accessible name, e.g. "Booking Opens, Member Online Booking". */
  label: string;
  value: TimePeriod | null;
  onChange: (value: TimePeriod | null) => void;
  /** Adds an "N/A" choice (booking closes, cancellation period). */
  allowNone?: boolean;
  disabled?: boolean;
  error?: string;
  /** Unit used when a number is first chosen after "N/A". */
  defaultUnit?: TimeUnit;
}

// "6 | months" pair of selects (Figma "Double Input"); "N/A" shows one full-width select.
export default function PeriodField({
  id,
  label,
  value,
  onChange,
  allowNone,
  disabled,
  error,
  defaultUnit = 'months',
}: PeriodFieldProps) {
  const errorId = `${id}-error`;
  const amountOptions = allowNone ? [{ value: NONE, label: 'N/A' }, ...AMOUNTS] : AMOUNTS;
  const showUnit = value !== null || !allowNone;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <CellSelect<string>
          id={id}
          ariaLabel={`${label} amount`}
          value={disabled ? '' : value ? String(value.amount) : allowNone ? NONE : ''}
          options={amountOptions}
          onChange={(v) =>
            onChange(v === NONE ? null : { amount: Number(v), unit: value?.unit ?? defaultUnit })
          }
          disabled={disabled}
          error={Boolean(error)}
          describedBy={error ? errorId : undefined}
          sx={{ flex: showUnit ? 1 : 'auto' }}
        />
        {showUnit ? (
          <CellSelect<TimeUnit>
            id={`${id}-unit`}
            ariaLabel={`${label} unit`}
            value={disabled ? '' : (value?.unit ?? defaultUnit)}
            options={UNIT_OPTIONS}
            onChange={(unit) => onChange({ amount: value?.amount ?? PERIOD_AMOUNT.min, unit })}
            disabled={disabled || value === null}
            error={Boolean(error)}
            sx={{ flex: 1 }}
          />
        ) : null}
      </Box>
      {error ? (
        <FormHelperText id={errorId} error>
          {error}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
