import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useCallback, useRef, useState } from 'react';
import { useLeaveGuard } from '../app/useLeaveGuard';
import { useAdminOnlyReadOnly } from '../app/useAdminOnlyReadOnly';
import AdminShell from '../components/admin/AdminShell';
import ApiKeysPanel from '../components/admin/apiIntegrations/ApiKeysPanel';
import AuthenticationsPanel from '../components/admin/apiIntegrations/AuthenticationsPanel';
import PayCloudPanel from '../components/admin/apiIntegrations/PayCloudPanel';
import type { Notify, SavablePanel } from '../components/admin/apiIntegrations/types';
import ReadOnlyProvider from '../components/admin/ReadOnlyProvider';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveButton from '../components/shared/SaveButton';
import SaveToast from '../components/shared/SaveToast';

type TabId = 'paycloud' | 'authentications' | 'api-keys';

// Legacy opens API Integrations on PayCloud API Tokens; its API Keys page is a separate screen with
// no navigation entry, so it is the third tab here.
const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'paycloud', label: 'PayCloud API Tokens' },
  { id: 'authentications', label: 'Authentications' },
  { id: 'api-keys', label: 'API Keys' },
];
const tabId = (id: TabId) => `api-integrations-tab-${id}`;
const panelId = (id: TabId) => `api-integrations-panel-${id}`;

interface Toast {
  open: boolean;
  id: number;
  message: string;
  severity: 'success' | 'warning' | 'error';
}

// API Integrations (Admin Setup, ticket 188). No Figma frame: the legacy screens are the
// reference (APIIntegrations.vue with PayCloud API Tokens and Authentications, plus ApiKeys.vue),
// on this build's Admin Setup shell. Secrets are write-once: see api-contract.md.
// Administrators only change these settings; anyone else sees the page View-only.
export default function ApiIntegrations() {
  return (
    <ReadOnlyProvider readOnly={useAdminOnlyReadOnly()}>
      <ApiIntegrationsPage />
    </ReadOnlyProvider>
  );
}

function ApiIntegrationsPage() {
  const [tab, setTab] = useState<TabId>('paycloud');
  const [dirty, setDirty] = useState({ paycloud: false, authentications: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>({
    open: false,
    id: 0,
    message: '',
    severity: 'success',
  });
  const payCloud = useRef<SavablePanel>(null);
  const authentications = useRef<SavablePanel>(null);

  const notify = useCallback<Notify>(
    (message, severity) => setToast((t) => ({ open: true, id: t.id + 1, message, severity })),
    [],
  );
  const setPayCloudDirty = useCallback(
    (value: boolean) => setDirty((d) => (d.paycloud === value ? d : { ...d, paycloud: value })),
    [],
  );
  const setAuthDirty = useCallback(
    (value: boolean) =>
      setDirty((d) => (d.authentications === value ? d : { ...d, authentications: value })),
    [],
  );

  const anyDirty = dirty.paycloud || dirty.authentications;
  const guard = useLeaveGuard(anyDirty);

  // Saves each tab that has changes; stops reporting success if one is refused.
  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      let ok = true;
      if (dirty.paycloud) ok = ((await payCloud.current?.save()) ?? true) && ok;
      if (dirty.authentications) ok = ((await authentications.current?.save()) ?? true) && ok;
      return ok;
    } finally {
      setSaving(false);
    }
  }, [dirty]);

  const saveButton = (
    <SaveButton
      dirty={anyDirty}
      saving={saving}
      noun="API Integrations"
      onClick={() => void save()}
    />
  );

  return (
    <AdminShell active="API Integrations" title="API Integrations" actions={saveButton}>
      <Tabs
        value={tab}
        onChange={(_, next: TabId) => setTab(next)}
        aria-label="API Integrations sections"
        sx={{ mb: 3 }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={t.label}
            id={tabId(t.id)}
            aria-controls={panelId(t.id)}
          />
        ))}
      </Tabs>
      {/* All panels stay mounted, so edits on one tab survive a visit to another. */}
      <Box
        role="tabpanel"
        id={panelId('paycloud')}
        aria-labelledby={tabId('paycloud')}
        hidden={tab !== 'paycloud'}
      >
        <PayCloudPanel ref={payCloud} notify={notify} onDirtyChange={setPayCloudDirty} />
      </Box>
      <Box
        role="tabpanel"
        id={panelId('authentications')}
        aria-labelledby={tabId('authentications')}
        hidden={tab !== 'authentications'}
      >
        <AuthenticationsPanel ref={authentications} notify={notify} onDirtyChange={setAuthDirty} />
      </Box>
      <Box
        role="tabpanel"
        id={panelId('api-keys')}
        aria-labelledby={tabId('api-keys')}
        hidden={tab !== 'api-keys'}
      >
        <ApiKeysPanel notify={notify} />
      </Box>
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="API Integrations have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        message={toast.message}
        severity={toast.severity}
        autoHideDuration={toast.severity === 'success' ? 5000 : 10000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </AdminShell>
  );
}
