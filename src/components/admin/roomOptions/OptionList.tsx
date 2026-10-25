import AddCircleOutlineOutlined from '@mui/icons-material/AddCircleOutlineOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ROOM_OPTION_COPY,
  ROOM_OPTION_MAX,
  type RoomOptionDraft,
  type RoomOptionKind,
} from '../../../app/featureBedOptions';
import RemoveIconButton from '../../shared/RemoveIconButton';

export const optionFieldId = (kind: RoomOptionKind, key: string) => `room-option-${kind}-${key}`;
export const addButtonId = (kind: RoomOptionKind) => `room-option-add-${kind}`;

export interface OptionListProps {
  kind: RoomOptionKind;
  items: readonly RoomOptionDraft[];
  /** One message per item (aligned), shown once the admin has tried to save. */
  errors: readonly (string | undefined)[];
  onChange: (key: string, label: string) => void;
  onRemove: (item: RoomOptionDraft) => void;
  onAdd: () => void;
}

// One editable list of Room Options (legacy RoomOptionsEdit tabs "Features" and "Bed Sizes"): a
// text field per item with a character counter, Remove per item and one Add button at the end.
export default function OptionList({
  kind,
  items,
  errors,
  onChange,
  onRemove,
  onAdd,
}: OptionListProps) {
  const copy = ROOM_OPTION_COPY[kind];
  return (
    <Box>
      {items.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No {copy.title.toLowerCase()} yet. Use "{copy.add}" to create the first one.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mb: 2 }}>
          {items.map((item, index) => {
            const error = errors[index];
            return (
              <Box
                component="li"
                key={item.key}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}
              >
                <TextField
                  id={optionFieldId(kind, item.key)}
                  label={`${copy.singular} ${index + 1}`}
                  value={item.label}
                  onChange={(e) => onChange(item.key, e.target.value)}
                  error={Boolean(error)}
                  helperText={
                    <>
                      {error ? (
                        <Box component="span" sx={{ display: 'block' }}>
                          {error}
                        </Box>
                      ) : null}
                      <span>{`${item.label.length}/${ROOM_OPTION_MAX}`}</span>
                    </>
                  }
                  slotProps={{ htmlInput: { maxLength: ROOM_OPTION_MAX } }}
                  sx={(t) => ({ width: '100%', maxWidth: t.spacing(75) })}
                />
                <RemoveIconButton
                  label={item.label.trim() || `new ${copy.singular.toLowerCase()}`}
                  onClick={() => onRemove(item)}
                  sx={{ mt: 1 }}
                />
              </Box>
            );
          })}
        </Box>
      )}
      <Button id={addButtonId(kind)} startIcon={<AddCircleOutlineOutlined />} onClick={onAdd}>
        {copy.add}
      </Button>
    </Box>
  );
}
