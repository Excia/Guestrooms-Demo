import TextField from '@mui/material/TextField';
import { useEffect, useId, useRef, useState } from 'react';
import type { Cents } from '../../../api/types';
import { formatDollars, MAX_RATE_CENTS, parseDollars } from '../../../app/rateCategories';
import { RATE_TABLE, tablePx } from './rateTableSizes';

export interface AmountFieldProps {
  /** Accessible name, e.g. "Summer, King Room, Fri". */
  label: string;
  cents: Cents;
  onChange: (cents: Cents) => void;
  /** Tells the page whether this cell holds text that is not money (so Save can wait). */
  onInvalidChange?: (invalid: boolean) => void;
}

const valid = (text: string): Cents | null => {
  const cents = parseDollars(text);
  return cents !== null && cents <= MAX_RATE_CENTS ? cents : null;
};

export const AMOUNT_HINT = `Enter an amount from 0 to ${formatDollars(MAX_RATE_CENTS)}`;

// A money cell of the rate table: typed dollars ("125", "125.5", "1,250.00"), stored as cents.
// Text that is not money stays in the cell, flagged with a message, until it is corrected; the
// stored value is unchanged meanwhile and the page will not save.
export default function AmountField({ label, cents, onChange, onInvalidChange }: AmountFieldProps) {
  const [text, setText] = useState(formatDollars(cents));
  const [seen, setSeen] = useState(cents);
  const hintId = useId();
  if (cents !== seen) {
    setSeen(cents);
    if (valid(text) !== cents) setText(formatDollars(cents));
  }
  const invalid = valid(text) === null;
  // The callback is read through a ref, so a new function each render cannot re-run the effects.
  const notify = useRef(onInvalidChange);
  useEffect(() => {
    notify.current = onInvalidChange;
  });
  useEffect(() => {
    notify.current?.(invalid);
  }, [invalid]);
  useEffect(() => {
    const current = notify;
    return () => current.current?.(false);
  }, []);
  return (
    <TextField
      size="small"
      value={text}
      error={invalid}
      onChange={(e) => {
        setText(e.target.value);
        const next = valid(e.target.value);
        if (next !== null) onChange(next);
      }}
      onBlur={() => {
        if (!invalid) setText(formatDollars(cents));
      }}
      helperText={invalid ? AMOUNT_HINT : undefined}
      slotProps={{
        htmlInput: {
          'aria-label': label,
          inputMode: 'decimal',
          'aria-invalid': invalid,
          'aria-describedby': invalid ? `${hintId}-helper` : undefined,
        },
        formHelperText: { id: `${hintId}-helper` },
      }}
      // Compact (rateTableSizes.ts): smaller text and height than the form fields, same hit size.
      sx={(t) => ({
        width: tablePx(t, RATE_TABLE.amountWidthPx),
        '& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
          height: tablePx(t, RATE_TABLE.amountHeightPx),
          fontSize: t.typography.pxToRem(RATE_TABLE.fontPx),
          px: 0,
        },
        // The input has its own font size (1rem), so it is set here too.
        '& .MuiOutlinedInput-input': {
          py: 0,
          pl: tablePx(t, RATE_TABLE.inputPadLeftPx),
          pr: tablePx(t, RATE_TABLE.inputPadRightPx),
          fontSize: 'inherit',
          textAlign: 'right',
        },
        '& .MuiFormHelperText-root': { mx: 0, fontSize: t.typography.pxToRem(11) },
      })}
    />
  );
}
