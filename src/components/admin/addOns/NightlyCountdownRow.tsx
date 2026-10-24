import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { clampNightlyQty, NIGHTLY_QTY } from '../../../app/addOns';
import ToggleRow from '../systemSettings/ToggleRow';
import NightsStepper from '../systemSettings/NightsStepper';
import { ErrorLines } from '../systemSettings/fieldParts';

export interface NightlyCountdownRowProps {
  tracked: boolean;
  qty: number;
  onChange: (value: { trackNightly: boolean; nightlyQty: number }) => void;
  error?: string;
  id: string;
}

// "Track Nightly Countdown" switch with the "Nightly Qty." stepper beside it (Figma 13533:73353).
// The stepper is disabled, not hidden, while tracking is off.
export default function NightlyCountdownRow({
  tracked,
  qty,
  onChange,
  error,
  id,
}: NightlyCountdownRowProps) {
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          columnGap: 3,
        }}
      >
        <ToggleRow
          label="Track Nightly Countdown"
          checked={tracked}
          onChange={(trackNightly) => onChange({ trackNightly, nightlyQty: qty })}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography id={`${id}-label`} variant="body2">
            Nightly Qty.
          </Typography>
          <NightsStepper
            id={id}
            label="Nightly Qty."
            unit="per night"
            value={qty}
            min={NIGHTLY_QTY.min}
            max={NIGHTLY_QTY.max}
            disabled={!tracked}
            onChange={(v) => onChange({ trackNightly: tracked, nightlyQty: clampNightlyQty(v) })}
          />
        </Box>
      </Box>
      {error ? <ErrorLines id={`${id}-error`} messages={[error]} /> : null}
    </Box>
  );
}
