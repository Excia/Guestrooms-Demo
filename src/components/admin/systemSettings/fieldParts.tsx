import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { SystemSettingsField } from '../../../app/systemSettings';

/** DOM id of a field's control; the page focuses the first invalid one after a refused save. */
export const fieldId = (field: SystemSettingsField) => `system-settings-${field}`;

/** Figma typography/h5_fixed (bold, secondary text), at the System Settings heading size (theme `settings_heading`). */
export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Typography id={id} variant="settings_heading" component="h3" sx={{ color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Typography id={id} variant="caption" component="p" sx={{ color: 'text.secondary', m: 0 }}>
      {children}
    </Typography>
  );
}

/** A titled group of controls (Figma "Main Settings" blocks). */
export function Section({
  title,
  titleId,
  children,
}: {
  title: string;
  titleId?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {children}
    </Box>
  );
}

/** Inline error lines under a control (several rules can fail at once). */
export function ErrorLines({ id, messages }: { id: string; messages?: readonly string[] }) {
  if (!messages?.length) return null;
  return (
    <Box id={id} sx={{ display: 'flex', flexDirection: 'column' }}>
      {messages.map((m) => (
        <FormHelperText key={m} error sx={{ mx: 0 }}>
          {m}
        </FormHelperText>
      ))}
    </Box>
  );
}
