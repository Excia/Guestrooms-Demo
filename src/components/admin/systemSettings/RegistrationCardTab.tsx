import FindInPage from '@mui/icons-material/FindInPage';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { visuallyHidden } from '@mui/utils';
import { useId, useState } from 'react';
import { useApi } from '../../../api';
import type {
  RegistrationCardItemId,
  RegistrationCardSettings,
} from '../../../api/registrationCardTypes';
import type { FolioDetails } from '../../../api/types';
import {
  isItemDisabled,
  ITEM_GRID,
  ITEM_LABELS,
  ITEM_PARENT,
  REGISTRATION_CARD_CUSTOM_TEXT_MAX,
  setItem,
} from '../../../app/registrationCard';
import { openCardErrorMessage, openCardInNewTab } from '../../../app/openCardPreview';
import type { SystemSettingsErrors } from '../../../app/systemSettings';
import { fieldId, SectionTitle } from './fieldParts';
import ToggleRow from './ToggleRow';

export interface RegistrationCardTabProps {
  value: RegistrationCardSettings;
  onChange: (next: RegistrationCardSettings) => void;
  /** The folio header, sent with the preview request for Include Folio Header. */
  folio: FolioDetails;
  errors: SystemSettingsErrors;
}

// Registration Card tab (Figma 13319:41951): the enable switch, the items printed on the card, the
// custom text and Generate Preview (the backend renders the PDF; it opens in a new tab, D-003).
export default function RegistrationCardTab({
  value,
  onChange,
  folio,
  errors,
}: RegistrationCardTabProps) {
  const api = useApi();
  const titleId = useId();
  const baseId = useId();
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const textError = errors['registrationCard.customText']?.[0];

  const generatePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      await openCardInNewTab(() => api.registrationCard.requestPreview({ settings: value, folio }));
    } catch (error) {
      setPreviewError(openCardErrorMessage(error));
    } finally {
      setPreviewing(false);
    }
  };

  const item = (id: RegistrationCardItemId) => {
    const parent = ITEM_PARENT[id];
    const blocked = isItemDisabled(value.items, id);
    const hintId = `${baseId}-${id}-hint`;
    return (
      <>
        <FormControlLabel
          label={ITEM_LABELS[id]}
          disabled={!value.enabled || blocked}
          control={
            <Checkbox
              checked={value.items[id]}
              onChange={(e) =>
                onChange({ ...value, items: setItem(value.items, id, e.target.checked) })
              }
              slotProps={{
                input: { 'aria-describedby': blocked && parent ? hintId : undefined },
              }}
            />
          }
        />
        {blocked && parent ? (
          <FormHelperText id={hintId} sx={{ mt: -0.5, ml: 5.25 }}>
            {`Check ${ITEM_LABELS[parent]} to use this.`}
          </FormHelperText>
        ) : null}
      </>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ToggleRow
        label="Enable Registration Card"
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
        description="When enabled, a registration card will be printed upon check-in."
      />
      <Box
        component="section"
        aria-labelledby={titleId}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <SectionTitle id={titleId}>Registration Card Items</SectionTitle>
          <Button
            size="small"
            startIcon={previewing ? <CircularProgress size={16} color="inherit" /> : <FindInPage />}
            onClick={() => void generatePreview()}
            disabled={!value.enabled}
            // Stays focusable while it works (a disabled button would drop the keyboard's place).
            aria-disabled={previewing || undefined}
            sx={previewing ? { cursor: 'progress', opacity: 0.7 } : undefined}
          >
            {previewing ? 'Generating…' : 'Generate Preview'}
          </Button>
          <Box role="status" aria-live="polite" sx={visuallyHidden}>
            {previewing ? 'Generating preview' : ''}
          </Box>
        </Box>
        {previewError ? (
          <Alert severity="error" role="alert">
            {previewError}
          </Alert>
        ) : null}
        <Box
          role="group"
          aria-labelledby={titleId}
          sx={(t) => ({
            display: 'grid',
            gridTemplateColumns: '1fr',
            columnGap: 6,
            [t.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          })}
        >
          {ITEM_GRID.map(([left, right]) =>
            [left, right].map((id, column) => {
              if (id === null) {
                return (
                  <Box
                    key={`${left}-empty`}
                    aria-hidden
                    sx={{ display: { xs: 'none', lg: 'block' } }}
                  />
                );
              }
              return (
                <Box key={id} sx={{ gridColumn: { lg: column + 1 } }}>
                  {item(id)}
                  {id === 'customText' && value.items.customText ? (
                    <Box sx={{ pl: 5.25, pb: 1 }}>
                      <TextField
                        id={fieldId('registrationCard.customText')}
                        value={value.customText}
                        onChange={(e) => onChange({ ...value, customText: e.target.value })}
                        disabled={!value.enabled}
                        error={Boolean(textError)}
                        multiline
                        minRows={5}
                        fullWidth
                        helperText={
                          <>
                            {textError ? (
                              <Box component="span" sx={{ display: 'block' }}>
                                {textError}
                              </Box>
                            ) : null}
                            <Box component="span" sx={{ display: 'block', textAlign: 'right' }}>
                              {`${value.customText.length} / ${REGISTRATION_CARD_CUSTOM_TEXT_MAX}`}
                            </Box>
                          </>
                        }
                        slotProps={{
                          htmlInput: {
                            'aria-label': 'Custom Text content',
                            maxLength: REGISTRATION_CARD_CUSTOM_TEXT_MAX,
                          },
                        }}
                      />
                    </Box>
                  ) : null}
                </Box>
              );
            }),
          )}
        </Box>
      </Box>
    </Box>
  );
}
