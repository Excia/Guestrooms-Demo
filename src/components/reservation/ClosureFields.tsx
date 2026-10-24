import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import type { Ref } from 'react';
import {
  CLOSURE_DESCRIPTION_MAX,
  moveClosureStart,
  type ClosureField,
  type ClosureForm,
} from '../../app/closures';
import type { RoomOption } from '../../app/roomOptions';
import type { IsoDate } from '../../lib/dates';
import { addDays } from '../../lib/dates';
import DateField from '../shared/DateField';
import RoomAutocomplete from './RoomAutocomplete';

export interface ClosureFieldsProps {
  form: ClosureForm;
  onChange: (form: ClosureForm) => void;
  today: IsoDate;
  errors: Partial<Record<ClosureField, string>>;
  /** The conflict (found here or refused by the server), shown on the Room field. */
  roomError?: string;
  /** The Room field; the details panel fixes the room (its title names it). */
  rooms?: {
    options: readonly RoomOption[];
    loading: boolean;
    failed: boolean;
    onRetry: () => void;
  };
  disabled?: boolean;
  /** Ref of the first field, for focusing it. */
  firstFieldRef?: Ref<HTMLInputElement>;
}

/** Room, Start, End and Description (Figma has no frame for these fields yet; see figma-deviations.md). */
export default function ClosureFields({
  form,
  onChange,
  today,
  errors,
  roomError,
  rooms,
  disabled,
  firstFieldRef,
}: ClosureFieldsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rooms ? (
        <>
          <RoomAutocomplete
            options={rooms.options}
            value={form.roomId}
            onChange={(roomId) => onChange({ ...form, roomId })}
            loading={rooms.loading}
            unavailable={rooms.failed}
            error={roomError ?? errors.roomId}
            disabled={disabled}
            allowUnassigned={false}
            required
            inputRef={firstFieldRef}
          />
          {rooms.failed ? (
            <Button size="small" onClick={rooms.onRetry} sx={{ alignSelf: 'flex-start' }}>
              Retry loading rooms
            </Button>
          ) : null}
        </>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <DateField
          label="Closure Start"
          today={today}
          value={form.startDate}
          onChange={(v) => onChange(moveClosureStart(form, v))}
          error={Boolean(errors.startDate)}
          helperText={errors.startDate}
          readOnly={disabled}
          required
          inputRef={rooms ? undefined : firstFieldRef}
        />
        <DateField
          label="Closure End"
          today={today}
          value={form.endDate}
          onChange={(v) => onChange({ ...form, endDate: v })}
          error={Boolean(errors.endDate)}
          helperText={errors.endDate ?? 'The room is free again this day.'}
          readOnly={disabled}
          min={form.startDate ? addDays(form.startDate, 1) : undefined}
          required
        />
      </Box>
      <TextField
        label="Description"
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        disabled={disabled}
        error={Boolean(errors.description)}
        helperText={errors.description ?? `${form.description.length}/${CLOSURE_DESCRIPTION_MAX}`}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { maxLength: CLOSURE_DESCRIPTION_MAX },
        }}
        fullWidth
      />
    </Box>
  );
}
