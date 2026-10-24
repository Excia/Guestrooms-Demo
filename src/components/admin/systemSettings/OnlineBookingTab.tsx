import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useId, type ReactNode } from 'react';
import type { OnlineBookingSettings } from '../../../api/types';
import { ONLINE_BOOKING_LIMITS, type OnlineBookingField } from '../../../app/onlineBookingSettings';
import type { SystemSettingsErrors } from '../../../app/systemSettings';
import { fieldId, Hint, Section } from './fieldParts';
import ToggleRow from './ToggleRow';

export interface OnlineBookingTabProps {
  value: OnlineBookingSettings;
  onChange: (next: OnlineBookingSettings) => void;
  errors: SystemSettingsErrors;
}

const FIELD_WIDTH = 538.5;

// Online Booking tab (Figma 15957:84617): what online booking shows guests and which prompts it uses.
export default function OnlineBookingTab({ value, onChange, errors }: OnlineBookingTabProps) {
  const set = <K extends keyof OnlineBookingSettings>(key: K, v: OnlineBookingSettings[K]) =>
    onChange({ ...value, [key]: v });
  const ids = { message: useId(), agreement: useId(), fee: useId(), addOns: useId() };

  const counted = (
    key: 'globalMessage' | 'cancellationAgreement',
    label: string,
    describedBy: string,
  ) => {
    const field = `onlineBooking.${key}` as OnlineBookingField;
    const limit = ONLINE_BOOKING_LIMITS[key];
    const message = errors[field]?.[0];
    return (
      <TextField
        id={fieldId(field)}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        error={Boolean(message)}
        multiline
        minRows={key === 'globalMessage' ? 2 : 3}
        fullWidth
        helperText={
          <>
            {message ? (
              <Box component="span" sx={{ display: 'block' }}>
                {message}
              </Box>
            ) : null}
            <Box component="span" sx={{ display: 'block', textAlign: 'right' }}>
              {`${value[key].length} / ${limit}`}
            </Box>
          </>
        }
        slotProps={{
          htmlInput: { maxLength: limit, 'aria-label': label, 'aria-describedby': describedBy },
        }}
      />
    );
  };

  const group = (title: string, titleId: string, hintId: string, hint: string, body: ReactNode) => (
    <Section title={title} titleId={titleId}>
      <Hint id={hintId}>{hint}</Hint>
      {body}
    </Section>
  );

  const urlError = errors['onlineBooking.policyUrl']?.[0];

  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: t.spacing(FIELD_WIDTH / 8),
      })}
    >
      {group(
        'Global Booking Message',
        `${ids.message}-title`,
        ids.message,
        'Message will be displayed in online booking in conjunction with search fields.',
        counted('globalMessage', 'Global Booking Message', ids.message),
      )}
      {group(
        'Cancellation Agreement',
        `${ids.agreement}-title`,
        ids.agreement,
        'Short policy will display in conjunction with the agreement checkbox prior to completing a reservation.',
        <>
          {counted('cancellationAgreement', 'Cancellation Agreement', ids.agreement)}
          <ToggleRow
            label="Include Link to Full Policy"
            checked={value.includePolicyLink}
            onChange={(checked) => set('includePolicyLink', checked)}
          >
            <TextField
              id={fieldId('onlineBooking.policyUrl')}
              label="URL"
              type="url"
              value={value.policyUrl}
              onChange={(e) => set('policyUrl', e.target.value)}
              error={Boolean(urlError)}
              helperText={urlError}
              placeholder="https://www.clubname.com/guestroomspolicy"
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength: ONLINE_BOOKING_LIMITS.policyUrl },
              }}
            />
          </ToggleRow>
        </>,
      )}
      {group(
        'Cancellation Fee',
        `${ids.fee}-title`,
        ids.fee,
        'Helper text about cancellation fees.',
        <ToggleRow
          label="Charge a Cancellation Fee"
          checked={value.chargeCancellationFee}
          onChange={(checked) => set('chargeCancellationFee', checked)}
        />,
      )}
      {group(
        'Add-Ons Popup',
        `${ids.addOns}-title`,
        ids.addOns,
        'Add-Ons Popup will help to promote add-on options to guests during their booking process. When turned on, this popup will display once a room selection has been made, prior to the details screen.',
        <ToggleRow
          label="Display Add-Ons Popup"
          checked={value.showAddOnsPopup}
          onChange={(checked) => set('showAddOnsPopup', checked)}
        />,
      )}
    </Box>
  );
}
