import ContentCopy from '@mui/icons-material/ContentCopyOutlined';
import Delete from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

export interface SetupActionsProps {
  /** "room type" or "room". */
  noun: string;
  saveLabel: string;
  /** A new, unsaved item: delete and duplicate do not apply, Cancel does (PDF 8.5.5). */
  creating: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
}

// Header actions (Figma 11964:13723): delete (red), duplicate, then the primary save button.
export default function SetupActions({
  noun,
  saveLabel,
  creating,
  saving,
  onSave,
  onDelete,
  onDuplicate,
  onCancel,
}: SetupActionsProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {creating ? (
        <Button variant="text" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
      ) : (
        <>
          <IconButton aria-label={`Delete ${noun}`} color="error" onClick={onDelete}>
            <Delete />
          </IconButton>
          <IconButton aria-label={`Duplicate ${noun}`} color="primary" onClick={onDuplicate}>
            <ContentCopy />
          </IconButton>
        </>
      )}
      <Button variant="contained" size="large" disabled={saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </Box>
  );
}
