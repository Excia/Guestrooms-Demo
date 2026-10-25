import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { RoomTypeInput, RoomTypeSetup } from '../api/types';
import {
  blankRoomType,
  checkDeleteRoomType,
  DESCRIPTION_MAX,
  duplicateName,
  NAME_MAX,
  sortSetupItems,
  toSetupListEntries,
  validateRoomType,
  type DeleteCheck,
  type RoomTypeField,
} from '../app/roomSetup';
import { useClubToday } from '../app/useClubToday';
import AdminShell from '../components/admin/AdminShell';
import ActiveDatesFields from '../components/admin/roomSetup/ActiveDatesFields';
import AssociationsPanel from '../components/admin/roomSetup/AssociationsPanel';
import DeleteSetupDialog from '../components/admin/roomSetup/DeleteSetupDialog';
import DetailsFields from '../components/admin/roomSetup/DetailsFields';
import PhotosField from '../components/admin/roomSetup/PhotosField';
import SetupActions from '../components/admin/roomSetup/SetupActions';
import SetupList from '../components/admin/roomSetup/SetupList';
import { focusField, useSetupEditor } from '../components/admin/roomSetup/useSetupEditor';
import {
  useRoomSetupData,
  type RoomSetupData,
} from '../components/admin/roomSetup/useRoomSetupData';
import LookupField from '../components/admin/systemSettings/LookupField';
import ToggleRow from '../components/admin/systemSettings/ToggleRow';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';

const FIELD_ORDER: RoomTypeField[] = ['name', 'startDate', 'endDate', 'description', 'photos'];
const fieldDomId = (f: RoomTypeField) => `room-type-${f}`;
const toDraft = (t: RoomTypeSetup): RoomTypeInput => t;

// Room Types (Admin Setup, ticket 7.3; Figma 11905:19464): the list on the left, the form on the
// right, associations and photos below the fields.
export default function RoomTypes() {
  const data = useRoomSetupData();
  if (data.status !== 'ready' || !data.options) {
    return (
      <AdminShell active="Room Options" title="Room Types">
        {data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.reload}>
                Retry
              </Button>
            }
          >
            Room Types could not be loaded.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Loading Room Types" />
          </Box>
        )}
      </AdminShell>
    );
  }
  return <RoomTypesEditor data={data} />;
}

function RoomTypesEditor({ data }: { data: RoomSetupData }) {
  const api = useApi();
  const options = data.options as NonNullable<RoomSetupData['options']>;
  const today = useClubToday();
  const sorted = useMemo(() => sortSetupItems(data.roomTypes, today), [data.roomTypes, today]);
  const listEntries = useMemo(() => toSetupListEntries(sorted, today), [sorted, today]);
  const editor = useSetupEditor<RoomTypeSetup, RoomTypeInput>({
    items: sorted,
    toDraft,
    blank: () => blankRoomType(today, options),
  });
  const { draft, setDraft } = editor;
  const errors = editor.attempted ? validateRoomType(draft) : {};
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [deleteCheck, setDeleteCheck] = useState<DeleteCheck | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const setDetails = (details: RoomTypeInput['details']) => setDraft({ ...draft, details });

  const save = async (): Promise<boolean> => {
    const found = validateRoomType(draft);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      editor.setAttempted(true);
      focusField(fieldDomId(first));
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.roomSetup.saveRoomType(draft);
      await data.refresh();
      editor.afterSave(stored.id);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some fields are not valid. Check the highlighted fields.'
          : 'The room type could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!editor.selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.roomSetup.deleteRoomType(editor.selected.id);
      await data.refresh();
      setDeleteCheck(null);
      editor.afterDelete();
    } catch (error) {
      setDeleteError(
        error instanceof ApiError && error.status === 409
          ? 'This room type is in use by rooms and cannot be deleted.'
          : 'The room type could not be deleted. Try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const title = editor.selected?.name ?? 'New Room Type';
  return (
    <AdminShell
      active="Room Options"
      title={title}
      changeLog="room-types"
      sidebarLabel="Room Types"
      sidebar={
        <SetupList
          items={listEntries}
          selectedId={editor.selectedId}
          creating={editor.creating}
          newLabel="New Room Type"
          newTitle="New Room Type"
          onSelect={editor.select}
          onNew={editor.startNew}
        />
      }
      actions={
        <SetupActions
          noun="room type"
          saveNoun="Room Type"
          creating={editor.creating}
          dirty={editor.dirty}
          saving={saving}
          onSave={() => void save()}
          onDelete={() => {
            setDeleteError(null);
            if (editor.selected) {
              setDeleteCheck(checkDeleteRoomType(editor.selected, data.rooms));
            }
          }}
          onDuplicate={() =>
            editor.duplicate((saved) => ({
              ...structuredClone(saved),
              id: undefined,
              name: duplicateName(saved.name),
            }))
          }
          onCancel={editor.cancelNew}
        />
      }
    >
      {saveError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          columnGap: 7,
          rowGap: 5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <TextField
            id={fieldDomId('name')}
            label="Room Type Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            error={Boolean(errors.name)}
            helperText={errors.name}
            slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
            required
            fullWidth
          />
          <ActiveDatesFields
            idPrefix="room-type"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={(v) => setDraft({ ...draft, ...v })}
            startError={errors.startDate}
            endError={errors.endDate}
          />
          <LookupField
            id="room-type-sku"
            label="SKU"
            value={draft.sku}
            options={options.skus}
            onChange={(sku) => setDraft({ ...draft, sku })}
          />
          <ToggleRow
            label="Display in Online Booking"
            checked={draft.onlineBooking}
            onChange={(onlineBooking) => setDraft({ ...draft, onlineBooking })}
          />
          <DetailsFields
            details={draft.details}
            bedSizes={options.bedSizes}
            onChange={setDetails}
            bathLabels={{ full: 'Full Bath', half: 'Half Bath' }}
          />
        </Box>
        <Box>
          <Typography sx={{ mb: 2 }}>
            <strong>Associations</strong>{' '}
            <em>(Note: Changes made will be reflected on associated items.)</em>
          </Typography>
          <AssociationsPanel
            tabs={[
              {
                id: 'features',
                label: 'Features',
                heading: 'Features',
                items: options.features,
                selected: draft.details.featureIds,
                onChange: (featureIds) => setDetails({ ...draft.details, featureIds }),
              },
              {
                id: 'add-ons',
                label: 'Add-Ons',
                heading: 'Add-Ons',
                items: options.addOns,
                selected: draft.details.addOnIds,
                onChange: (addOnIds) => setDetails({ ...draft.details, addOnIds }),
              },
            ]}
          />
        </Box>
        <Box>
          <Typography
            variant="body2"
            component="h3"
            sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 2 }}
          >
            Room Type Description
          </Typography>
          <TextField
            id={fieldDomId('description')}
            label="Description (optional)"
            value={draft.details.description}
            onChange={(e) => setDetails({ ...draft.details, description: e.target.value })}
            error={Boolean(errors.description)}
            helperText={
              errors.description ?? `${draft.details.description.length} / ${DESCRIPTION_MAX}`
            }
            slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX } }}
            multiline
            minRows={6}
            fullWidth
          />
        </Box>
        <PhotosField
          id={fieldDomId('photos')}
          photos={draft.details.photos}
          onChange={(photos) => setDetails({ ...draft.details, photos })}
          error={errors.photos}
        />
      </Box>
      <DeleteSetupDialog
        check={deleteCheck}
        noun="room type"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteCheck(null)}
        onDelete={() => void confirmDelete()}
      />
      <ConfirmDialog {...editor.confirmProps(save, 'This room type has not been saved.')} />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Room Type Saved"
      />
    </AdminShell>
  );
}
