import EditOnly from '../EditOnly';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRef, useState, type ReactNode } from 'react';
import type { FolioDetails } from '../../../api/types';
import {
  FOLIO_LIMITS,
  logoFileProblem,
  type SystemSettingsErrors,
  type SystemSettingsField,
} from '../../../app/systemSettings';
import { US_STATES } from '../../../app/usStates';
import PhotoRemoveBadge from '../../shared/PhotoRemoveBadge';
import Select from '../../shared/Select';
import { fieldId, Section } from './fieldParts';

export interface FolioDetailsTabProps {
  value: FolioDetails;
  onChange: (next: FolioDetails) => void;
  errors: SystemSettingsErrors;
}

const STATE_OPTIONS = US_STATES.map((s) => ({ value: s, label: s }));

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Folio Details tab (Figma 11964:11725): what the printed folio shows in its header.
export default function FolioDetailsTab({ value, onChange, errors }: FolioDetailsTabProps) {
  const set = <K extends keyof FolioDetails>(key: K, v: FolioDetails[K]) =>
    onChange({ ...value, [key]: v });
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoProblem, setLogoProblem] = useState<string | null>(null);

  const text = (
    key: Exclude<keyof FolioDetails, 'logo' | 'state'>,
    label: string,
    extra: { counter?: boolean; multiline?: boolean; sx?: object; type?: string } = {},
  ) => {
    const field = `folio.${key}` as SystemSettingsField;
    const limit = key in FOLIO_LIMITS ? FOLIO_LIMITS[key as keyof typeof FOLIO_LIMITS] : undefined;
    const message = errors[field]?.[0];
    let helper: ReactNode;
    if (message || (extra.counter && limit)) {
      helper = (
        <>
          {message ? (
            <Box component="span" sx={{ display: 'block' }}>
              {message}
            </Box>
          ) : null}
          {extra.counter && limit ? (
            <Box component="span" sx={{ display: 'block', textAlign: 'right' }}>
              {`${value[key].length} / ${limit}`}
            </Box>
          ) : null}
        </>
      );
    }
    return (
      <TextField
        id={fieldId(field)}
        label={label}
        type={extra.type}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        error={Boolean(message)}
        helperText={helper}
        multiline={extra.multiline}
        minRows={extra.multiline ? 6 : undefined}
        fullWidth
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: limit ? { maxLength: limit } : undefined,
        }}
        sx={extra.sx}
      />
    );
  };

  const chooseLogo = async (file: File | undefined) => {
    if (!file) return;
    const problem = logoFileProblem(file);
    setLogoProblem(problem);
    if (problem) return;
    try {
      set('logo', await readAsDataUrl(file));
    } catch {
      setLogoProblem('The logo could not be read. Try another file.');
    }
  };

  return (
    <Box
      sx={(t) => ({
        display: 'grid',
        gridTemplateColumns: '1fr',
        columnGap: 6,
        rowGap: 4,
        alignItems: 'start',
        [t.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
      })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Section title="Property Address">
          {text('streetAddress', 'Street Address', { counter: true })}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {text('city', 'City', { counter: true, sx: { flex: 1 } })}
            <Select
              id="system-settings-folio-state"
              label="State"
              value={value.state}
              options={STATE_OPTIONS}
              onChange={(v) => set('state', v)}
              sx={{ width: (t) => t.spacing(15), flexShrink: 0 }}
            />
            {text('zip', 'Zip Code', {
              counter: true,
              sx: {
                width: (t: { spacing: (n: number) => string }) => t.spacing(15),
                flexShrink: 0,
              },
            })}
          </Box>
        </Section>
        <Section title="Property Contact">
          {text('email', 'Email Address', { type: 'email' })}
          {text('phone', 'Phone Number', { type: 'tel' })}
        </Section>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Section title="Custom Details">
          {text('customText', 'Custom Folio Text', { counter: true, multiline: true })}
        </Section>
        <Section title="Logo">
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <Box
              sx={(t) => ({
                position: 'relative',
                width: t.spacing(18.75),
                height: t.spacing(18.75),
                flexShrink: 0,
              })}
            >
              <Box
                sx={(t) => ({
                  width: '100%',
                  height: '100%',
                  borderRadius: t.spacing(2.5),
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {value.logo ? (
                  <Box
                    component="img"
                    src={value.logo}
                    alt="Folio logo"
                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No logo
                  </Typography>
                )}
              </Box>
              {value.logo ? (
                <PhotoRemoveBadge
                  label="Remove logo"
                  // The logo is a rounded square, so the badge sits just outside its corner.
                  sx={(t) => ({ top: t.spacing(-0.75), right: t.spacing(-0.75) })}
                  onClick={() => {
                    setLogoProblem(null);
                    set('logo', null);
                  }}
                />
              ) : null}
            </Box>
            <EditOnly>
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternate />}
                onClick={() => fileInput.current?.click()}
                sx={{ borderColor: 'primary.outlinedBorder' }}
              >
                Browse for Photo
              </Button>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/svg+xml"
                aria-label="Logo file"
                onChange={(e) => {
                  void chooseLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </EditOnly>
          </Box>
          {logoProblem ? (
            <FormHelperText error role="alert">
              {logoProblem}
            </FormHelperText>
          ) : null}
        </Section>
      </Box>
    </Box>
  );
}
