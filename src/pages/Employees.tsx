import AddCircle from '@mui/icons-material/AddCircle';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import { EMPLOYEE_ROLES } from '../app/employees';
import {
  blankNewEmployee,
  canSave,
  hasUnsaved,
  isOnlyAdministrator,
  pruneEdits,
  removeControl,
  roleOf,
  saveInputs,
  setRole,
  validateNewEmployee,
  VALIDATION_MESSAGE,
  type NewEmployeeRow,
  type RoleEdits,
} from '../app/employeesLegacy';
import { useLeaveGuard } from '../app/useLeaveGuard';
import { useReadOnly } from '../app/readOnlyContext';
import AdminShell from '../components/admin/AdminShell';
import LegacyRemoveDialog from '../components/admin/employees/LegacyRemoveDialog';
import {
  useEmployeesData,
  type EmployeesData,
} from '../components/admin/employees/useEmployeesData';
import LookupField from '../components/admin/systemSettings/LookupField';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import NonActionableDialog from '../components/shared/NonActionableDialog';
import RemoveIconButton from '../components/shared/RemoveIconButton';
import SaveButton from '../components/shared/SaveButton';
import SaveToast from '../components/shared/SaveToast';
import Select from '../components/shared/Select';

const ADD_BUTTON_ID = 'employees-add';
const ROLE_OPTIONS = EMPLOYEE_ROLES.map((r) => ({ value: r.id, label: r.label }));
const rowGrid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 3fr) auto' },
  gap: 2,
  alignItems: 'start',
  listStyle: 'none',
} as const;

// Employees (Admin Setup, LP-A.4 / ticket 185), matching the legacy EmployeesEdit screen: one row per
// employee (Name, Employee Type, Remove), Add Employee from the club directory, one Save for the
// changed types and the new employee. The richer variant (permission set, Active, list and form) is
// kept at /admin/employees-extended in development builds (pages/EmployeesExtended.tsx).
export default function Employees() {
  const data = useEmployeesData({ withPermissionSets: false });
  if (data.status !== 'ready') {
    return (
      <AdminShell active="Employees" title="Employees" changeLog="employees">
        {data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.reload}>
                Retry
              </Button>
            }
          >
            Employees could not be loaded.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Loading Employees" />
          </Box>
        )}
      </AdminShell>
    );
  }
  return <EmployeesEditor data={data} />;
}

function EmployeesEditor({ data }: { data: EmployeesData }) {
  const api = useApi();
  const readOnly = useReadOnly();
  const saved = data.employees;
  const [edits, setEdits] = useState<RoleEdits>({});
  const [adding, setAdding] = useState<NewEmployeeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const focusAfterRender = useRef<string | null>(null);

  const dirty = !readOnly && hasUnsaved(edits, adding);
  const guard = useLeaveGuard(dirty);
  const candidates = useMemo(() => data.candidates, [data.candidates]);

  useEffect(() => {
    const id = focusAfterRender.current;
    if (id === null) return;
    focusAfterRender.current = null;
    document.getElementById(id)?.focus();
  }, [adding, saved]);

  const save = async (): Promise<boolean> => {
    if (readOnly) return false;
    const errors = validateNewEmployee(adding);
    if (errors.length > 0) {
      setProblems(errors);
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.employees.saveRoles(saveInputs(saved, edits, adding));
      // The change is stored; a failed refresh falls back to the list the save answered with.
      await data.refresh().catch(() => data.patch(() => stored));
      setEdits({});
      setAdding(null);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 409
          ? 'The club needs at least one active administrator. Reload the page and try again.'
          : error instanceof ApiError && error.status === 422
            ? 'Some employees are not valid. Reload the page and try again.'
            : 'Employees could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    const id = removeId;
    if (id === null) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await api.employees.remove(id);
    } catch (error) {
      // Already gone (another session removed it): fall through to the refresh.
      if (!(error instanceof ApiError && error.status === 404)) {
        setRemoveError(
          error instanceof ApiError && error.status === 409
            ? 'The club needs at least one active administrator. Reload the page and try again.'
            : error instanceof ApiError && error.status === 403
              ? 'You may not remove employees.'
              : 'The employee could not be removed. Try again.',
        );
        setRemoveBusy(false);
        return;
      }
    }
    const gone = (list: typeof saved) => list.filter((e) => e.id !== id);
    await data.refresh().catch(() => data.patch(gone));
    // Other rows keep their unsaved type changes (the legacy reload kept the update list).
    setEdits((e) => pruneEdits(gone(saved), e));
    setRemoveId(null);
    setRemoveBusy(false);
    focusAfterRender.current = ADD_BUTTON_ID;
  };

  const saveButton = readOnly ? undefined : (
    <SaveButton
      dirty={canSave(edits, adding)}
      saving={saving}
      noun="Employees"
      onClick={() => void save()}
    />
  );

  return (
    <AdminShell active="Employees" title="Employees" actions={saveButton} changeLog="employees">
      {saveError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      ) : null}
      {readOnly && saved.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>No employees.</Typography>
      ) : null}
      <Box
        component="ul"
        aria-label="Employees"
        sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {saved.map((e) => {
          const only = isOnlyAdministrator(saved, edits, e.id);
          const control = removeControl(saved, edits, e.id, adding !== null);
          const noteId = `employee-${e.id}-note`;
          return (
            <Box component="li" key={e.id} role="group" aria-label={e.name} sx={rowGrid}>
              <TextField
                label="Name"
                value={e.name}
                slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
                fullWidth
              />
              <Box>
                <Select
                  label="Employee Type"
                  ariaLabel={`Employee Type, ${e.name}`}
                  value={roleOf(e, edits)}
                  options={ROLE_OPTIONS}
                  onChange={(role) => setEdits(setRole(saved, edits, e.id, role))}
                  disabled={only}
                  describedBy={only ? noteId : undefined}
                  fullWidth
                />
                {only ? (
                  <Box component="span" id={noteId} sx={visuallyHidden}>
                    The only administrator. Make another employee an administrator to change this.
                  </Box>
                ) : null}
              </Box>
              {control === 'hidden' ? (
                // Keeps the column, so the types line up in every row.
                <Box
                  aria-hidden
                  sx={{ display: { xs: 'none', md: 'block' }, width: (t) => t.spacing(5) }}
                />
              ) : (
                <RemoveIconButton
                  label={e.name}
                  onClick={() => {
                    setRemoveError(null);
                    setRemoveId(e.id);
                  }}
                  disabled={control === 'disabled'}
                  disabledReason={
                    adding ? 'Finish or cancel the new employee first' : 'A club needs an employee'
                  }
                  sx={{ mt: { md: 1 } }}
                />
              )}
            </Box>
          );
        })}
        {adding ? (
          <Box component="li" role="group" aria-label="New employee" sx={rowGrid}>
            <LookupField
              id="employees-new-person"
              label="Add Employee"
              value={adding.person}
              options={candidates}
              onChange={(person) => setAdding({ ...adding, person })}
              noOptionsText="No one else in the club directory"
            />
            <Select
              id="employees-new-role"
              label="Employee Type"
              ariaLabel="Employee Type, new employee"
              value={adding.role ?? ''}
              options={ROLE_OPTIONS}
              onChange={(role) => setAdding({ ...adding, role })}
              fullWidth
            />
            <RemoveIconButton
              label="new employee"
              onClick={() => {
                setAdding(null);
                focusAfterRender.current = ADD_BUTTON_ID;
              }}
              sx={{ mt: { md: 1 } }}
            />
          </Box>
        ) : null}
      </Box>
      {readOnly || adding ? null : (
        <Button
          id={ADD_BUTTON_ID}
          startIcon={<AddCircle />}
          onClick={() => {
            setAdding(blankNewEmployee());
            focusAfterRender.current = 'employees-new-person';
          }}
          sx={{ mt: 3 }}
        >
          Add Employee
        </Button>
      )}
      <NonActionableDialog
        open={problems !== null}
        onClose={() => setProblems(null)}
        title="Validation Error(s)"
      >
        <Typography sx={{ mb: 1 }}>{VALIDATION_MESSAGE}</Typography>
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {(problems ?? []).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </Box>
      </NonActionableDialog>
      <LegacyRemoveDialog
        open={removeId !== null}
        busy={removeBusy}
        error={removeError}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => void confirmRemove()}
      />
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Employees have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Employees Saved"
      />
    </AdminShell>
  );
}
