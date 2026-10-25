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
  adoptSaved,
  checkRemoveOption,
  draftFromOptions,
  hasOptionErrors,
  isOptionsDirty,
  normalizeLabel,
  optionUsage,
  rebaseDraft,
  restoreItems,
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
import SaveButton from '../components/shared/SaveButton';

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
  // The lists changed elsewhere (stale version or an item that no longer exists).
  const [conflict, setConflict] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const focusAfterTab = useRef<string | null>(null);
  // The same payload keeps its request id, so a retry after a lost answer cannot save twice.
  const lastRequest = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const alive = useRef(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refreshUsage = useCallback(
    (signal?: AbortSignal) =>
      Promise.all([api.roomSetup.listRoomTypes({ signal }), api.roomSetup.listRooms({ signal })])
        .then(([roomTypes, rooms]) => {
          if (alive.current && !signal?.aborted) setUsage({ roomTypes, rooms });
        })
        .catch(() => {
          if (alive.current && !signal?.aborted) setUsage(null);
        }),
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    api.roomOptions
      .get({ signal: controller.signal })
      .then((options) => {
        setSaved(options);
        setDraft(draftFromOptions(options));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    void refreshUsage(controller.signal);
    return () => controller.abort();
  }, [api, refreshUsage, reloadCount]);

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
    if (!draft) return;
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
    // Later items move up; focus goes to the item now in this place (or the one before it).
    const items = draft[kind];
    const index = items.findIndex((i) => i.key === item.key);
    const rest = items.filter((i) => i.key !== item.key);
    const next = rest[index] ?? rest[index - 1];
    edit(kind, () => rest);
    const target = next ? optionFieldId(kind, next.key) : addButtonId(kind);
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  };

  // Takes the lists as they are now and re-bases the draft on them, keeping the admin's edits.
  const reload = async () => {
    if (!saved || !draft) return;
    try {
      const latest = await api.roomOptions.get();
      setDraft(rebaseDraft(saved, draft, latest));
      setSaved(latest);
      setConflict(false);
      setSaveError(null);
      setNotice(null);
      void refreshUsage();
    } catch {
      setSaveError('Room Options could not be reloaded. Try again.');
    }
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !saved) return false;
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
    const trimmed: RoomOptionsDraft = {
      features: draft.features.map((i) => ({ ...i, label: normalizeLabel(i.label) })),
      bedSizes: draft.bedSizes.map((i) => ({ ...i, label: normalizeLabel(i.label) })),
    };
    try {
      const fingerprint = JSON.stringify(toRequest(trimmed, '', saved.version));
      if (lastRequest.current?.fingerprint !== fingerprint) {
        lastRequest.current = { fingerprint, requestId: newRequestId() };
      }
      const stored = await api.roomOptions.save(
        toRequest(trimmed, lastRequest.current.requestId, saved.version),
      );
      setSaved(stored);
      // Keys stay, so no field remounts and the focus is not lost with them.
      setDraft(adoptSaved(trimmed, stored));
      setAttempted(false);
      setConflict(false);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      void refreshUsage();
      // The Save button disables itself now; keep the keyboard in the page.
      requestAnimationFrame(() => document.getElementById(panelId(tab))?.focus());
      return true;
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'stale' || error.status === 404)) {
        setConflict(true);
      } else if (error instanceof ApiError && error.code === 'in-use') {
        // Put the refused items back so nothing the server keeps disappears from the draft.
        const labels: string[] = [];
        const back = { features: draft.features, bedSizes: draft.bedSizes };
        for (const kind of KINDS) {
          const ids = error.details?.[kind] ?? [];
          back[kind] = restoreItems(draft[kind], saved[kind], ids);
          saved[kind].filter((s) => ids.includes(s.id)).forEach((s) => labels.push(s.label));
        }
        setDraft(back);
        setSaveError(
          `${labels.length > 0 ? labels.join(', ') : 'An item'} could not be removed because a Room Type or Room still uses ${labels.length === 1 ? 'it' : 'them'}. ${labels.length === 1 ? 'It was' : 'They were'} put back in the list; your other changes are kept.`,
        );
        void refreshUsage();
      } else {
        setSaveError(
          error instanceof ApiError && error.status === 422
            ? 'Some names are not valid. Check the highlighted fields.'
            : 'Room Options could not be saved. Try again.',
        );
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, draft, refreshUsage, saved, tab]);

  const saveButton = (
    <SaveButton dirty={dirty} saving={saving} noun="Room Options" onClick={() => void save()} />
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
    const errorCount = (kind: RoomOptionKind) =>
      attempted ? errors[kind].filter((e) => e !== undefined).length : 0;
    const badTabs = KINDS.filter((k) => errorCount(k) > 0).map((k) => ROOM_OPTION_COPY[k].title);
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
              label={`${ROOM_OPTION_COPY[kind].title}${errorCount(kind) > 0 ? ` (${errorCount(kind)} to fix)` : ''}`}
              id={tabId(kind)}
              aria-controls={panelId(kind)}
            />
          ))}
        </Tabs>
        {conflict ? (
          <Alert
            severity="warning"
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" onClick={() => void reload()}>
                Reload
              </Button>
            }
          >
            The lists changed elsewhere. Reload. Your edits are kept where the item still exists.
          </Alert>
        ) : null}
        {badTabs.length > 0 ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            Some names need fixing on: {badTabs.join(' and ')}.
          </Alert>
        ) : null}
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
        {KINDS.map((kind) => (
          <Box
            key={kind}
            role="tabpanel"
            id={panelId(kind)}
            aria-labelledby={tabId(kind)}
            hidden={tab !== kind}
            tabIndex={-1}
            sx={{ outline: 'none' }}
          >
            <OptionList
              kind={kind}
              items={draft[kind]}
              errors={attempted ? errors[kind] : []}
              onChange={(key, label) =>
                edit(kind, (items) => items.map((i) => (i.key === key ? { ...i, label } : i)))
              }
              onRemove={(item) => removeItem(kind, item)}
              onAdd={() => addItem(kind)}
            />
          </Box>
        ))}
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
