import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useId, type ReactNode } from 'react';
import { Hint } from './fieldParts';

export interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Explanation under the switch; read as the switch's description. */
  description?: ReactNode;
  /** Shown only while the switch is on (e.g. the Late Checkout Time). */
  children?: ReactNode;
  id?: string;
  disabled?: boolean;
}

// Switch with its label and optional description (Figma Switch 11896:4304).
export default function ToggleRow({
  label,
  checked,
  onChange,
  description,
  children,
  id,
  disabled,
}: ToggleRowProps) {
  const descriptionId = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FormControlLabel
        label={label}
        disabled={disabled}
        control={
          <Switch
            id={id}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{ input: { 'aria-describedby': description ? descriptionId : undefined } }}
          />
        }
        sx={{ alignSelf: 'flex-start' }}
      />
      {description ? (
        <Box sx={{ pl: 6.5 }}>
          <Hint id={descriptionId}>{description}</Hint>
        </Box>
      ) : null}
      {checked && children ? <Box sx={{ pl: 6.5, pt: 1 }}>{children}</Box> : null}
    </Box>
  );
}
