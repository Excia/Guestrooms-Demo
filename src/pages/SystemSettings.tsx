import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { SystemSettings as SystemSettingsValues, SystemSettingsOptions } from '../api/types';
import {
  firstErrorField,
  isDirty,
  isFolioField,
  isRegistrationCardField,
  validateSystemSettings,
  type SystemSettingsField,
} from '../app/systemSettings';
import { isOnlineBookingField } from '../app/onlineBookingSettings';
import { useLeaveGuard } from '../app/useLeaveGuard';
import { useSystemSettings } from '../app/useSystemSettings';
import AdminShell from '../components/admin/AdminShell';
import FolioDetailsTab from '../components/admin/systemSettings/FolioDetailsTab';
import { fieldId } from '../components/admin/systemSettings/fieldParts';
import RegistrationCardTab from '../components/admin/systemSettings/RegistrationCardTab';
import OnlineBookingTab from '../components/admin/systemSettings/OnlineBookingTab';
import SettingsTab from '../components/admin/systemSettings/SettingsTab';
import TrainingModeToggle from '../components/admin/systemSettings/TrainingModeToggle';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';
import { settingsTextSx } from '../components/admin/systemSettings/settingsText';

type TabId = 'settings' | 'folio' | 'registration' | 'online';
const tabId = (id: string) => `system-settings-tab-${id}`;
const panelId = (id: string) => `system-settings-panel-${id}`;

// System Settings (the menu's "Primary Setup"; Figma 11895:16081 and 11964:11725). One draft
// for both tabs, one Save button, and Confirm Leaving while the draft differs from what is saved.
export default function SystemSettings() {
  const api = useApi();
  const { status, settings: saved, reload, apply } = useSystemSettings();
  const [options, setOptions] = useState<SystemSettingsOptions | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  // Edits made on top of the saved settings; null while untouched.
  const [edits, setDraft] = useState<SystemSettingsValues | null>(null);
  const draft = edits ?? saved;
  const [tab, setTab] = useState<TabId>('settings');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const focusAfterTab = useRef<SystemSettingsField | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.systemSettings
      .getOptions({ signal: controller.signal })
      .then(setOptions)
      .catch(() => {
        if (!controller.signal.aborted) setOptionsFailed(true);
      });
    return () => controller.abort();
  }, [api]);

  const errors = useMemo(() => (draft ? validateSystemSettings(draft) : {}), [draft]);
  const dirty = Boolean(saved && draft && isDirty(saved, draft));
  const guard = useLeaveGuard(dirty);

  // A refused save on the other tab moves there; focus follows once that tab has rendered.
  useEffect(() => {
    const field = focusAfterTab.current;
    if (!field) return;
    focusAfterTab.current = null;
    document.getElementById(fieldId(field))?.focus();
  }, [tab]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    const found = validateSystemSettings(draft);
    const first = firstErrorField(found);
    if (first) {
      const target: TabId = isFolioField(first)
        ? 'folio'
        : isRegistrationCardField(first)
          ? 'registration'
          : isOnlineBookingField(first)
            ? 'online'
            : 'settings';
      focusAfterTab.current = first;
      if (target !== tab) setTab(target);
      else {
        focusAfterTab.current = null;
        document.getElementById(fieldId(first))?.focus();
      }
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.systemSettings.save(draft);
      apply(stored);
      setDraft(null);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some settings are not valid. Check the highlighted fields.'
          : 'System Settings could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, apply, draft, tab]);

  const saveButton = (
    <Button
      variant="contained"
      size="large"
      onClick={() => void save()}
      disabled={!dirty || saving}
    >
      Save System Settings
    </Button>
  );

  let body;
  if (status === 'error' || optionsFailed) {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setOptionsFailed(false);
              reload();
            }}
          >
            Retry
          </Button>
        }
      >
        System Settings could not be loaded.
      </Alert>
    );
  } else if (!draft || !options) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading System Settings" />
      </Box>
    );
  } else {
    body = (
      <Box sx={settingsTextSx}>
        <Tabs
          value={tab}
          onChange={(_, next: TabId) => setTab(next)}
          aria-label="System Settings sections"
          sx={{ mb: 3 }}
        >
          <Tab
            value="settings"
            label="Settings"
            id={tabId('settings')}
            aria-controls={panelId('settings')}
          />
          {/* Rate categories are managed in ticket 7.2; Figma shows the tab with no content. */}
          <Tab label="Default Rate Categories" disabled />
          <Tab
            value="folio"
            label="Folio Details"
            id={tabId('folio')}
            aria-controls={panelId('folio')}
          />
          <Tab
            value="registration"
            label="Registration Card"
            id={tabId('registration')}
            aria-controls={panelId('registration')}
          />
          <Tab
            value="online"
            label="Online Booking"
            id={tabId('online')}
            aria-controls={panelId('online')}
          />
        </Tabs>
        {saveError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveError}
          </Alert>
        ) : null}
        <Box
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={-1}
          sx={{ outline: 'none' }}
        >
          {tab === 'settings' ? (
            <>
              <TrainingModeToggle value={draft} onChange={setDraft} errors={errors} />
              <SettingsTab value={draft} onChange={setDraft} errors={errors} options={options} />
            </>
          ) : tab === 'registration' ? (
            <RegistrationCardTab
              value={draft.registrationCard}
              onChange={(registrationCard) => setDraft({ ...draft, registrationCard })}
              folio={draft.folio}
              errors={errors}
            />
          ) : tab === 'online' ? (
            <OnlineBookingTab
              value={draft.onlineBooking}
              onChange={(onlineBooking) => setDraft({ ...draft, onlineBooking })}
              errors={errors}
            />
          ) : (
            <>
              <Typography variant="settings_body" sx={{ mb: 3 }}>
                Folio Details will be displayed in the header of the printed Folio.
              </Typography>
              <FolioDetailsTab
                value={draft.folio}
                onChange={(folio) => setDraft({ ...draft, folio })}
                errors={errors}
              />
            </>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <AdminShell
      active="System Settings"
      title="System Settings"
      titleVariant="settings_title"
      actions={saveButton}
      changeLog="system-settings"
    >
      {body}
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="System Settings have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="System Settings Saved"
      />
    </AdminShell>
  );
}
