import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { RoomInput, RoomSetup } from '../api/types';
import {
  blankRoom,
  changeRoomType,
  checkDeleteRoom,
  DESCRIPTION_MAX,
  duplicateName,
  effectiveDetails,
  NAME_MAX,
  setInheritDetails,
  sortSetupItems,
  toSetupListEntries,
  validateRoom,
  type DeleteCheck,
  type RoomField,
} from '../app/roomSetup';
import { useSystemSettings } from '../app/useSystemSettings';
import { useClubToday } from '../app/useClubToday';
import AdminShell from '../components/admin/AdminShell';
import ActiveDatesFields from '../components/admin/roomSetup/ActiveDatesFields';
import AssociationsPanel from '../components/admin/roomSetup/AssociationsPanel';
import DeleteSetupDialog from '../components/admin/roomSetup/DeleteSetupDialog';
import DetailsFields from '../components/admin/roomSetup/DetailsFields';
import PhotosField from '../components/admin/roomSetup/PhotosField';
import SetupActions from '../components/admin/roomSetup/SetupActions';
import SetupList from '../components/admin/roomSetup/SetupList';
import {
  useRoomSetupData,
  type RoomSetupData,
} from '../components/admin/roomSetup/useRoomSetupData';
import { focusField, useSetupEditor } from '../components/admin/roomSetup/useSetupEditor';
import LookupField from '../components/admin/systemSettings/LookupField';
import ToggleRow from '../components/admin/systemSettings/ToggleRow';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';

const FIELD_ORDER: RoomField[] = ['name', 'roomTypeId', 'startDate', 'endDate', 'description'];
const fieldDomId = (f: RoomField) => `room-${f}`;
const toDraft = (r: RoomSetup): RoomInput => r;

// Rooms (Admin Setup, ticket 7.3; Figma 11964:19392 and 12014:6137 with the owner field).
export default function Rooms() {
  const data = useRoomSetupData();
  if (data.status !== 'ready' || !data.options) {
    return (
      <AdminShell active="Room Options" title="Rooms">
        {data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.reload}>
                Retry
              </Button>
            }
          >
            Rooms could not be loaded.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Loading Rooms" />
          </Box>
        )}
      </AdminShell>
    );
  }
  return <RoomsEditor data={data} />;
}

function RoomsEditor({ data }: { data: RoomSetupData }) {
  const api = useApi();
  const { settings } = useSystemSettings();
  const ownerEnabled = settings?.roomOwnerFieldEnabled === true;
  const options = data.options as NonNullable<RoomSetupData['options']>;
  const today = useClubToday();
  const sorted = useMemo(() => sortSetupItems(data.rooms, today), [data.rooms, today]);
  const listEntries = useMemo(() => toSetupListEntries(sorted, today), [sorted, today]);
  const sortedTypes = useMemo(() => sortSetupItems(data.roomTypes, today), [data.roomTypes, today]);
  const typeOptions = useMemo(
    () => sortedTypes.map((t) => ({ id: t.id, label: t.name })),
    [sortedTypes],
  );
  const editor = useSetupEditor<RoomSetup, RoomInput>({
    items: sorted,
    toDraft,
    blank: () => blankRoom(today, options, sortedTypes[0]),
  });
  const { draft, setDraft } = editor;
  const errors = editor.attempted ? validateRoom(draft) : {};
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [deleteCheck, setDeleteCheck] = useState<DeleteCheck | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const inheriting = draft.inheritDetails;
  // While inheriting, the fields show the room type's current values.
  const details = effectiveDetails(draft, data.roomTypes);
  const setDetails = (next: RoomInput['details']) => setDraft({ ...draft, details: next });

  const save = async (): Promise<boolean> => {
    const found = validateRoom(draft);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      editor.setAttempted(true);
      focusField(fieldDomId(first));
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.roomSetup.saveRoom({
        ...draft,
        owner: ownerEnabled ? draft.owner : null,
        details,
      });
      await data.refresh();
      editor.afterSave(stored.id);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some fields are not valid. Check the highlighted fields.'
          : 'The room could not be saved. Try again.',
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
      await api.roomSetup.deleteRoom(editor.selected.id);
      await data.refresh();
      setDeleteCheck(null);
      editor.afterDelete();
    } catch {
      setDeleteError('The room could not be deleted. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  const title = editor.selected?.name ?? 'New Room';
  return (
    <AdminShell
      active="Room Options"
      title={title}
      changeLog="rooms"
      sidebarLabel="Rooms"
      sidebar={
        <SetupList
          items={listEntries}
          selectedId={editor.selectedId}
          creating={editor.creating}
          newLabel="New Room"
          newTitle="New Room"
          onSelect={editor.select}
          onNew={editor.startNew}
        />
      }
      actions={
        <SetupActions
          noun="room"
          saveLabel="Save Room"
          creating={editor.creating}
          saving={saving}
          onSave={() => void save()}
          onDelete={() => {
            setDeleteError(null);
            if (editor.selected) setDeleteCheck(checkDeleteRoom(editor.selected));
          }}
          onDuplicate={() =>
            editor.duplicate((saved) => ({
              ...structuredClone(saved),
              id: undefined,
              upcomingReservations: undefined,
              name: duplicateName(saved.name),
              // Links belong to the original room; the copy starts unlinked.
              linkedRoomIds: [],
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
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 0', minWidth: 200 }}>
              <TextField
                id={fieldDomId('name')}
                label="Room Name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={Boolean(errors.name)}
                helperText={errors.name}
                slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
                required
                fullWidth
              />
            </Box>
            {ownerEnabled ? (
              <Box sx={{ flex: '1 1 0', minWidth: 200 }}>
                {/* Not inherited from the room type, and enabled even while details are inherited. */}
                <LookupField
                  id="room-owner"
                  label="Room Owner"
                  value={draft.owner}
                  options={options.members}
                  onChange={(owner) => setDraft({ ...draft, owner })}
                />
              </Box>
            ) : null}
          </Box>
          <ActiveDatesFields
            idPrefix="room"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={(v) => setDraft({ ...draft, ...v })}
            startError={errors.startDate}
            endError={errors.endDate}
          />
          <Box id={fieldDomId('roomTypeId')}>
            <LookupField
              id="room-type-select"
              label="Room Type"
              value={typeOptions.find((t) => t.id === draft.roomTypeId) ?? null}
              options={typeOptions}
              onChange={(next) => setDraft(changeRoomType(draft, next?.id ?? '', data.roomTypes))}
            />
            {errors.roomTypeId ? (
              <Typography variant="caption" sx={{ color: 'error.main' }} role="alert">
                {errors.roomTypeId}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <ToggleRow
              label="Inherit Details from Room Type"
              checked={draft.inheritDetails}
              onChange={(on) => setDraft(setInheritDetails(draft, on, data.roomTypes))}
            />
            <ToggleRow
              label="Inherit Rates from Room Type"
              checked={draft.inheritRates}
              onChange={(inheritRates) => setDraft({ ...draft, inheritRates })}
              description={
                draft.inheritRates
                  ? undefined
                  : 'Room-specific rates are set with the Rate Categories (ticket 7.2); that table arrives with it.'
              }
            />
            <ToggleRow
              label="Display in Online Booking"
              checked={draft.onlineBooking}
              onChange={(onlineBooking) => setDraft({ ...draft, onlineBooking })}
            />
          </Box>
          <DetailsFields
            details={details}
            bedSizes={options.bedSizes}
            onChange={setDetails}
            disabled={inheriting}
            bathLabels={{ full: 'Full Bathrooms', half: 'Half Bathrooms' }}
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
                id: 'linked',
                label: 'Linked Rooms',
                heading: 'Linked Rooms',
                // Rows are the other rooms; a link is two-way, so each side shows the other.
                items: sorted
                  .filter((r) => r.id !== editor.selected?.id)
                  .map((r) => ({ id: r.id, label: r.name })),
                selected: draft.linkedRoomIds,
                onChange: (linkedRoomIds) => setDraft({ ...draft, linkedRoomIds }),
                note: 'If “Required” switch is active, service cannot be booked without one available resource.',
                columns: 2,
              },
              {
                id: 'features',
                label: 'Features',
                heading: 'Features',
                items: options.features,
                selected: details.featureIds,
                onChange: (featureIds) => setDetails({ ...details, featureIds }),
                disabled: inheriting,
              },
              {
                id: 'add-ons',
                label: 'Add-Ons',
                heading: 'Add-Ons',
                items: options.addOns,
                selected: details.addOnIds,
                onChange: (addOnIds) => setDetails({ ...details, addOnIds }),
                disabled: inheriting,
              },
            ]}
          />
        </Box>
        <Box>
          <Typography
            variant="body2"
            component="h3"
            sx={{
              fontWeight: 'bold',
              color: inheriting ? 'text.disabled' : 'text.secondary',
              mb: 2,
            }}
          >
            Room Description
          </Typography>
          <TextField
            id={fieldDomId('description')}
            label="Description (optional)"
            value={details.description}
            onChange={(e) => setDetails({ ...details, description: e.target.value })}
            error={Boolean(errors.description)}
            helperText={errors.description ?? `${details.description.length} / ${DESCRIPTION_MAX}`}
            slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX } }}
            disabled={inheriting}
            multiline
            minRows={6}
            fullWidth
          />
        </Box>
        <PhotosField
          photos={details.photos}
          onChange={(photos) => setDetails({ ...details, photos })}
          disabled={inheriting}
        />
      </Box>
      <DeleteSetupDialog
        check={deleteCheck}
        noun="room"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteCheck(null)}
        onDelete={() => void confirmDelete()}
      />
      <ConfirmDialog {...editor.confirmProps(save, 'This room has not been saved.')} />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Room Saved"
      />
    </AdminShell>
  );
}
