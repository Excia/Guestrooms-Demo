import { useReadOnly } from '../app/readOnlyContext';
import EditOnly from '../components/admin/EditOnly';
import Add from '@mui/icons-material/Add';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { AddOnKind, RateCategoryInput, RateCategorySetup } from '../api/types';
import {
  addSeason,
  blankRateCategory,
  checkDeleteRateCategory,
  copyName,
  duplicateNameError,
  duplicateSeason,
  hasErrors,
  normalizeRateCategory,
  RATE_CATEGORY_NAME_MAX,
  removeSeason,
  setAmount,
  skusOfKind,
  toRateCategoryInput,
  updateSeason,
  validateRateCategory,
  visibleRateColumns,
} from '../app/rateCategories';
import { todayIso } from '../app/dateSelection';
import { useSystemSettings } from '../app/useSystemSettings';
import { isActiveOn, selectAllIds, sortSetupItems, type DeleteCheck } from '../app/roomSetup';
import { newRequestId } from '../lib/requestId';
import AdminShell from '../components/admin/AdminShell';
import ActiveDatesFields from '../components/admin/roomSetup/ActiveDatesFields';
import AssociationsPanel from '../components/admin/roomSetup/AssociationsPanel';
import DeleteSetupDialog from '../components/admin/roomSetup/DeleteSetupDialog';
import SetupActions from '../components/admin/roomSetup/SetupActions';
import { focusField, useSetupEditor } from '../components/admin/roomSetup/useSetupEditor';
import SetupList from '../components/admin/roomSetup/SetupList';
import RateTable, { seasonDomId } from '../components/admin/rateCategories/RateTable';
import {
  useRateCategoryData,
  type RateCategoryData,
} from '../components/admin/rateCategories/useRateCategoryData';
import LookupField from '../components/admin/systemSettings/LookupField';
import { Hint } from '../components/admin/systemSettings/fieldParts';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import DuplicateDialog from '../components/shared/DuplicateDialog';
import SaveToast from '../components/shared/SaveToast';

const fieldDomId = (f: string) => `rate-category-${f}`;

// Rate Categories (Admin Setup, ticket 7.2 / LP-A.3). No Figma frame exists: the layout follows
// Add-On Items (list on the left, form on the right) and the behavior follows the legacy screen.
export default function RateCategories() {
  const data = useRateCategoryData();
  if (data.status !== 'ready' || !data.options) {
    return (
      <AdminShell active="Rate Categories" title="Rate Categories">
        {data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.reload}>
                Retry
              </Button>
            }
          >
            Rate Categories could not be loaded.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Loading Rate Categories" />
          </Box>
        )}
      </AdminShell>
    );
  }
  return <RateCategoryEditor data={data} />;
}

function RateCategoryEditor({ data }: { data: RateCategoryData }) {
  const api = useApi();
  const options = data.options as NonNullable<RateCategoryData['options']>;
  const { settings } = useSystemSettings();
  const columns = useMemo(() => visibleRateColumns(settings), [settings]);
  const today = useMemo(() => todayIso(), []);
  const sorted = useMemo(() => sortSetupItems(data.categories, today), [data.categories, today]);
  const allRoomTypeIds = useMemo(() => selectAllIds(options.roomTypes), [options.roomTypes]);
  // A deleted room type drops out of the draft, so the table matches what exists.
  const toDraft = useCallback(
    (c: RateCategorySetup): RateCategoryInput => {
      const input = toRateCategoryInput(c);
      return {
        ...input,
        roomTypeIds: input.roomTypeIds.filter((id) => allRoomTypeIds.includes(id)),
      };
    },
    [allRoomTypeIds],
  );
  const editor = useSetupEditor<RateCategorySetup, RateCategoryInput>({
    items: sorted,
    toDraft,
    blank: () => blankRateCategory(today, allRoomTypeIds),
  });
  const { draft, setDraft } = editor;
  const errors = editor.attempted
    ? validateRateCategory(draft, data.categories, options.skus)
    : null;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const [deleteCheck, setDeleteCheck] = useState<DeleteCheck | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Rate cells holding text that is not money; Save waits until they are corrected.
  const [badAmounts, setBadAmounts] = useState<ReadonlySet<string>>(new Set());
  const { setExternalDirty } = editor;
  useEffect(() => setExternalDirty(badAmounts.size > 0), [badAmounts, setExternalDirty]);
  const onAmountInvalid = useCallback((cell: string, invalid: boolean) => {
    setBadAmounts((prev) => {
      if (prev.has(cell) === invalid) return prev;
      const next = new Set(prev);
      if (invalid) next.add(cell);
      else next.delete(cell);
      return next;
    });
  }, []);
  const [seasonToRemove, setSeasonToRemove] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  // One idempotency key per create attempt: a retry of the same body reuses it.
  const [attempt, setAttempt] = useState<{ body: string; requestId: string } | null>(null);
  const [duplicateRequest, setDuplicateRequest] = useState('');

  // Add Season moves focus to the new season's name once it is on screen.
  const focusNewSeason = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNewSeason.current) return;
    focusField(seasonDomId(focusNewSeason.current, 'name'));
    focusNewSeason.current = null;
  }, [draft.seasons]);

  const associated = options.roomTypes.filter((t) => draft.roomTypeIds.includes(t.id));

  const readOnly = useReadOnly();
  const save = async (): Promise<boolean> => {
    // Nothing to save in View-only mode (guards the Enter key and the leave prompt).
    if (readOnly) return false;
    const found = validateRateCategory(draft, data.categories, options.skus);
    if (badAmounts.size > 0) {
      editor.setAttempted(true);
      setSaveError('Correct the rates marked in the table before saving.');
      return false;
    }
    if (hasErrors(found)) {
      editor.setAttempted(true);
      const firstField = (['name', 'startDate', 'endDate', 'sku'] as const).find((f) => found[f]);
      if (firstField) focusField(fieldDomId(firstField));
      else if (!found.roomTypes) {
        const season = draft.seasons.find((s) => found.seasons[s.id]);
        const e = season ? found.seasons[season.id] : undefined;
        const f = (['name', 'startDate', 'endDate', 'sku'] as const).find((k) => e?.[k]);
        if (season && f) focusField(seasonDomId(season.id, f));
      }
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body = normalizeRateCategory(draft);
      let requestId: string | undefined;
      if (!draft.id) {
        const key = JSON.stringify(body);
        requestId = attempt?.body === key ? attempt.requestId : newRequestId();
        setAttempt({ body: key, requestId });
      }
      const stored = await api.rateCategories.save({ ...body, requestId });
      setAttempt(null);
      // The category is stored; a failed list refresh must not read as a failed save.
      await data
        .refresh()
        .catch(() =>
          data.patch((list) =>
            list.some((c) => c.id === stored.id)
              ? list.map((c) => (c.id === stored.id ? stored : c))
              : [...list, stored],
          ),
        );
      editor.afterSave(stored.id);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.code === 'duplicate-name'
          ? 'This name is already in use. Enter a unique name.'
          : error instanceof ApiError && error.status === 422
            ? 'Some fields are not valid. Check the highlighted fields.'
            : 'The rate category could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!editor.selected) return;
    const id = editor.selected.id;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.rateCategories.delete(id);
    } catch (error) {
      setDeleteError(
        error instanceof ApiError && error.status === 409
          ? 'This rate category is in use and cannot be deleted. Set an active end date to retire it instead.'
          : 'The rate category could not be deleted. Try again.',
      );
      setDeleting(false);
      return;
    }
    await data.refresh().catch(() => data.patch((list) => list.filter((c) => c.id !== id)));
    setDeleteCheck(null);
    editor.afterDelete();
    setDeleting(false);
  };

  const confirmDuplicate = async (name: string) => {
    if (!editor.selected) return;
    setDuplicateBusy(true);
    setDuplicateError(null);
    try {
      const copy = await api.rateCategories.duplicate({
        sourceId: editor.selected.id,
        name,
        requestId: duplicateRequest,
      });
      await data
        .refresh()
        .catch(() =>
          data.patch((list) => (list.some((c) => c.id === copy.id) ? list : [...list, copy])),
        );
      setDuplicating(false);
      editor.afterSave(copy.id);
      setToast((t) => ({ open: true, id: t.id + 1 }));
    } catch (error) {
      setDuplicateError(
        error instanceof ApiError && error.code === 'duplicate-name'
          ? 'This name is already in use. Enter a unique name.'
          : 'The rate category could not be duplicated. Try again.',
      );
    } finally {
      setDuplicateBusy(false);
    }
  };

  const setRoomTypes = (roomTypeIds: string[]) => setDraft({ ...draft, roomTypeIds });
  const seasonName = (id: string) =>
    draft.seasons.find((s) => s.id === id)?.name.trim() || 'this season';

  const title = editor.selected?.name ?? 'New Rate Category';
  return (
    <AdminShell
      active="Rate Categories"
      title={title}
      changeLog="rate-categories"
      sidebarLabel="Rate Categories"
      sidebar={
        <SetupList
          items={sorted.map((c) => ({
            id: c.id,
            label: c.name,
            inactive: !isActiveOn(c, today),
          }))}
          selectedId={editor.selectedId}
          creating={editor.creating}
          newLabel="New Rate Category"
          newTitle="New Rate Category"
          singleNewRow
          onSelect={editor.select}
          onNew={editor.startNew}
          more={{
            noun: 'Rate Category',
            changeLogPage: 'rate-categories',
            onDelete: () => {
              setDeleteError(null);
              if (editor.selected) setDeleteCheck(checkDeleteRateCategory(editor.selected));
            },
            onCopy: () =>
              editor.guard(() => {
                setDuplicateRequest(newRequestId());
                setDuplicateError(null);
                setDuplicating(true);
              }),
          }}
        />
      }
      actions={
        <SetupActions
          saveNoun="Rate Category"
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
            label="Rate Category Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            error={Boolean(errors?.name)}
            helperText={errors?.name ?? `${draft.name.length} / ${RATE_CATEGORY_NAME_MAX}`}
            slotProps={{ htmlInput: { maxLength: RATE_CATEGORY_NAME_MAX } }}
            required
            fullWidth
          />
          <ActiveDatesFields
            idPrefix="rate-category"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={(v) => setDraft({ ...draft, ...v })}
            startError={errors?.startDate}
            endError={errors?.endDate}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Legacy shows the Item and Combo radios above the SKU lookup; the label is visible so
                the pair is never mistaken for a stray control. */}
            <FormControl>
              <FormLabel
                id="rate-category-kind-label"
                sx={{ typography: 'body2', fontWeight: 'bold', color: 'text.primary' }}
              >
                SKU Type
              </FormLabel>
              <RadioGroup
                row
                aria-labelledby="rate-category-kind-label"
                value={draft.kind}
                onChange={(e) => {
                  const kind = e.target.value as AddOnKind;
                  // A SKU of the other kind no longer applies.
                  const keep = options.skus.some((s) => s.id === draft.sku?.id && s.kind === kind);
                  setDraft({ ...draft, kind, sku: keep ? draft.sku : null });
                }}
              >
                <FormControlLabel value="item" control={<Radio />} label="Item" />
                <FormControlLabel value="combo" control={<Radio />} label="Combo" />
              </RadioGroup>
            </FormControl>
            <Box id={fieldDomId('sku')}>
              <LookupField
                id="rate-category-sku-input"
                label="SKU"
                value={draft.sku}
                options={skusOfKind(options.skus, draft.kind)}
                onChange={(sku) => setDraft({ ...draft, sku })}
                error={errors?.sku}
              />
            </Box>
          </Box>
        </Box>
        <Box>
          <Typography sx={{ mb: 2 }}>
            <strong>Associations</strong>{' '}
            <em>(Room types this category can be used with; each gets a row in the rate table.)</em>
          </Typography>
          <AssociationsPanel
            tabs={[
              {
                id: 'room-types',
                label: 'Room Types',
                heading: 'Room Types',
                items: options.roomTypes,
                selected: draft.roomTypeIds,
                onChange: setRoomTypes,
              },
            ]}
          />
          {errors?.roomTypes ? (
            <Box sx={{ mt: 1 }} role="alert">
              <Typography variant="caption" color="error">
                {errors.roomTypes}
              </Typography>
            </Box>
          ) : null}
        </Box>
        <Box sx={{ gridColumn: { lg: '1 / -1' }, minWidth: 0 }}>
          <Typography
            variant="body2"
            component="h3"
            sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}
          >
            Rates (US dollars per night)
          </Typography>
          <RateTable
            seasons={draft.seasons}
            roomTypes={associated}
            skus={options.skus}
            columns={columns}
            errors={errors?.seasons ?? {}}
            onSeasonChange={(id, change) =>
              setDraft({ ...draft, seasons: updateSeason(draft.seasons, id, change) })
            }
            onAmountChange={(id, roomTypeId, column, cents) =>
              setDraft({
                ...draft,
                seasons: setAmount(draft.seasons, id, roomTypeId, column, cents),
              })
            }
            onDuplicateSeason={(id) =>
              setDraft({ ...draft, seasons: duplicateSeason(draft.seasons, id, newRequestId()) })
            }
            onAmountInvalid={onAmountInvalid}
            onRemoveSeason={setSeasonToRemove}
          />
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <EditOnly>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                disabled={associated.length === 0}
                onClick={() => {
                  const id = newRequestId();
                  focusNewSeason.current = id;
                  setDraft({ ...draft, seasons: addSeason(draft.seasons, id) });
                }}
              >
                Add Season
              </Button>
            </EditOnly>
            <Hint>
              Alternative base rate columns appear while they are enabled in System Settings.
            </Hint>
          </Box>
        </Box>
      </Box>
      <DeleteSetupDialog
        check={deleteCheck}
        noun="rate category"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteCheck(null)}
        onDelete={() => void confirmDelete()}
      />
      <DeleteSetupDialog
        check={
          seasonToRemove
            ? {
                kind: 'ok',
                message: `Remove ${seasonName(seasonToRemove)} and its rates? The change is saved with the rate category.`,
              }
            : null
        }
        noun="season"
        onCancel={() => setSeasonToRemove(null)}
        onDelete={() => {
          if (seasonToRemove) {
            setDraft({ ...draft, seasons: removeSeason(draft.seasons, seasonToRemove) });
          }
          setSeasonToRemove(null);
        }}
      />
      <DuplicateDialog
        open={duplicating}
        noun="rate category"
        initialName={copyName(editor.selected?.name ?? '')}
        validate={(name) => duplicateNameError(name, data.categories)}
        maxLength={RATE_CATEGORY_NAME_MAX}
        busy={duplicateBusy}
        error={duplicateError}
        onNameChange={() => setDuplicateError(null)}
        onCancel={() => setDuplicating(false)}
        onDuplicate={(name) => void confirmDuplicate(name)}
      />
      <ConfirmDialog {...editor.confirmProps(save, 'This rate category has not been saved.')} />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Rate Category Saved"
      />
    </AdminShell>
  );
}
