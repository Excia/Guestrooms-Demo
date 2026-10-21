import CheckCircle from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import type { EarlyLateState, EarlyLateValues } from '../../app/earlyLate';

export interface EarlyLateTogglesProps {
  state: EarlyLateState;
  disabled?: boolean;
  /** Why the boxes cannot be changed; shown as text. */
  disabledReason?: string;
  onToggle: (field: keyof EarlyLateValues) => void;
  onRetry: () => void;
  /** After an unconfirmed save: reload the reservation. */
  onReload?: () => void;
}

/**
 * The Early Check In and Late Check Out checkboxes of the panel header. They save as they are
 * ticked: the status line says Saving, Saved (stays until the next change) or the error with Retry,
 * and is announced politely.
 */
export default function EarlyLateToggles({
  state,
  disabled,
  disabledReason,
  onToggle,
  onRetry,
  onReload,
}: EarlyLateTogglesProps) {
  const field = (key: keyof EarlyLateValues, label: string) => (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={state.shown[key]}
          disabled={disabled}
          onChange={() => onToggle(key)}
          sx={{ py: 0.5 }}
        />
      }
      label={label}
      slotProps={{ typography: { variant: 'body2' } }}
      sx={{ mr: 2, ml: -0.5 }}
    />
  );
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box
        role="group"
        aria-label="Check in and check out options"
        sx={{ display: 'flex', flexWrap: 'wrap' }}
      >
        {field('earlyCheckIn', 'Early Check In')}
        {field('lateCheckOut', 'Late Check Out')}
      </Box>
      <Box sx={{ minHeight: (t) => t.spacing(3), display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Always mounted: a live region that appears together with its text is often not read. */}
        <Typography
          role="status"
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
        >
          {state.status === 'saving' ? 'Saving…' : null}
          {state.status === 'saved' ? (
            <>
              <CheckCircle aria-hidden color="primary" sx={{ fontSize: (t) => t.spacing(2) }} />
              Saved
            </>
          ) : null}
          {disabled && disabledReason ? disabledReason : null}
        </Typography>
        {state.status === 'error' ? (
          <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {state.message}
            </Typography>
            <Button size="small" onClick={state.unconfirmed && onReload ? onReload : onRetry}>
              {state.unconfirmed ? 'Reload' : 'Retry'}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
