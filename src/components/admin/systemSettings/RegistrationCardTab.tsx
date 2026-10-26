import { useReadOnly } from '../../../app/readOnlyContext';
import FindInPage from '@mui/icons-material/FindInPage';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
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
  ITEM_GRID,
  ITEM_LABELS,
  ITEM_PARENT,
  REGISTRATION_CARD_CUSTOM_TEXT_MAX,
  setItem,
} from '../../../app/registrationCard';
import { buildRegistrationCard } from '../../../app/registrationCard';
import { SAMPLE_RESERVATION, SAMPLE_SYSTEM_NAME } from '../../../app/registrationCardSample';
import RegistrationCardPreviewDialog from '../../registrationCard/RegistrationCardPreviewDialog';
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
// custom text and Generate Preview (the card in a dialog; its Print button asks the backend for the PDF
// and opens it in a new tab, D-003).
export default function RegistrationCardTab({
  value,
  onChange,
  folio,
  errors,
}: RegistrationCardTabProps) {
  const api = useApi();
  const readOnly = useReadOnly();
  const titleId = useId();
  const baseId = useId();
  const [previewOpen, setPreviewOpen] = useState(false);
  const textError = errors['registrationCard.customText']?.[0];

  const item = (id: RegistrationCardItemId) => {
    const parent = ITEM_PARENT[id];
    const blocked = isItemDisabled(value.items, id);
    const hintId = `${baseId}-${id}-hint`;
    return (
      <>
        <FormControlLabel
          label={ITEM_LABELS[id]}
          disabled={!value.enabled || blocked || readOnly}
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
            startIcon={<FindInPage />}
            onClick={() => setPreviewOpen(true)}
            disabled={!value.enabled}
          >
            Generate Preview
          </Button>
        </Box>
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
                        disabled={!value.enabled || readOnly}
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
      <RegistrationCardPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        card={buildRegistrationCard(value, SAMPLE_RESERVATION, folio, SAMPLE_SYSTEM_NAME)}
        requestDocument={() => api.registrationCard.requestPreview({ settings: value, folio })}
      />
    </Box>
  );
}
