import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, useApi } from '../api';
import { setsDirty, type PermissionSet } from '../app/permissionSets';
import { useReadOnly } from '../app/readOnlyContext';
import { useLeaveGuard } from '../app/useLeaveGuard';
import AdminShell from '../components/admin/AdminShell';
import PermissionsTable from '../components/admin/permissions/PermissionsTable';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveButton from '../components/shared/SaveButton';
import SaveToast from '../components/shared/SaveToast';

// Permissions (Admin Setup, ticket 186): what Management and Staff may do. There is no Figma frame
// and the owner's screenshots were not available; the layout follows the Admin Setup shell, the
// Booking Rules matrix and the legacy Permissions screen. Administrators always hold everything.
export default function Permissions() {
  const api = useApi();
  const readOnly = useReadOnly();
  const [saved, setSaved] = useState<PermissionSet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Edits made on top of the saved sets; null while untouched.
  const [edits, setEdits] = useState<PermissionSet[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });

  useEffect(() => {
    const controller = new AbortController();
    api.permissions
      .getPermissionSets({ signal: controller.signal })
      .then((sets) => {
        if (!controller.signal.aborted) setSaved(sets);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [api, attempt]);

  const draft = edits ?? saved;
  const dirty = !readOnly && Boolean(saved && draft && setsDirty(saved, draft));
  const guard = useLeaveGuard(dirty);

  const save = useCallback(async (): Promise<boolean> => {
    // Nothing to save in View-only mode (the button is gone; this guards the Enter key and the leave prompt).
    if (readOnly) return false;
    if (!draft) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.permissions.savePermissionSets(draft);
      setSaved(stored);
      setEdits(null);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 403
          ? 'You do not have permission to change permissions.'
          : error instanceof ApiError && error.status === 422
            ? 'Some permission sets are not valid. Reload the page and try again.'
            : 'Permissions could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, draft, readOnly]);

  const saveButton = (
    <SaveButton dirty={dirty} saving={saving} noun="Permissions" onClick={() => void save()} />
  );

  const body = useMemo(() => {
    if (failed) {
      return (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              Retry
            </Button>
          }
        >
          Permissions could not be loaded.
        </Alert>
      );
    }
    if (!draft) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Loading Permissions" />
        </Box>
      );
    }
    if (draft.length === 0) {
      return <Typography color="text.secondary">There are no permission sets to edit.</Typography>;
    }
    return <PermissionsTable sets={draft} onChange={setEdits} />;
  }, [failed, draft]);

  return (
    <AdminShell active="Permissions" title="Permissions" actions={saveButton}>
      {saveError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      ) : null}
      <Typography sx={{ mb: 3, color: 'text.secondary' }}>
        All Admins are granted all permissions by default in the system.
      </Typography>
      {body}
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Permissions have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        autoHideDuration={10_000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Permissions Saved"
      />
    </AdminShell>
  );
}
