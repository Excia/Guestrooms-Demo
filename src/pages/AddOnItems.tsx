import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useCallback, useMemo, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { AddOnInput, AddOnKind, AddOnSetup } from '../api/types';
import {
  ADD_ON_DESCRIPTION_MAX,
  blankAddOn,
  checkDeleteAddOn,
  NAME_MAX,
  normalizeAddOn,
  pruneAssociations,
  validateAddOn,
  type AddOnField,
} from '../app/addOns';
import { newRequestId } from '../lib/requestId';
import { todayIso } from '../app/dateSelection';
import { duplicateName, isActiveOn, sortSetupItems, type DeleteCheck } from '../app/roomSetup';
import AdminShell from '../components/admin/AdminShell';
import NightlyCountdownRow from '../components/admin/addOns/NightlyCountdownRow';
import { useAddOnData, type AddOnData } from '../components/admin/addOns/useAddOnData';
import ActiveDatesFields from '../components/admin/roomSetup/ActiveDatesFields';
import AssociationsPanel from '../components/admin/roomSetup/AssociationsPanel';
import DeleteSetupDialog from '../components/admin/roomSetup/DeleteSetupDialog';
import PhotosField from '../components/admin/roomSetup/PhotosField';
import SetupActions from '../components/admin/roomSetup/SetupActions';
import SetupList from '../components/admin/roomSetup/SetupList';
import { focusField, useSetupEditor } from '../components/admin/roomSetup/useSetupEditor';
import LookupField from '../components/admin/systemSettings/LookupField';
import { Hint } from '../components/admin/systemSettings/fieldParts';
import ToggleRow from '../components/admin/systemSettings/ToggleRow';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';

const FIELD_ORDER: AddOnField[] = [
  'name',
  'startDate',
  'endDate',
  'sku',
  'nightlyQty',
  'description',
  'photos',
];
const fieldDomId = (f: AddOnField) => `add-on-${f}`;

// Add-On Items (Admin Setup, ticket 7.4; Figma 13533:74182): the list on the left, the form on
// the right, associations beside it and description and photos below.
export default function AddOnItems() {
  const data = useAddOnData();
  if (data.status !== 'ready' || !data.options) {
    return (
      <AdminShell active="Room Options" title="Add-On Items">
        {data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.reload}>
                Retry
              </Button>
            }
          >
            Add-Ons could not be loaded.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Loading Add-Ons" />
          </Box>
        )}
      </AdminShell>
    );
  }
  return <AddOnEditor data={data} />;
}

function AddOnEditor({ data }: { data: AddOnData }) {
  const api = useApi();
  const options = data.options as NonNullable<AddOnData['options']>;
  const today = useMemo(() => todayIso(), []);
  const sorted = useMemo(() => sortSetupItems(data.addOns, today), [data.addOns, today]);
  // A deleted location or room type drops out of the draft, so counts and hints match what exists.
  const toDraft = useCallback(
    (a: AddOnSetup): AddOnInput => ({ ...a, ...pruneAssociations(a, options) }),
    [options],
  );
  const editor = useSetupEditor<AddOnSetup, AddOnInput>({
    items: sorted,
    toDraft,
    blank: () => blankAddOn(today),
  });
  const { draft, setDraft } = editor;
  const errors = editor.attempted ? validateAddOn(draft) : {};
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [deleteCheck, setDeleteCheck] = useState<DeleteCheck | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const save = async (): Promise<boolean> => {
    const found = validateAddOn(draft);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      editor.setAttempted(true);
      focusField(fieldDomId(first));
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.addOns.save({
        ...normalizeAddOn(draft),
        ...pruneAssociations(draft, options),
      });
      // The add-on is stored; a failed list refresh must not read as a failed save.
      await data
        .refresh()
        .catch(() =>
          data.patch((list) =>
            list.some((a) => a.id === stored.id)
              ? list.map((a) => (a.id === stored.id ? stored : a))
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
          : 'The add-on could not be saved. Try again.',
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
      await api.addOns.delete(editor.selected.id);
    } catch {
      setDeleteError('The add-on could not be deleted. Try again.');
      setDeleting(false);
      return;
    }
    // Deleted; a failed list refresh falls back to the local list so no second delete is offered.
    const id = editor.selected.id;
    await data.refresh().catch(() => data.patch((list) => list.filter((a) => a.id !== id)));
    setDeleteCheck(null);
    editor.afterDelete();
    setDeleting(false);
  };

  const title = editor.selected?.name ?? 'New Add-On';
  return (
    <AdminShell
      active="Room Options"
      title={title}
      changeLog="add-on-items"
      sidebarLabel="Add-Ons"
      sidebar={
        <SetupList
          items={sorted.map((a) => ({
            id: a.id,
            label: a.name,
            inactive: !isActiveOn(a, today),
          }))}
          selectedId={editor.selectedId}
          creating={editor.creating}
          newLabel="New Add-On"
          newTitle="New Add-On"
          onSelect={editor.select}
          onNew={editor.startNew}
        />
      }
      actions={
        <SetupActions
          noun="add-on"
          saveLabel="Save Add-On"
          creating={editor.creating}
          saving={saving}
          onSave={() => void save()}
          onDelete={() => {
            setDeleteError(null);
            if (editor.selected) setDeleteCheck(checkDeleteAddOn(editor.selected));
          }}
          onDuplicate={() =>
            editor.duplicate((saved) => ({
              ...structuredClone(saved),
              id: undefined,
              name: duplicateName(saved.name),
              photos: saved.photos.map((p) => ({ ...p, id: newRequestId() })),
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
            label="Add-On Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            error={Boolean(errors.name)}
            helperText={errors.name}
            slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
            required
            fullWidth
          />
          <ActiveDatesFields
            idPrefix="add-on"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={(v) => setDraft({ ...draft, ...v })}
            startError={errors.startDate}
            endError={errors.endDate}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControl sx={{ alignSelf: 'flex-end' }}>
              <FormLabel id="add-on-kind-label" sx={visuallyHidden}>
                Add-On Type
              </FormLabel>
              <RadioGroup
                row
                aria-labelledby="add-on-kind-label"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as AddOnKind })}
              >
                <FormControlLabel value="item" control={<Radio />} label="Item" />
                <FormControlLabel value="combo" control={<Radio />} label="Combo" />
              </RadioGroup>
            </FormControl>
            <Box id={fieldDomId('sku')}>
              <LookupField
                id="add-on-sku-input"
                label="SKU"
                value={draft.sku}
                options={options.skus}
                onChange={(sku) => setDraft({ ...draft, sku })}
                error={errors.sku}
              />
            </Box>
          </Box>
          <ToggleRow
            label="Display in Online Booking"
            checked={draft.onlineBooking}
            onChange={(onlineBooking) => setDraft({ ...draft, onlineBooking })}
          />
          <NightlyCountdownRow
            id={fieldDomId('nightlyQty')}
            tracked={draft.trackNightly}
            qty={draft.nightlyQty}
            onChange={(v) => setDraft({ ...draft, ...v })}
            error={errors.nightlyQty}
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
                id: 'locations',
                label: 'Locations',
                heading: 'Locations',
                items: options.locations,
                selected: draft.locationIds,
                onChange: (locationIds) => setDraft({ ...draft, locationIds }),
              },
              {
                id: 'room-types',
                label: 'Room Types',
                heading: 'Room Types',
                items: options.roomTypes,
                selected: draft.roomTypeIds,
                onChange: (roomTypeIds) => setDraft({ ...draft, roomTypeIds }),
              },
            ]}
          />
          {draft.locationIds.length === 0 || draft.roomTypeIds.length === 0 ? (
            <Box sx={{ mt: 1 }}>
              <Hint>
                Select at least one location and one room type, or this add-on is not offered on any
                reservation.
              </Hint>
            </Box>
          ) : null}
        </Box>
        <Box>
          <Typography
            variant="body2"
            component="h3"
            sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 2 }}
          >
            Add-On Description
          </Typography>
          <TextField
            id={fieldDomId('description')}
            label="Description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            error={Boolean(errors.description)}
            helperText={
              errors.description ?? `${draft.description.length} / ${ADD_ON_DESCRIPTION_MAX}`
            }
            slotProps={{ htmlInput: { maxLength: ADD_ON_DESCRIPTION_MAX } }}
            multiline
            minRows={6}
            fullWidth
          />
        </Box>
        <PhotosField
          id={fieldDomId('photos')}
          photos={draft.photos}
          onChange={(photos) => setDraft({ ...draft, photos })}
          error={errors.photos}
        />
      </Box>
      <DeleteSetupDialog
        check={deleteCheck}
        noun="add-on"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteCheck(null)}
        onDelete={() => void confirmDelete()}
      />
      <ConfirmDialog {...editor.confirmProps(save, 'This add-on has not been saved.')} />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Add-On Saved"
      />
    </AdminShell>
  );
}
