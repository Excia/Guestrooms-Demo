import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { ApiError, useApi } from '../../../api';
import type { IntegrationAuth, IntegrationProvider } from '../../../api/types';
import {
  AUTH_FIELD_MAX,
  AUTH_URL_MAX,
  PROVIDERS,
  PROVIDER_LABELS,
  authChanged,
  authInput,
  saveOutcome,
  testOutcome,
  validateAuth,
  type AuthDraft,
  type AuthErrors,
} from '../../../app/apiIntegrations';
import { newRequestId } from '../../../lib/requestId';
import EditOnly from '../EditOnly';
import type { Notify, SavablePanel } from './types';

type Status = 'loading' | 'error' | 'ready';

const draftFrom = (a: IntegrationAuth): AuthDraft => ({
  provider: a.provider,
  enabled: a.enabled,
  baseUrl: a.baseUrl,
  userName: a.userName,
  password: '',
  hasPassword: a.hasPassword,
  accessId: a.accessId ?? '',
  uuid: a.uuid ?? '',
});

const fieldId = (provider: IntegrationProvider, field: string) => `auth-${provider}-${field}`;

export interface AuthenticationsPanelProps {
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
  ref?: Ref<SavablePanel>;
}

// Authentications (legacy APIAuthentications.vue): Tiger TMS and Assa Abloy, each with an enable
// switch, URL, user name and password, and Test Connection. Saving tests every enabled
// integration. The saved password is never loaded: the field stays empty and an empty field keeps
// the saved one (write-once, ticket 188).
export default function AuthenticationsPanel({
  notify,
  onDirtyChange,
  ref,
}: AuthenticationsPanelProps) {
  const api = useApi();
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<AuthDraft[]>([]);
  const [drafts, setDrafts] = useState<AuthDraft[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [testing, setTesting] = useState<IntegrationProvider | null>(null);
  // The integration whose Test Connection was refused for missing fields: its fields show errors even while disabled.
  const [testRefused, setTestRefused] = useState<IntegrationProvider | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.integrations
      .listAuthentications({ signal: controller.signal })
      .then((list) => {
        const next = PROVIDERS.map((provider) => {
          const found = list.find((a) => a.provider === provider);
          return found
            ? draftFrom(found)
            : draftFrom({
                provider,
                enabled: false,
                baseUrl: '',
                userName: '',
                hasPassword: false,
              });
        });
        setSaved(next);
        setDrafts(next);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [api, attempt]);

  const dirty = status === 'ready' && authChanged(saved, drafts);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const update = (provider: IntegrationProvider, patch: Partial<AuthDraft>) =>
    setDrafts((list) => list.map((d) => (d.provider === provider ? { ...d, ...patch } : d)));

  const savedOf = (provider: IntegrationProvider) => saved.find((d) => d.provider === provider);

  const firstError = (): string | null => {
    for (const draft of drafts) {
      const errors = validateAuth(draft, { saved: savedOf(draft.provider) });
      if (errors.baseUrl) return fieldId(draft.provider, 'url');
      if (errors.accessId) return fieldId(draft.provider, 'access-id');
      if (errors.password) return fieldId(draft.provider, 'password');
    }
    return null;
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    const target = firstError();
    if (target) {
      setAttempted(true);
      document.getElementById(target)?.focus();
      return false;
    }
    setSaveError(null);
    try {
      const result = await api.integrations.saveAuthentications(
        drafts.map((d) => authInput(d, newRequestId)),
      );
      const next = PROVIDERS.map((provider) => {
        const found = result.authentications.find((a) => a.provider === provider);
        return found
          ? draftFrom(found)
          : (drafts.find((d) => d.provider === provider) as AuthDraft);
      });
      setSaved(next);
      setDrafts(next);
      setAttempted(false);
      const outcome = saveOutcome(result.tests);
      notify(outcome.message, outcome.severity);
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 403
          ? 'You may not change Authentications.'
          : error instanceof ApiError && error.status === 422
            ? 'Some Authentications are not valid. Check the highlighted fields.'
            : 'Authentications could not be saved. Try again.',
      );
      return false;
    }
    // firstError reads `drafts`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dirty, drafts, notify]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const test = async (draft: AuthDraft) => {
    if (testing) return;
    const errors = validateAuth(draft, { forTest: true, saved: savedOf(draft.provider) });
    if (errors.baseUrl || errors.accessId || errors.password) {
      setTestRefused(draft.provider);
      document
        .getElementById(
          fieldId(
            draft.provider,
            errors.baseUrl ? 'url' : errors.accessId ? 'access-id' : 'password',
          ),
        )
        ?.focus();
      return;
    }
    setTestRefused(null);
    setTesting(draft.provider);
    try {
      const input = authInput(draft, newRequestId);
      // The generated UUID is kept, so the same value is tested and saved.
      if (input.uuid && input.uuid !== draft.uuid) update(draft.provider, { uuid: input.uuid });
      const result = await api.integrations.testConnection(input);
      const outcome = testOutcome(result);
      notify(outcome.message, outcome.severity);
    } catch {
      notify(`Connection to ${PROVIDER_LABELS[draft.provider]} failed.`, 'error');
    } finally {
      setTesting(null);
    }
  };

  if (status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setStatus('loading');
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        Authentications could not be loaded.
      </Alert>
    );
  }
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading Authentications" />
      </Box>
    );
  }

  return (
    <Box sx={(t) => ({ maxWidth: t.spacing(100), display: 'grid', gap: 5 })}>
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {drafts.map((draft) => {
        const errors: AuthErrors = {
          ...(attempted ? validateAuth(draft, { saved: savedOf(draft.provider) }) : {}),
          ...(testRefused === draft.provider
            ? validateAuth(draft, { forTest: true, saved: savedOf(draft.provider) })
            : {}),
        };
        const name = PROVIDER_LABELS[draft.provider];
        return (
          <Box component="section" key={draft.provider} aria-labelledby={`auth-${draft.provider}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography id={`auth-${draft.provider}`} variant="subtitle2" component="h2">
                {name}
              </Typography>
              <FormControlLabel
                label={draft.enabled ? 'Enabled' : 'Disabled'}
                control={
                  <Switch
                    checked={draft.enabled}
                    onChange={(e) => update(draft.provider, { enabled: e.target.checked })}
                    slotProps={{ input: { 'aria-label': `Enable ${name}` } }}
                  />
                }
              />
            </Box>
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
            >
              <TextField
                id={fieldId(draft.provider, 'url')}
                label="URL"
                type="url"
                placeholder="https://example.com"
                value={draft.baseUrl}
                onChange={(e) => update(draft.provider, { baseUrl: e.target.value })}
                error={Boolean(errors.baseUrl)}
                helperText={errors.baseUrl}
                slotProps={{ htmlInput: { maxLength: AUTH_URL_MAX, autoComplete: 'off' } }}
                sx={{ gridColumn: { md: '1 / -1' } }}
              />
              <TextField
                id={fieldId(draft.provider, 'username')}
                label="Username"
                value={draft.userName}
                onChange={(e) => update(draft.provider, { userName: e.target.value })}
                slotProps={{ htmlInput: { maxLength: AUTH_FIELD_MAX, autoComplete: 'off' } }}
              />
              <TextField
                id={fieldId(draft.provider, 'password')}
                label="Password"
                type="password"
                value={draft.password}
                onChange={(e) => update(draft.provider, { password: e.target.value })}
                placeholder={draft.hasPassword ? '••••••••' : undefined}
                error={Boolean(errors.password)}
                helperText={
                  errors.password ??
                  (draft.hasPassword ? 'A password is saved. Type to replace it.' : undefined)
                }
                slotProps={{
                  htmlInput: { maxLength: AUTH_FIELD_MAX, autoComplete: 'new-password' },
                }}
              />
              {draft.provider === 'assa-abloy' ? (
                <>
                  <TextField
                    id={fieldId(draft.provider, 'access-id')}
                    label="Access ID"
                    value={draft.accessId}
                    onChange={(e) => update(draft.provider, { accessId: e.target.value })}
                    error={Boolean(errors.accessId)}
                    helperText={errors.accessId}
                    slotProps={{ htmlInput: { maxLength: AUTH_FIELD_MAX, autoComplete: 'off' } }}
                  />
                  <TextField
                    id={fieldId(draft.provider, 'uuid')}
                    label="UUID"
                    value={draft.uuid}
                    onChange={(e) => update(draft.provider, { uuid: e.target.value })}
                    helperText="Created for you when you save or test, if left empty."
                    slotProps={{ htmlInput: { maxLength: AUTH_FIELD_MAX, autoComplete: 'off' } }}
                  />
                </>
              ) : null}
            </Box>
            <EditOnly>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                className={testing === draft.provider ? 'Mui-disabled' : undefined}
                aria-disabled={testing === draft.provider}
                aria-busy={testing === draft.provider}
                aria-label={`Test Connection to ${name}`}
                startIcon={
                  testing === draft.provider ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
                onClick={() => void test(draft)}
              >
                Test Connection
              </Button>
            </EditOnly>
          </Box>
        );
      })}
    </Box>
  );
}
