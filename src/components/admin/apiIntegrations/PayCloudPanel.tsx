import AddCircle from '@mui/icons-material/AddCircle';
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
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { ApiError, useApi } from '../../../api';
import type { PayCloudEnvironment, PayCloudToken } from '../../../api/types';
import {
  PAYCLOUD_ENVIRONMENTS,
  PAYCLOUD_KEY_MAX,
  payCloudChanged,
  validatePayCloudRows,
  type PayCloudRow,
} from '../../../app/apiIntegrations';
import { focusOnMount } from '../../shared/focusOnMount';
import RemoveIconButton from '../../shared/RemoveIconButton';
import Select from '../../shared/Select';
import EditOnly from '../EditOnly';
import type { Notify, SavablePanel } from './types';

type Status = 'loading' | 'error' | 'ready';

const ADD_BUTTON_ID = 'paycloud-add';
const keyInputId = (id: string) => `paycloud-key-${id}`;

const rowsFrom = (tokens: readonly PayCloudToken[]): PayCloudRow[] =>
  tokens.map((t) => ({
    id: t.id,
    saved: { maskedKey: t.maskedKey, environment: t.environment },
    apiKey: '',
    environment: t.environment,
    replacing: false,
  }));

export interface PayCloudPanelProps {
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
  ref?: Ref<SavablePanel>;
}

// PayCloud API Tokens (legacy PayCloudAPITokensEdit.vue): one row per token with its API Key and
// Environment, Add API Token, Remove, one Save. Legacy showed and edited the key in clear text;
// here a saved key is masked and can only be replaced (write-once, ticket 188). Nothing is stored
// until Save; leaving with edits asks first (the page owns that prompt).
export default function PayCloudPanel({ notify, onDirtyChange, ref }: PayCloudPanelProps) {
  const api = useApi();
  const idPrefix = useId();
  const counter = useRef(0);
  const makeId = useCallback(() => `new-${idPrefix}-${++counter.current}`, [idPrefix]);

  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<PayCloudToken[]>([]);
  const [rows, setRows] = useState<PayCloudRow[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PayCloudRow | null>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.integrations
      .listPayCloudTokens({ signal: controller.signal })
      .then((tokens) => {
        setSaved(tokens);
        setRows(rowsFrom(tokens));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [api, attempt]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    document.getElementById(target)?.focus();
  });

  const errors = useMemo(() => validatePayCloudRows(rows), [rows]);
  const dirty = status === 'ready' && payCloudChanged(saved, rows);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const update = (id: string, patch: Partial<PayCloudRow>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    const id = makeId();
    setRows((list) => [...list, { id, apiKey: '', environment: 'production', replacing: false }]);
    pendingFocus.current = keyInputId(id);
  };

  const removeRow = (row: PayCloudRow) => {
    const index = rows.findIndex((r) => r.id === row.id);
    const next = rows[index + 1] ?? rows[index - 1];
    pendingFocus.current = next ? keyInputId(next.id) : ADD_BUTTON_ID;
    setRows((list) => list.filter((r) => r.id !== row.id));
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    const found = validatePayCloudRows(rows);
    const first = rows.find((r) => found[r.id]);
    if (first) {
      setAttempted(true);
      document.getElementById(keyInputId(first.id))?.focus();
      return false;
    }
    setSaveError(null);
    try {
      const tokens = await api.integrations.savePayCloudTokens(
        rows.map((r) => ({
          ...(r.saved ? { id: r.id } : {}),
          ...(!r.saved || r.replacing ? { apiKey: r.apiKey.trim() } : {}),
          environment: r.environment,
        })),
      );
      setSaved(tokens);
      setRows(rowsFrom(tokens));
      setAttempted(false);
      notify('PayCloud API Tokens Saved', 'success');
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 403
          ? 'You may not change PayCloud API Tokens.'
          : error instanceof ApiError && error.status === 422
            ? 'Some PayCloud API Tokens are not valid. Check the highlighted fields.'
            : 'PayCloud API Tokens could not be saved. Try again.',
      );
      return false;
    }
  }, [api, dirty, notify, rows]);

  useImperativeHandle(ref, () => ({ save }), [save]);

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
        PayCloud API Tokens could not be loaded.
      </Alert>
    );
  }
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading PayCloud API Tokens" />
      </Box>
    );
  }

  return (
    <Box sx={(t) => ({ maxWidth: t.spacing(100) })}>
      <Typography id="paycloud-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
        PayCloud API Tokens
      </Typography>
      {saveError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          No PayCloud API Tokens yet.
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-labelledby="paycloud-heading"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, mb: 1 }}
        >
          {rows.map((row, index) => {
            const error = attempted ? errors[row.id] : undefined;
            const showInput = !row.saved || row.replacing;
            return (
              <Box
                component="li"
                key={row.id}
                sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}
              >
                <Box
                  sx={(t) => ({ flex: '1 1 auto', width: t.spacing(40), maxWidth: t.spacing(50) })}
                >
                  {showInput ? (
                    <TextField
                      id={keyInputId(row.id)}
                      label="API Key"
                      type="password"
                      value={row.apiKey}
                      onChange={(e) => update(row.id, { apiKey: e.target.value })}
                      error={Boolean(error)}
                      helperText={error ?? (row.saved ? 'Enter the new key.' : undefined)}
                      required
                      fullWidth
                      slotProps={{
                        htmlInput: {
                          maxLength: PAYCLOUD_KEY_MAX,
                          autoComplete: 'off',
                          'aria-label': `API Key ${index + 1}`,
                        },
                      }}
                    />
                  ) : (
                    <TextField
                      id={keyInputId(row.id)}
                      label="API Key"
                      value={row.saved?.maskedKey ?? ''}
                      fullWidth
                      helperText="Saved. The key is not shown again."
                      slotProps={{
                        input: { readOnly: true },
                        htmlInput: {
                          'aria-label': `API Key ${index + 1}, saved, ends in ${(row.saved?.maskedKey ?? '').slice(-4)}`,
                        },
                      }}
                    />
                  )}
                </Box>
                <Select<PayCloudEnvironment>
                  label="Environment"
                  ariaLabel={`Environment ${index + 1}`}
                  value={row.environment}
                  options={PAYCLOUD_ENVIRONMENTS}
                  onChange={(environment) => update(row.id, { environment })}
                  sx={(t) => ({ minWidth: t.spacing(25) })}
                />
                <EditOnly>
                  {row.saved ? (
                    <Button
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                      aria-label={`${row.replacing ? 'Keep the saved key for' : 'Replace key of'} API Key ${index + 1}`}
                      onClick={() => update(row.id, { replacing: !row.replacing, apiKey: '' })}
                    >
                      {row.replacing ? 'Keep Key' : 'Replace Key'}
                    </Button>
                  ) : null}
                </EditOnly>
                <RemoveIconButton
                  label={`PayCloud API Token ${index + 1}`}
                  onClick={() => (row.saved ? setRemoving(row) : removeRow(row))}
                  sx={{ mt: 1 }}
                />
              </Box>
            );
          })}
        </Box>
      )}
      <EditOnly>
        <Button id={ADD_BUTTON_ID} startIcon={<AddCircle />} onClick={addRow}>
          Add API Token
        </Button>
      </EditOnly>
      <RemoveTokenDialog
        row={removing}
        onCancel={() => setRemoving(null)}
        onRemove={() => {
          if (removing) removeRow(removing);
          setRemoving(null);
        }}
      />
    </Box>
  );
}

function RemoveTokenDialog({
  row,
  onCancel,
  onRemove,
}: {
  row: PayCloudRow | null;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  if (!row) return null;
  return (
    <Dialog
      open
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>Remove this PayCloud API Token?</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {`The token ${row.saved?.maskedKey ?? ''} is removed when you choose Save API Integrations.`}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onRemove}>
          Remove
        </Button>
      </DialogActions>
    </Dialog>
  );
}
