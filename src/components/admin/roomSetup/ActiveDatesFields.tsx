import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { todayIso } from '../../../app/dateSelection';
import DateField from '../../shared/DateField';

export interface ActiveDatesFieldsProps {
  startDate: string;
  endDate: string | null;
  onChange: (value: { startDate: string; endDate: string | null }) => void;
  startError?: string;
  endError?: string;
  /** Prefix of the field ids, for focusing the first invalid one. */
  idPrefix: string;
}

// Active Start Date, Active End Date and "Configure active end date?" (PDF 9.4.2, Figma
// 11964:13730). The end date only exists while the box is checked.
export default function ActiveDatesFields({
  startDate,
  endDate,
  onChange,
  startError,
  endError,
  idPrefix,
}: ActiveDatesFieldsProps) {
  const configured = endDate !== null;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box id={`${idPrefix}-startDate`} sx={{ flex: '1 1 0', minWidth: 200 }}>
          <DateField
            fullWidth
            label="Active Start Date"
            value={startDate}
            onChange={(v) => onChange({ startDate: v, endDate })}
            today={todayIso()}
            error={Boolean(startError)}
            helperText={startError}
          />
        </Box>
        {configured ? (
          <Box id={`${idPrefix}-endDate`} sx={{ flex: '1 1 0', minWidth: 200 }}>
            <DateField
              fullWidth
              label="Active End Date"
              value={endDate}
              min={startDate || undefined}
              onChange={(v) => onChange({ startDate, endDate: v })}
              today={todayIso()}
              error={Boolean(endError)}
              helperText={endError}
            />
          </Box>
        ) : null}
      </Box>
      <FormControlLabel
        label="Configure active end date?"
        control={
          <Checkbox
            checked={configured}
            onChange={(e) => onChange({ startDate, endDate: e.target.checked ? '' : null })}
          />
        }
      />
    </Box>
  );
}
