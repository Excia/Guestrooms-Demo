import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SaveButton from '../../shared/SaveButton';

export interface SetupActionsProps {
  /** What Save saves, e.g. "Room Type": the button reads "Save Room Type" or "Saved". */
  saveNoun: string;
  /** A new, unsaved item: delete and duplicate do not apply, Cancel does (PDF 8.5.5). */
  creating: boolean;
  /** The draft differs from what is saved. A new item always offers Save (legacy). */
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  /** Blocks saving (the form is locked while reordering). */
  disabled?: boolean;
  disabledReason?: string;
  onCancel: () => void;
}

// Header actions: Cancel on a new item, then the primary save button. Copy and Delete moved into the
// three-dot menu of the selected list row (SetupList).
export default function SetupActions({
  saveNoun,
  creating,
  dirty,
  saving,
  onSave,
  disabled,
  disabledReason,
  onCancel,
}: SetupActionsProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {creating ? (
        <Button variant="text" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
      <SaveButton
        dirty={dirty || creating}
        saving={saving}
        noun={saveNoun}
        onClick={onSave}
        disabled={disabled}
        disabledReason={disabledReason}
      />
    </Box>
  );
}
