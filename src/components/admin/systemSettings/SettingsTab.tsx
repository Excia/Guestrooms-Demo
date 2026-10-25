import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';
import { useApi } from '../../../api';
import type {
  Duration,
  DurationUnit,
  SystemSettings,
  SystemSettingsOptions,
} from '../../../api/types';
import {
  ALT_RATE_NIGHTS,
  DURATION_AMOUNT,
  formatTime12,
  lateCheckoutOptions,
  SERVICE_CHARGE_LABEL_MAX,
  TIME_STEP_MINUTES,
  TRAINING_MODE_AUDIT_MESSAGE,
  withLateCheckoutInRange,
  type SystemSettingsErrors,
  type SystemSettingsField,
} from '../../../app/systemSettings';
import Select from '../../shared/Select';
import { ErrorLines, fieldId, Hint, Section } from './fieldParts';
import LookupField from './LookupField';
import NightsStepper from './NightsStepper';
import ToggleRow from './ToggleRow';

export interface SettingsTabProps {
  value: SystemSettings;
  onChange: (next: SystemSettings) => void;
  errors: SystemSettingsErrors;
  options: SystemSettingsOptions;
  /** View mode: every control of the tab is disabled (View-only admin; the page passes it). */
  readOnly?: boolean;
}

const range = ({ min, max }: { min: number; max: number }) =>
  Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: String(min + i) }));
const AMOUNTS = range(DURATION_AMOUNT);
const UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

// A column of the two-column form (stacks below 1200px).
const column = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as const;

interface DurationRowProps {
  field: SystemSettingsField;
  label: string;
  value: Duration;
  onChange: (value: Duration) => void;
  errors: SystemSettingsErrors;
  before?: string;
  after: string;
  disabled?: boolean;
}

// "N | Hours or Days | text" row of the MPOS and Close Settled Folios settings (Figma 11895:16081).
function DurationRow({
  field,
  label,
  value,
  onChange,
  errors,
  before,
  after,
  disabled,
}: DurationRowProps) {
  const messages = errors[field];
  const errorId = `${fieldId(field)}-error`;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {before ? (
          <Typography
            variant="caption"
            sx={{ width: (t) => t.spacing(15), color: 'text.secondary' }}
          >
            {before}
          </Typography>
        ) : null}
        <Select<number>
          id={fieldId(field)}
          label={label}
          value={value.amount}
          options={AMOUNTS}
          onChange={(amount) => onChange({ ...value, amount })}
          error={Boolean(messages)}
          describedBy={messages ? errorId : undefined}
          disabled={disabled}
          sx={{ width: (t) => t.spacing(10) }}
        />
        <Select<DurationUnit>
          label="Unit"
          ariaLabel={`${label} unit`}
          value={value.unit}
          options={UNITS}
          onChange={(unit) => onChange({ ...value, unit })}
          error={Boolean(messages)}
          disabled={disabled}
          sx={{ width: (t) => t.spacing(15) }}
        />
        <Typography
          variant="caption"
          sx={{ flex: 1, minWidth: (t) => t.spacing(20), color: 'text.secondary' }}
        >
          {after}
        </Typography>
      </Box>
      <ErrorLines id={errorId} messages={messages} />
    </Box>
  );
}

export default function SettingsTab({
  value,
  onChange,
  errors,
  options,
  readOnly,
}: SettingsTabProps) {
  const api = useApi();
  const searchHouseAccounts = useCallback(
    (query: string, signal: AbortSignal) => api.systemSettings.listHouseAccounts(query, { signal }),
    [api],
  );
  const set = <K extends keyof SystemSettings>(key: K, v: SystemSettings[K]) =>
    onChange({ ...value, [key]: v });
  // Times change the late checkout options, so the late time follows into range.
  const setTime = (key: 'checkInTime' | 'checkOutTime', v: string) =>
    onChange(withLateCheckoutInRange({ ...value, [key]: v }));
  const lateOptions = lateCheckoutOptions(value.checkOutTime, value.checkInTime).map((t) => ({
    value: t,
    label: formatTime12(t),
  }));
  const timeField = (field: 'checkInTime' | 'checkOutTime', label: string) => (
    <TextField
      id={fieldId(field)}
      type="time"
      label={label}
      value={value[field]}
      onChange={(e) => setTime(field, e.target.value)}
      error={Boolean(errors[field])}
      helperText={errors[field]?.[0]}
      disabled={readOnly}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { step: TIME_STEP_MINUTES * 60 },
      }}
      sx={{ flex: 1, minWidth: (t) => t.spacing(20) }}
    />
  );
  const altRate = (key: 'alternativeBaseRate1' | 'alternativeBaseRate2', n: 1 | 2) => {
    const rate = value[key];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ToggleRow
            disabled={readOnly}
            label={`Enable Alternative Base Rate ${n}`}
            checked={rate.enabled}
            onChange={(enabled) => set(key, { ...rate, enabled })}
          />
          {rate.enabled ? (
            <>
              <NightsStepper
                id={fieldId(key)}
                disabled={readOnly}
                label={`Alternative Base Rate ${n} nights`}
                value={rate.minNights}
                min={ALT_RATE_NIGHTS.min}
                max={ALT_RATE_NIGHTS.max}
                onChange={(minNights) => set(key, { ...rate, minNights })}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                or more nights
              </Typography>
            </>
          ) : null}
        </Box>
        <ErrorLines id={`${fieldId(key)}-error`} messages={errors[key]} />
      </Box>
    );
  };
  const readerOptions = options.cardReaders.map((r) => ({ value: r.id, label: r.label }));

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
      <Box sx={column}>
        <Section title="Time Zone">
          <Select
            fullWidth
            disabled={readOnly}
            label="Time Zone"
            value={value.timeZone}
            options={options.timeZones.map((z) => ({ value: z.id, label: z.label }))}
            onChange={(v) => set('timeZone', v)}
          />
        </Section>

        <Section title="Check In / Check Out Times">
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {timeField('checkInTime', 'Check In Time')}
            {timeField('checkOutTime', 'Checkout Time')}
          </Box>
          <ToggleRow
            disabled={readOnly}
            label="Enable Early Check In and Late Check Out"
            checked={value.earlyLateEnabled}
            onChange={(v) => set('earlyLateEnabled', v)}
            description="If a reservation has Late Checkout selected, the room(s) will automatically be checked out at the Late Checkout Time instead of the standard Checkout Time."
          >
            <Select
              disabled={readOnly}
              id={fieldId('lateCheckOutTime')}
              label="Late Checkout Time"
              value={
                lateOptions.some((o) => o.value === value.lateCheckOutTime)
                  ? value.lateCheckOutTime
                  : ''
              }
              options={lateOptions}
              onChange={(v) => set('lateCheckOutTime', v)}
              error={Boolean(errors.lateCheckOutTime)}
              helperText={errors.lateCheckOutTime?.[0]}
              sx={{ minWidth: (t) => t.spacing(25) }}
            />
          </ToggleRow>
        </Section>

        <Section title="Mobile POS Visibility">
          <Hint>
            When a Folio is visible in MPOS, it will be displayed in the MPOS Room Charge list and
            tickets can be settled to the Reservation Folio. This setting allows for Folios to be
            charged for a period of time before and after the reservation is checked in or out.
          </Hint>
          <DurationRow
            field="mposVisibleBefore"
            label="Folio becomes visible"
            before="Folio becomes visible"
            value={value.mposVisibleBefore}
            onChange={(v) => set('mposVisibleBefore', v)}
            errors={errors}
            disabled={readOnly}
            after="before system check in time on the day of check in"
          />
          <DurationRow
            field="mposVisibleAfter"
            label="Folio is no longer visible"
            before="Folio is no longer visible"
            value={value.mposVisibleAfter}
            onChange={(v) => set('mposVisibleAfter', v)}
            errors={errors}
            disabled={readOnly}
            after="after system checkout time on the day of checkout"
          />
        </Section>

        <Section title="Close Settled Folios">
          <Hint>
            A Folio automatically closes once the reservation has been checked out and settled with
            a balance of $0. This setting determines when the automatic folio close will take place
            after the checkout time. Note: This value must be larger than the MPOS Visibility
            setting after checkout.
          </Hint>
          <DurationRow
            field="closeSettledFolios"
            label="Close Settled Folios"
            value={value.closeSettledFolios}
            onChange={(v) => set('closeSettledFolios', v)}
            errors={errors}
            disabled={readOnly}
            after="after system checkout time"
          />
        </Section>
      </Box>

      <Box sx={column}>
        <FormControl component="fieldset" variant="standard" disabled={readOnly}>
          <FormLabel
            component="legend"
            sx={{ typography: 'settings_heading', color: 'text.secondary', mb: 1 }}
          >
            Night Audit
          </FormLabel>
          <RadioGroup
            value={value.nightAudit}
            onChange={(e) => set('nightAudit', e.target.value as SystemSettings['nightAudit'])}
          >
            <FormControlLabel value="manual" control={<Radio />} label="Run Manually" />
            <FormControlLabel
              value="automatic"
              control={
                <Radio
                  slotProps={{
                    input: {
                      'aria-describedby': value.trainingMode
                        ? 'training-mode-audit-note'
                        : undefined,
                    },
                  }}
                />
              }
              label="Run Automatically"
              disabled={value.trainingMode}
            />
          </RadioGroup>
          {value.trainingMode ? (
            <Hint id="training-mode-audit-note">{TRAINING_MODE_AUDIT_MESSAGE}</Hint>
          ) : null}
          {value.nightAudit === 'automatic' ? (
            <TextField
              id={fieldId('nightAuditRunTime')}
              type="time"
              label="Daily Run Time"
              value={value.nightAuditRunTime}
              onChange={(e) => set('nightAuditRunTime', e.target.value)}
              disabled={readOnly}
              error={Boolean(errors.nightAuditRunTime)}
              helperText={errors.nightAuditRunTime?.[0]}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { step: TIME_STEP_MINUTES * 60 },
              }}
              sx={{ mt: 1, ml: 4, width: (t) => t.spacing(25) }}
            />
          ) : null}
        </FormControl>

        <Section title="Alternative Base Rates">
          {altRate('alternativeBaseRate1', 1)}
          {altRate('alternativeBaseRate2', 2)}
        </Section>

        <Section title="Credit Card Options">
          <ToggleRow
            disabled={readOnly}
            label="Enable Credit Card Authorization"
            checked={value.creditCardAuthorization}
            onChange={(v) => set('creditCardAuthorization', v)}
            description="When enabled, new credit cards added will be authorized for $0.01."
          />
          <ToggleRow
            disabled={readOnly}
            label="Enable Card Present Transactions"
            checked={value.cardPresentEnabled}
            onChange={(v) => set('cardPresentEnabled', v)}
            description="When enabled, new credit cards can be added via card reader or manually. If disabled, only manual entry will be available."
          >
            <Select
              fullWidth
              disabled={readOnly}
              label="Default Card Reader"
              value={value.defaultCardReaderId ?? ''}
              options={readerOptions}
              onChange={(v) => set('defaultCardReaderId', v)}
            />
          </ToggleRow>
        </Section>

        <FormControl component="fieldset" variant="standard" disabled={readOnly}>
          <FormLabel
            component="legend"
            sx={{ typography: 'settings_heading', color: 'text.secondary', mb: 1 }}
          >
            Rate Change Handling
          </FormLabel>
          <Typography id="rate-change-intro" variant="settings_body">
            When Rate Category rates are changed, existing reservations will:
          </Typography>
          <RadioGroup
            aria-describedby="rate-change-intro"
            value={value.rateChangeHandling}
            onChange={(e) =>
              set('rateChangeHandling', e.target.value as SystemSettings['rateChangeHandling'])
            }
          >
            <FormControlLabel
              value="time-of-booking"
              control={<Radio />}
              label="Utilize rates from time of booking"
            />
            <FormControlLabel
              value="time-of-stay"
              control={<Radio />}
              label="Utilize rates from time of stay"
            />
          </RadioGroup>
        </FormControl>

        <Section title="Member Owners">
          <ToggleRow
            disabled={readOnly}
            label="Enable Room Owner Field"
            checked={value.roomOwnerFieldEnabled}
            onChange={(v) => set('roomOwnerFieldEnabled', v)}
          />
        </Section>

        <Section title="Service Charge Label">
          <TextField
            id={fieldId('serviceChargeLabel')}
            label="Label"
            value={value.serviceChargeLabel}
            onChange={(e) => set('serviceChargeLabel', e.target.value)}
            disabled={readOnly}
            error={Boolean(errors.serviceChargeLabel)}
            helperText={
              <>
                {errors.serviceChargeLabel?.[0] ? (
                  <Box component="span" sx={{ display: 'block' }}>
                    {errors.serviceChargeLabel[0]}
                  </Box>
                ) : null}
                <Box component="span" sx={{ display: 'block', textAlign: 'right' }}>
                  {`${value.serviceChargeLabel.length} / ${SERVICE_CHARGE_LABEL_MAX}`}
                </Box>
              </>
            }
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { maxLength: SERVICE_CHARGE_LABEL_MAX },
            }}
          />
        </Section>

        <Section title="Transfer Item">
          <LookupField
            disabled={readOnly}
            id="system-settings-transferItem"
            label="Item | SKU"
            value={value.transferItem}
            options={options.items}
            onChange={(v) => set('transferItem', v)}
          />
        </Section>
        <Section title="Guest Rooms Area">
          <LookupField
            disabled={readOnly}
            id="system-settings-guestRoomsArea"
            label="Area"
            value={value.guestRoomsArea}
            options={options.areas}
            onChange={(v) => set('guestRoomsArea', v)}
          />
        </Section>
        <Section title="Guest Member">
          <LookupField
            disabled={readOnly}
            id="system-settings-guestMember"
            label="Guest Member"
            value={value.guestMember}
            options={options.members}
            onChange={(v) => set('guestMember', v)}
          />
        </Section>
        <Section title="House Account">
          <LookupField
            id={fieldId('houseAccount')}
            label="House Account"
            placeholder="House Account Name"
            noOptionsText="No house accounts found"
            value={value.houseAccount}
            onChange={(v) => set('houseAccount', v)}
            search={searchHouseAccounts}
            error={errors.houseAccount?.[0]}
            disabled={readOnly}
          />
        </Section>
      </Box>
    </Box>
  );
}
