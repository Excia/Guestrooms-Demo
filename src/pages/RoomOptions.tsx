import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { RoomOptions as RoomOptionsValues, RoomSetup, RoomTypeSetup } from '../api/types';
import {
  checkRemoveOption,
  draftFromOptions,
  hasOptionErrors,
  isOptionsDirty,
  normalizeLabel,
  optionUsage,
  ROOM_OPTION_COPY,
  toRequest,
  validateRoomOptions,
  type RoomOptionDraft,
  type RoomOptionKind,
  type RoomOptionsDraft,
} from '../app/featureBedOptions';
import { useLeaveGuard } from '../app/useLeaveGuard';
import { newRequestId } from '../lib/requestId';
import AdminShell from '../components/admin/AdminShell';
import OptionList, { addButtonId, optionFieldId } from '../components/admin/roomOptions/OptionList';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';

const KINDS: RoomOptionKind[] = ['features', 'bedSizes'];
const tabId = (kind: RoomOptionKind) => `room-options-tab-${kind}`;
const panelId = (kind: RoomOptionKind) => `room-options-panel-${kind}`;

type Status = 'loading' | 'ready' | 'error';

// Room Options (Admin Setup > Room Options): the Features and Bed Sizes lists that Room Types,
// Rooms and the Schedule's Room Features filter read. No Figma frame: legacy RoomOptionsEdit is the
// reference (two tabs, one Save button), on this build's Admin Setup shell. See entry 183.
export default function RoomOptions() {
  const api = useApi();
  const [status, setStatus] = useState<Status>('loading');
  const [saved, setSaved] = useState<RoomOptionsValues | null>(null);
  const [draft, setDraft] = useState<RoomOptionsDraft | null>(null);
  // What the lists are used by, for the Remove check. Null when it could not be loaded; the
  // server still refuses a removal that is in use.
  const [usage, setUsage] = useState<{ roomTypes: RoomTypeSetup[]; rooms: RoomSetup[] } | null>(
    null,
  );
  const [tab, setTab] = useState<RoomOptionKind>('features');
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const focusAfterTab = useRef<string | null>(null);
  // The same payload keeps its request id, so a retry after a lost answer cannot save twice.
  const lastRequest = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    api.roomOptions
      .get(signal)
      .then((options) => {
        setSaved(options);
        setDraft(draftFromOptions(options));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    Promise.all([api.roomSetup.listRoomTypes(signal), api.roomSetup.listRooms(signal)])
      .then(([roomTypes, rooms]) => setUsage({ roomTypes, rooms }))
      .catch(() => setUsage(null));
    return () => controller.abort();
  }, [api, reloadCount]);

  const errors = useMemo(() => (draft ? validateRoomOptions(draft) : null), [draft]);
  const dirty = Boolean(saved && draft && isOptionsDirty(saved, draft));
  const guard = useLeaveGuard(dirty);

  // A refused save on the other tab moves there; focus follows once that tab has rendered.
  useEffect(() => {
    const target = focusAfterTab.current;
    if (!target) return;
    focusAfterTab.current = null;
    document.getElementById(target)?.focus();
  }, [tab]);

  const edit = (kind: RoomOptionKind, change: (items: RoomOptionDraft[]) => RoomOptionDraft[]) => {
    setDraft((d) => (d ? { ...d, [kind]: change(d[kind]) } : d));
    setSaveError(null);
  };

  const addItem = (kind: RoomOptionKind) => {
    const key = newRequestId();
    edit(kind, (items) => [...items, { key, label: '' }]);
    setNotice(null);
    // The new field exists after this render.
    requestAnimationFrame(() => document.getElementById(optionFieldId(kind, key))?.focus());
  };

  const removeItem = (kind: RoomOptionKind, item: RoomOptionDraft) => {
    if (item.id && usage) {
      const check = checkRemoveOption(
        item.label,
        optionUsage(kind, item.id, usage.roomTypes, usage.rooms),
      );
      if (check.kind === 'blocked') {
        setNotice(check.message);
        return;
      }
    }
    setNotice(null);
    // Later items move up; focus goes to the Add button, which never moves away.
    edit(kind, (items) => items.filter((i) => i.key !== item.key));
    requestAnimationFrame(() => document.getElementById(addButtonId(kind))?.focus());
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    setAttempted(true);
    const found = validateRoomOptions(draft);
    if (hasOptionErrors(found)) {
      for (const kind of KINDS) {
        const index = found[kind].findIndex((e) => e !== undefined);
        if (index >= 0) {
          const id = optionFieldId(kind, draft[kind][index].key);
          if (kind !== tab) {
            focusAfterTab.current = id;
            setTab(kind);
          } else document.getElementById(id)?.focus();
          break;
        }
      }
      return false;
    }
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const trimmed: RoomOptionsDraft = {
        features: draft.features.map((i) => ({ ...i, label: normalizeLabel(i.label) })),
        bedSizes: draft.bedSizes.map((i) => ({ ...i, label: normalizeLabel(i.label) })),
      };
      const fingerprint = JSON.stringify(toRequest(trimmed, ''));
      if (lastRequest.current?.fingerprint !== fingerprint) {
        lastRequest.current = { fingerprint, requestId: newRequestId() };
      }
      const stored = await api.roomOptions.save(toRequest(trimmed, lastRequest.current.requestId));
      setSaved(stored);
      setDraft(draftFromOptions(stored));
      setAttempted(false);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.code === 'in-use'
          ? 'A Feature or Bed Size you removed is still used by a Room Type or Room. Reload the page, then remove it from them first.'
          : error instanceof ApiError && error.status === 422
            ? 'Some names are not valid. Check the highlighted fields.'
            : 'Room Options could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, draft, tab]);

  const saveButton = (
    <Button
      variant="contained"
      size="large"
      onClick={() => void save()}
      disabled={!dirty || saving}
    >
      Save Room Options
    </Button>
  );

  let body;
  if (status === 'error') {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setStatus('loading');
              setReloadCount((n) => n + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        Room Options could not be loaded.
      </Alert>
    );
  } else if (status === 'loading' || !draft || !errors) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading Room Options" />
      </Box>
    );
  } else {
    body = (
      <>
        <Tabs
          value={tab}
          onChange={(_, next: RoomOptionKind) => {
            setTab(next);
            setNotice(null);
          }}
          aria-label="Room Options lists"
          sx={{ mb: 3 }}
        >
          {KINDS.map((kind) => (
            <Tab
              key={kind}
              value={kind}
              label={ROOM_OPTION_COPY[kind].title}
              id={tabId(kind)}
              aria-controls={panelId(kind)}
            />
          ))}
        </Tabs>
        {saveError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveError}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity="warning" onClose={() => setNotice(null)} sx={{ mb: 3 }}>
            {notice}
          </Alert>
        ) : null}
        <Box
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={-1}
          sx={{ outline: 'none' }}
        >
          <OptionList
            kind={tab}
            items={draft[tab]}
            errors={attempted ? errors[tab] : []}
            onChange={(key, label) =>
              edit(tab, (items) => items.map((i) => (i.key === key ? { ...i, label } : i)))
            }
            onRemove={(item) => removeItem(tab, item)}
            onAdd={() => addItem(tab)}
          />
        </Box>
      </>
    );
  }

  return (
    <AdminShell
      active="Room Options"
      title="Room Options"
      actions={saveButton}
      changeLog="room-options"
    >
      {body}
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Room Options have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Room Options Saved"
      />
    </AdminShell>
  );
}
