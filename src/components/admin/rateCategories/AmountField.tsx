import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import type { Cents } from '../../../api/types';
import { formatDollars, MAX_RATE_CENTS, parseDollars } from '../../../app/rateCategories';

export interface AmountFieldProps {
  /** Accessible name, e.g. "Summer, King Room, Fri". */
  label: string;
  cents: Cents;
  onChange: (cents: Cents) => void;
}

const valid = (text: string): Cents | null => {
  const cents = parseDollars(text);
  return cents !== null && cents <= MAX_RATE_CENTS ? cents : null;
};

// A money cell of the rate table: typed dollars ("125", "125.5", "1,250.00"), stored as cents.
// A value that is not money is flagged and not stored; leaving the cell restores the last good one.
export default function AmountField({ label, cents, onChange }: AmountFieldProps) {
  const [text, setText] = useState(formatDollars(cents));
  const [seen, setSeen] = useState(cents);
  if (cents !== seen) {
    setSeen(cents);
    if (valid(text) !== cents) setText(formatDollars(cents));
  }
  const invalid = valid(text) === null;
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
      onBlur={() => setText(formatDollars(cents))}
      slotProps={{
        htmlInput: { 'aria-label': label, inputMode: 'decimal', 'aria-invalid': invalid },
        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
      }}
      sx={(t) => ({ width: t.spacing(14) })}
    />
  );
}
