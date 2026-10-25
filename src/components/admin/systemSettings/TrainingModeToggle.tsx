import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import type { SystemSettings } from '../../../api/types';
import {
  trainingModeLabel,
  withTrainingMode,
  type SystemSettingsErrors,
} from '../../../app/systemSettings';
import { ErrorLines, fieldId, Hint } from './fieldParts';

export interface TrainingModeToggleProps {
  value: SystemSettings;
  onChange: (next: SystemSettings) => void;
  errors: SystemSettingsErrors;
}

// Top right of the Settings tab, as in legacy. The visible text reads "Training Mode Enabled" or
// "Training Mode Disabled" like legacy, but the switch's name stays "Training Mode" (its state is
// the switch's own) so a screen reader does not hear the state twice.
export default function TrainingModeToggle({ value, onChange, errors }: TrainingModeToggleProps) {
  const descriptionId = useId();
  const noteId = useId();
  const errorId = `${fieldId('trainingMode')}-error`;
  // Set when turning Training Mode on moved an automatic Night Audit to Run Manually.
  const [forcedManual, setForcedManual] = useState(false);
  const hasError = Boolean(errors.trainingMode?.length);
  const describedBy =
    [descriptionId, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

  const toggle = (on: boolean) => {
    if (on) setForcedManual(value.nightAudit === 'automatic');
    onChange(withTrainingMode(value, on));
  };
  const showNote = forcedManual && !value.trainingMode && value.nightAudit === 'manual';

  return (
    <Box
      data-testid="training-mode-row"
      sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}
    >
      <Box
        sx={{ maxWidth: (t) => t.spacing(48), display: 'flex', flexDirection: 'column', gap: 0.5 }}
      >
        <FormControlLabel
          sx={{ alignSelf: 'flex-end' }}
          label={
            <>
              Training Mode{' '}
              <Typography component="span" variant="inherit" sx={{ color: 'text.secondary' }}>
                {trainingModeLabel(value.trainingMode).replace('Training Mode ', '')}
              </Typography>
            </>
          }
          control={
            <Switch
              id={fieldId('trainingMode')}
              checked={value.trainingMode}
              onChange={(e) => toggle(e.target.checked)}
              slotProps={{
                input: { 'aria-label': 'Training Mode', 'aria-describedby': describedBy },
              }}
            />
          }
        />
        <Box sx={{ pl: 6.5 }}>
          <Hint id={descriptionId}>
            Practice mode for training staff. While on, Night Audit can only be run manually.
          </Hint>
        </Box>
        <ErrorLines id={errorId} messages={errors.trainingMode} />
        {showNote ? (
          <Box sx={{ pl: 6.5 }}>
            <Hint id={noteId}>
              Night Audit was set to Run Manually when Training Mode was turned on. Choose Run
              Automatically again if you want it back.
            </Hint>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
