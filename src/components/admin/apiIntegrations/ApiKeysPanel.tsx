import Add from '@mui/icons-material/Add';
import Autorenew from '@mui/icons-material/Autorenew';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useId, useState } from 'react';
import { ApiError, useApi } from '../../../api';
import type { ApiKeySummary } from '../../../api/types';
import { API_KEY_NAME_MAX, validateKeyName } from '../../../app/apiIntegrations';
import { newRequestId } from '../../../lib/requestId';
import { focusOnMount } from '../../shared/focusOnMount';
import RemoveIconButton from '../../shared/RemoveIconButton';
import EditOnly from '../EditOnly';
import type { Notify } from './types';
import SecretDialog from './SecretDialog';

type Status = 'loading' | 'error' | 'ready';
type Pending =
  { kind: 'rotate'; key: ApiKeySummary } | { kind: 'revoke'; key: ApiKeySummary } | null;

const CREATE_BUTTON_ID = 'api-key-create';

// Guest Rooms API Keys (legacy ApiKeys.vue): the keys that let another system call Guest Rooms.
// Legacy listed every key in full with a show/copy button; this build follows the ticket instead:
// a key is shown once when it is created or rotated, and the list holds only the masked key.
export default function ApiKeysPanel({ notify }: { notify: Notify }) {
  const api = useApi();
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{
    name: string;
    secret: string;
    action: 'created' | 'rotated';
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.integrations
      .listApiKeys({ signal: controller.signal })
      .then((list) => {
        setKeys(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [api, attempt]);

  const openCreate = () => {
    setName('');
    setNameError(null);
    setCreating(true);
  };

  const create = useCallback(async () => {
    if (busy) return;
    const message = validateKeyName(
      name,
      keys.map((k) => k.name),
    );
    if (message) {
      setNameError(message);
      return;
    }
    setBusy(true);
    try {
      const result = await api.integrations.createApiKey({
        name,
        requestId: newRequestId(),
      });
      setKeys((list) => [...list, result.key]);
      setCreating(false);
      setIssued({ name: result.key.name, secret: result.secret, action: 'created' });
    } catch (error) {
      setNameError(
        error instanceof ApiError && error.status === 409
          ? 'A key with this name already exists.'
          : error instanceof ApiError && error.status === 403
            ? 'You may not create API keys.'
            : 'The key could not be created. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [api, busy, keys, name]);

  const confirmPending = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'rotate') {
        const result = await api.integrations.rotateApiKey({
          id: pending.key.id,
          requestId: newRequestId(),
        });
        setKeys((list) => list.map((k) => (k.id === result.key.id ? result.key : k)));
        setIssued({ name: result.key.name, secret: result.secret, action: 'rotated' });
      } else {
        await api.integrations.revokeApiKey(pending.key.id);
        setKeys((list) => list.filter((k) => k.id !== pending.key.id));
        notify(`API key "${pending.key.name}" revoked`, 'success');
        // The row is gone; focus moves to the always-present create button.
        setTimeout(() => document.getElementById(CREATE_BUTTON_ID)?.focus(), 0);
      }
      setPending(null);
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 403
          ? 'You may not change API keys.'
          : `The key could not be ${pending.kind === 'rotate' ? 'rotated' : 'revoked'}. Try again.`,
      );
    } finally {
      setBusy(false);
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
        API Keys could not be loaded.
      </Alert>
    );
  }
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading API Keys" />
      </Box>
    );
  }

  return (
    <Box sx={(t) => ({ maxWidth: t.spacing(100) })}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography id="api-keys-heading" variant="subtitle2" component="h2">
          Guest Rooms API Keys
        </Typography>
        <EditOnly>
          <Button
            id={CREATE_BUTTON_ID}
            variant="contained"
            startIcon={<Add />}
            onClick={openCreate}
          >
            Create New Key
          </Button>
        </EditOnly>
      </Box>
      {keys.length === 0 ? (
        <Typography color="text.secondary">No API keys yet.</Typography>
      ) : (
        <Box
          component="ul"
          aria-labelledby="api-keys-heading"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}
        >
          {keys.map((key) => (
            <Box
              component="li"
              key={key.id}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
                p: 2,
                border: `1px solid ${t.palette.divider}`,
              })}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <Typography variant="subtitle2" component="h3" noWrap>
                  {key.name}
                </Typography>
                <Typography
                  component="p"
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace' }}
                  aria-label={`Key ${key.name}, ends in ${key.maskedKey.slice(-4)}`}
                >
                  {key.maskedKey}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Created {key.createdAt}
                </Typography>
              </Box>
              <EditOnly>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Autorenew />}
                  aria-label={`Rotate key ${key.name}`}
                  onClick={() => {
                    setActionError(null);
                    setPending({ kind: 'rotate', key });
                  }}
                >
                  Rotate
                </Button>
              </EditOnly>
              <RemoveIconButton
                label={`key ${key.name}`}
                onClick={() => {
                  setActionError(null);
                  setPending({ kind: 'revoke', key });
                }}
              />
            </Box>
          ))}
        </Box>
      )}

      <CreateKeyDialog
        open={creating}
        name={name}
        error={nameError}
        busy={busy}
        onChange={(value) => {
          setName(value);
          setNameError(null);
        }}
        onCancel={() => setCreating(false)}
        onCreate={() => void create()}
      />
      {pending ? (
        <ConfirmKeyAction
          pending={pending}
          busy={busy}
          error={actionError}
          onCancel={() => !busy && setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : null}
      <SecretDialog
        open={issued !== null}
        keyName={issued?.name ?? ''}
        secret={issued?.secret ?? null}
        action={issued?.action ?? 'created'}
        onClose={() => {
          setIssued(null);
          setTimeout(() => document.getElementById(CREATE_BUTTON_ID)?.focus(), 0);
        }}
      />
    </Box>
  );
}

function CreateKeyDialog({
  open,
  name,
  error,
  busy,
  onChange,
  onCancel,
  onCreate,
}: {
  open: boolean;
  name: string;
  error: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const id = useId();
  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby={`${id}-title`} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
        noValidate
      >
        <DialogTitle id={`${id}-title`}>Create New API Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Key Name"
            value={name}
            onChange={(e) => onChange(e.target.value)}
            error={Boolean(error)}
            helperText={error ?? `${name.length}/${API_KEY_NAME_MAX}`}
            required
            fullWidth
            margin="dense"
            slotProps={{ htmlInput: { maxLength: API_KEY_NAME_MAX, autoComplete: 'off' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            className={busy ? 'Mui-disabled' : undefined}
            aria-disabled={busy}
          >
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ConfirmKeyAction({
  pending,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pending: NonNullable<Pending>;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  const rotate = pending.kind === 'rotate';
  return (
    <Dialog
      open
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>
        {rotate ? `Rotate ${pending.key.name}?` : `Revoke ${pending.key.name}?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {rotate
            ? 'A new key replaces the current one. Anything using the current key stops working at once.'
            : 'Anything using this key stops working at once. This cannot be undone.'}
        </DialogContentText>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={rotate ? 'primary' : 'error'}
          className={busy ? 'Mui-disabled' : undefined}
          aria-disabled={busy}
          onClick={onConfirm}
        >
          {rotate ? 'Rotate' : 'Revoke'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
