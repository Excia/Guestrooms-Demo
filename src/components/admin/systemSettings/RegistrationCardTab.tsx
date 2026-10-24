import FindInPage from '@mui/icons-material/FindInPage';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';
import { useApi } from '../../../api';
import type {
  RegistrationCardItemId,
  RegistrationCardSettings,
} from '../../../api/registrationCardTypes';
import type { FolioDetails } from '../../../api/types';
import {
  isItemDisabled,
  isOpenablePreviewUrl,
  ITEM_GRID,
  ITEM_LABELS,
  REGISTRATION_CARD_CUSTOM_TEXT_MAX,
  setItem,
} from '../../../app/registrationCard';
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
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const textError = errors['registrationCard.customText']?.[0];

  const generatePreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    // Open the tab inside the click so a popup blocker allows it; it is pointed at the PDF below.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await api.registrationCard.requestPreview({ settings: value, folio });
      if (!isOpenablePreviewUrl(url)) throw new Error('Unsafe preview address');
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch {
      tab?.close();
      setPreviewError('The preview could not be generated. Try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const item = (id: RegistrationCardItemId) => (
    <FormControlLabel
      key={id}
      label={ITEM_LABELS[id]}
      disabled={!value.enabled || isItemDisabled(value.items, id)}
      control={
        <Checkbox
          checked={value.items[id]}
          onChange={(e) =>
            onChange({ ...value, items: setItem(value.items, id, e.target.checked) })
          }
        />
      }
    />
  );

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
            startIcon={<FindInPage />}
            onClick={() => void generatePreview()}
            disabled={!value.enabled || previewing}
          >
            Generate Preview
          </Button>
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
                            'aria-label': 'Custom Text',
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
