import Box from '@mui/material/Box';
import type { SystemSettings } from '../../../api/types';
import {
  trainingModeLabel,
  withTrainingMode,
  type SystemSettingsErrors,
} from '../../../app/systemSettings';
import { ErrorLines, fieldId } from './fieldParts';
import ToggleRow from './ToggleRow';

export interface TrainingModeToggleProps {
  value: SystemSettings;
  onChange: (next: SystemSettings) => void;
  errors: SystemSettingsErrors;
}

// Top right of the Settings tab, as in legacy; the label names the state ("Training Mode Enabled").
export default function TrainingModeToggle({ value, onChange, errors }: TrainingModeToggleProps) {
  return (
    <Box
      data-testid="training-mode-row"
      sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}
    >
      <Box sx={{ maxWidth: (t) => t.spacing(48) }}>
        <ToggleRow
          id={fieldId('trainingMode')}
          label={trainingModeLabel(value.trainingMode)}
          checked={value.trainingMode}
          onChange={(on) => onChange(withTrainingMode(value, on))}
          description="Practice mode for training staff. While on, Night Audit can only be run manually."
        />
        <ErrorLines id={`${fieldId('trainingMode')}-error`} messages={errors.trainingMode} />
      </Box>
    </Box>
  );
}
