import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, useApi } from '../api';
import {
  blankEmployee,
  employeeSummary,
  EMPLOYEE_FIELD_ORDER,
  EMPLOYEE_ROLES,
  lastAdministratorProblem,
  needsPermissionSet,
  sortEmployees,
  toEmployeeDraft,
  toEmployeeInput,
  validateEmployee,
  withRole,
  type EmployeeField,
} from '../app/employees';
import { useReadOnly } from '../app/readOnlyContext';
import AdminShell from '../components/admin/AdminShell';
import RemoveEmployeeDialog from '../components/admin/employees/RemoveEmployeeDialog';
import {
  useEmployeesData,
  type EmployeesData,
} from '../components/admin/employees/useEmployeesData';
import SetupActions from '../components/admin/roomSetup/SetupActions';
import SetupList from '../components/admin/roomSetup/SetupList';
import { focusField, useSetupEditor } from '../components/admin/roomSetup/useSetupEditor';
import LookupField from '../components/admin/systemSettings/LookupField';
import ToggleRow from '../components/admin/systemSettings/ToggleRow';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';
import Select from '../components/shared/Select';

const SOLE_ADMIN_HINT =
  'This is the only active administrator. Make another employee an administrator to change this.';

const fieldDomId = (f: EmployeeField) => `employee-${f}`;

// Employees (Admin Setup, LP-A.4 / ticket 185): the list of employees on the left, the form on the
// right. There is no Figma frame; the layout follows the other setup pages and the legacy
// EmployeesEdit screen (person, employee type, remove).
export default function Employees() {
  const data = useEmployeesData();
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
  // View-only comes from the route (ReadOnlyProvider, ticket 186): no New, Save, Remove or Copy.
  const { permissionSets } = data;
  const sorted = useMemo(() => sortEmployees(data.employees), [data.employees]);
  const listEntries = useMemo(
    () => sorted.map((e) => ({ id: e.id, label: e.name, inactive: !e.active })),
    [sorted],
  );
  const editor = useSetupEditor({ items: sorted, toDraft: toEmployeeDraft, blank: blankEmployee });
  const { draft, creating } = editor;
  const setDraft = (next: typeof draft) => {
    setSaveError(null);
    editor.setDraft(next);
  };
  const errors = editor.attempted ? validateEmployee(draft, { creating, permissionSets }) : {};
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [removing, setRemoving] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  // A message belongs to the item it was shown for: another selection, New or Cancel clears it.
  useEffect(() => setSaveError(null), [editor.selectedId, editor.creating]);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const save = async (): Promise<boolean> => {
    // Nothing to save in View-only mode (guards the Enter key and the leave prompt).
    if (readOnly) return false;
    const found = validateEmployee(draft, { creating, permissionSets });
    const first = EMPLOYEE_FIELD_ORDER.find((f) => found[f]);
    const input = toEmployeeInput(draft);
    if (first || !input) {
      editor.setAttempted(true);
      focusField(fieldDomId(first ?? 'person'));
      return false;
    }
    const last = lastAdministratorProblem(data.employees, input.id, input);
    if (last) {
      setSaveError(last);
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.employees.save(input);
      // The employee is stored; a failed list refresh must not read as a failed save.
      await data
        .refresh()
        .catch(() =>
          data.patch((list) =>
            list.some((e) => e.id === stored.id)
              ? list.map((e) => (e.id === stored.id ? stored : e))
              : [...list, stored],
          ),
        );
      editor.afterSave(stored.id);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some fields are not valid. Check the highlighted fields.'
          : error instanceof ApiError && error.status === 409
            ? 'The club needs at least one active administrator. Reload the page and try again.'
            : 'The employee could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const blockedReason = editor.selected
    ? lastAdministratorProblem(data.employees, editor.selected.id, null)
    : null;

  const confirmRemove = async () => {
    const target = editor.selected;
    if (!target) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await api.employees.remove(target.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone (another session removed it): refresh and close.
        await data
          .refresh()
          .catch(() => data.patch((list) => list.filter((e) => e.id !== target.id)));
        setRemoving(false);
        setRemoveBusy(false);
        editor.afterDelete();
        return;
      }
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
    await data.refresh().catch(() => data.patch((list) => list.filter((e) => e.id !== target.id)));
    setRemoving(false);
    setRemoveBusy(false);
    editor.afterDelete();
  };

  const isAdministrator = !needsPermissionSet(draft.role);
  // Legacy: the only active administrator cannot be changed, so the edit is not offered at all.
  const soleAdmin =
    editor.selected !== undefined &&
    lastAdministratorProblem(data.employees, editor.selected.id, {
      role: 'staff',
      active: true,
    }) !== null;
  const title = editor.selected?.name ?? 'New Employee';
  return (
    <AdminShell
      active="Employees"
      title={title}
      changeLog="employees"
      sidebarLabel="Employees"
      sidebar={
        <SetupList
          items={listEntries}
          selectedId={editor.selectedId}
          creating={editor.creating}
          newLabel="New Employee"
          newTitle="New Employee"
          onSelect={editor.select}
          onNew={editor.startNew}
          more={{
            noun: 'Employee',
            changeLogPage: 'employees',
            deleteLabel: 'Remove Employee',
            onDelete: () => {
              setRemoveError(null);
              setRemoving(true);
            },
          }}
        />
      }
      actions={
        <SetupActions
          saveNoun="Employee"
          creating={editor.creating}
          dirty={editor.dirty}
          saving={saving}
          onSave={() => void save()}
          onCancel={editor.cancelNew}
        />
      }
    >
      {saveError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      ) : null}
      {data.employees.length === 0 ? (
        <Typography sx={{ mb: 3, color: 'text.secondary' }}>
          {readOnly
            ? 'No employees.'
            : 'No employees have access yet. Choose a person from the club directory to add one.'}
        </Typography>
      ) : null}
      {editor.selected ? (
        <Typography sx={{ mb: 3, color: 'text.secondary' }}>
          {employeeSummary(editor.selected, permissionSets)}
          {editor.selected.active ? '' : ', Inactive'}
        </Typography>
      ) : null}
      {readOnly && data.employees.length === 0 ? null : (
        <Box
          component="form"
          noValidate
          aria-label="Employee"
          onSubmit={(e) => {
            e.preventDefault();
            if (!readOnly) void save();
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 480 }}
        >
          <Box id={fieldDomId('person')}>
            {creating ? (
              <LookupField
                id="employee-person-input"
                label="Employee"
                value={draft.person}
                options={data.candidates}
                onChange={(person) => setDraft({ ...draft, person })}
                error={errors.person}
                disabled={readOnly}
                noOptionsText="No one else in the club directory"
                required
              />
            ) : (
              <TextField
                label="Employee"
                value={draft.person?.label ?? ''}
                slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
                fullWidth
              />
            )}
          </Box>
          <Select
            id={fieldDomId('role')}
            label="Employee Type"
            value={draft.role}
            options={EMPLOYEE_ROLES.map((r) => ({ value: r.id, label: r.label }))}
            onChange={(role) => setDraft(withRole(draft, role))}
            error={Boolean(errors.role)}
            helperText={errors.role ?? (soleAdmin ? SOLE_ADMIN_HINT : undefined)}
            disabled={readOnly || soleAdmin}
            required
            fullWidth
          />
          <Select
            id={fieldDomId('permissionSetId')}
            label="Permission Set"
            value={isAdministrator ? '' : (draft.permissionSetId ?? '')}
            options={permissionSets.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(permissionSetId) => setDraft({ ...draft, permissionSetId })}
            placeholder={isAdministrator ? 'Full access' : 'Select a permission set'}
            helperText={
              errors.permissionSetId ??
              (isAdministrator ? 'Administrators have access to everything.' : undefined)
            }
            error={Boolean(errors.permissionSetId)}
            disabled={readOnly || isAdministrator}
            required={!isAdministrator}
            fullWidth
          />
          <ToggleRow
            label="Active"
            checked={draft.active}
            onChange={(active) => setDraft({ ...draft, active })}
            description={
              soleAdmin
                ? SOLE_ADMIN_HINT
                : 'An inactive employee keeps their settings but cannot sign in.'
            }
            disabled={readOnly || soleAdmin}
          />
        </Box>
      )}
      <RemoveEmployeeDialog
        target={removing && editor.selected ? { name: editor.selected.name, blockedReason } : null}
        busy={removeBusy}
        error={removeError}
        onCancel={() => setRemoving(false)}
        onRemove={() => void confirmRemove()}
      />
      <ConfirmDialog {...editor.confirmProps(save, 'This employee has not been saved.')} />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Employee Saved"
      />
    </AdminShell>
  );
}
