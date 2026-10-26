import { useReadOnly } from '../app/readOnlyContext';
import AddCircle from '@mui/icons-material/AddCircle';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { ApiError, useApi } from '../api';
import type { LocationInput } from '../api/types';
import {
  blankLocation,
  canRemoveRow,
  checkRemoveLocation,
  firstLocationError,
  locationsDirty,
  normalizeLocations,
  toLocationInput,
  validateLocations,
  type RemovalCheck,
} from '../app/locations';
import { adminPageLevel } from '../app/access';
import { ROOM_TYPES_PATH } from '../app/routes';
import { useAccess } from '../app/useAccess';
import { useLeaveGuard } from '../app/useLeaveGuard';
import { newRequestId } from '../lib/requestId';
import AdminShell from '../components/admin/AdminShell';
import LocationRow, { locationFieldId } from '../components/admin/locations/LocationRow';
import { useLocationsData } from '../components/admin/locations/useLocationsData';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import NonActionableDialog from '../components/shared/NonActionableDialog';
import SaveToast from '../components/shared/SaveToast';
import SaveButton from '../components/shared/SaveButton';

const ADD_BUTTON_ID = 'locations-add';

// Locations (Admin Setup, tickets 182 and 123): the club's locations, each tied to an area. There is
// no Figma frame; the layout follows the Admin Setup shell and the legacy LocationsEdit screen.
export default function Locations() {
  const data = useLocationsData();
  let body;
  if (data.status === 'error') {
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={data.reload}>
            Retry
          </Button>
        }
      >
        Locations could not be loaded.
      </Alert>
    );
  } else if (data.status === 'loading') {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading Locations" />
      </Box>
    );
  }
  if (body) {
    return (
      <AdminShell active="Locations" title="Locations" changeLog="locations">
        {body}
      </AdminShell>
    );
  }
  return <LocationsEditor data={data} />;
}

function LocationsEditor({ data }: { data: ReturnType<typeof useLocationsData> }) {
  const api = useApi();
  const { can } = useAccess();
  // View-only from the route (ticket 186), or a level below Edit when the page is rendered without the route guard.
  const viewOnly = useReadOnly();
  const readOnly = viewOnly || adminPageLevel(can, 'locations') !== 'edit';
  const saved = useMemo(() => data.locations.map(toLocationInput), [data.locations]);
  // A new club starts with one blank row.
  const [draft, setDraft] = useState<LocationInput[]>(() =>
    saved.length > 0 ? saved : [blankLocation(newRequestId())],
  );
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [blocked, setBlocked] = useState<RemovalCheck | null>(null);
  const focusAfterRender = useRef<string | null>(null);

  const dirty = !readOnly && locationsDirty(saved, draft);
  const guard = useLeaveGuard(dirty);
  const errors = useMemo(() => (attempted ? validateLocations(draft) : {}), [attempted, draft]);

  useEffect(() => {
    const id = focusAfterRender.current;
    if (id === null) return;
    focusAfterRender.current = null;
    document.getElementById(id)?.focus();
  }, [draft]);

  const change = (row: LocationInput) =>
    setDraft((rows) => rows.map((r) => (r.id === row.id ? row : r)));

  const add = () => {
    const row = blankLocation(newRequestId());
    focusAfterRender.current = locationFieldId(row.id, 'name');
    setDraft((rows) => [...rows, row]);
  };

  const remove = (row: LocationInput) => {
    const location = data.locations.find((l) => l.id === row.id);
    const check = location ? checkRemoveLocation(location.usage) : null;
    if (check && !check.allowed) {
      setBlocked(check);
      return;
    }
    focusAfterRender.current = ADD_BUTTON_ID;
    setDraft((rows) => rows.filter((r) => r.id !== row.id));
  };

  const save = useCallback(async (): Promise<boolean> => {
    // Nothing to save in View-only mode (the button is gone; this guards the Enter key and the leave prompt).
    if (readOnly) return false;
    const found = validateLocations(draft);
    const first = firstLocationError(draft, found);
    if (first) {
      setAttempted(true);
      document.getElementById(locationFieldId(first.id, first.field))?.focus();
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.locations.save(normalizeLocations(draft));
      data.setLocations(stored);
      setDraft(stored.map(toLocationInput));
      setAttempted(false);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some locations are not valid. Check the highlighted fields.'
          : error instanceof ApiError && error.status === 409
            ? 'A location that is in use by room types or rooms cannot be removed. Reload the page and try again.'
            : 'Locations could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, data, draft, readOnly]);

  const saveButton = readOnly ? undefined : (
    <SaveButton dirty={dirty} saving={saving} noun="Locations" onClick={() => void save()} />
  );

  return (
    <AdminShell active="Locations" title="Locations" actions={saveButton} changeLog="locations">
      {readOnly && !viewOnly ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Locations are read-only. Contact Clubessential to change them.
        </Alert>
      ) : null}
      {saveError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      ) : null}
      <Typography sx={{ mb: 3, color: 'text.secondary' }}>
        Each location is tied to an area, which routes its revenue to the right GL account.
      </Typography>
      <Box
        component="ul"
        aria-label="Locations"
        sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {draft.map((row, i) => (
          <LocationRow
            key={row.id}
            index={i + 1}
            row={row}
            areas={data.areas}
            errors={errors[row.id]}
            readOnly={readOnly}
            removable={canRemoveRow(draft.length)}
            onChange={change}
            onRemove={() => remove(row)}
          />
        ))}
      </Box>
      {readOnly ? null : (
        <Button id={ADD_BUTTON_ID} startIcon={<AddCircle />} onClick={add} sx={{ mt: 3 }}>
          Add Location
        </Button>
      )}
      <NonActionableDialog
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="Unable to Remove Location"
      >
        <Typography sx={{ mb: 2 }}>{blocked?.reason}</Typography>
        {blocked && blocked.roomTypes.length > 0 ? (
          <Typography sx={{ mb: 2 }}>
            Room types to adjust: {blocked.roomTypes.join(', ')}
          </Typography>
        ) : null}
        <Button component={RouterLink} to={ROOM_TYPES_PATH} variant="contained">
          Adjust Room Types
        </Button>
      </NonActionableDialog>
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Locations have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        autoHideDuration={10_000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Locations Saved"
      />
    </AdminShell>
  );
}
