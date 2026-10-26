import { useReadOnly } from '../app/readOnlyContext';
import EditOnly from '../components/admin/EditOnly';
import AddCircle from '@mui/icons-material/AddCircle';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import {
  ENCODER_KEY_LENGTH,
  encoderKeysToSave,
  encodersChanged,
  isBlankRow,
  normalizeEncoderKey,
  mergeRetrieved,
  retrievedMessage,
  validateEncoderRows,
  type EncoderRow,
} from '../app/keycards';
import { useLeaveGuard } from '../app/useLeaveGuard';
import AdminShell from '../components/admin/AdminShell';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { focusOnMount } from '../components/shared/focusOnMount';
import RemoveIconButton from '../components/shared/RemoveIconButton';
import SaveToast from '../components/shared/SaveToast';
import SaveButton from '../components/shared/SaveButton';

type Status = 'loading' | 'error' | 'ready';
interface Toast {
  open: boolean;
  id: number;
  message: string;
  severity: 'success' | 'warning';
}

const inputId = (rowId: string) => `encoder-key-${rowId}`;
// Figma's Encoder Key table is 685px wide (spacing units of 8px).
const LIST_WIDTH_UNITS = 85.5;
const ADD_BUTTON_ID = 'encoder-add';

// Keycard Integration (Figma 2829:6860): the Encoder Keys of the club's keycard encoders, one input
// per key. Keys can be typed or retrieved from Visionline (a mock behind the API until the
// connection exists, Q-75-3). Nothing is stored until Save Changes; leaving with edits asks first.
export default function KeycardIntegration() {
  const api = useApi();
  const idPrefix = useId();
  const counter = useRef(0);
  const makeId = useCallback(() => `${idPrefix}-${++counter.current}`, [idPrefix]);

  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [rows, setRows] = useState<EncoderRow[]>([]);
  // Rows whose input was left, or every row after a refused save: only those show their error.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveFailed, setRetrieveFailed] = useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [toast, setToast] = useState<Toast>({
    open: false,
    id: 0,
    message: '',
    severity: 'success',
  });
  const pendingFocus = useRef<string | null>(null);
  const retrieveRun = useRef(0);
  // The rows as last rendered, to count what an async result adds (the state is set functionally).
  const rowsRef = useRef<EncoderRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  });

  useEffect(() => {
    const controller = new AbortController();
    api.keycards
      .listEncoders({ signal: controller.signal })
      .then((keys) => {
        setSaved(keys);
        setRows(keys.map((value) => ({ id: makeId(), value })));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [api, attempt, makeId]);

  // Focus follows an add, a delete or a refused save once the rows have rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    document.getElementById(target)?.focus();
  });

  const errors = useMemo(() => validateEncoderRows(rows), [rows]);
  const readOnly = useReadOnly();
  const dirty = !readOnly && status === 'ready' && encodersChanged(saved, rows);
  const guard = useLeaveGuard(dirty);

  const showToast = (message: string, severity: Toast['severity'] = 'success') =>
    setToast((t) => ({ open: true, id: t.id + 1, message, severity }));

  const addRow = () => {
    const id = makeId();
    setRows((r) => [...r, { id, value: '' }]);
    pendingFocus.current = inputId(id);
  };

  const removeRow = (index: number) => {
    const next = rows[index + 1] ?? rows[index - 1];
    pendingFocus.current = next ? inputId(next.id) : ADD_BUTTON_ID;
    setRows((r) => r.filter((_, i) => i !== index));
  };

  const removeAll = () => {
    setRows([]);
    setTouched(new Set());
    setConfirmRemoveAll(false);
    pendingFocus.current = ADD_BUTTON_ID;
  };

  const retrieve = async () => {
    if (retrieving) return;
    const run = ++retrieveRun.current;
    setRetrieving(true);
    try {
      const keys = await api.keycards.retrieveEncoders();
      if (run !== retrieveRun.current) return;
      if (keys.length === 0) {
        setRetrieveFailed(true);
        return;
      }
      setRetrieveFailed(false);
      // Merge into the rows as they are now: edits made while the request ran survive.
      const { added } = mergeRetrieved(rowsRef.current, keys, makeId);
      setRows((current) => mergeRetrieved(current, keys, makeId).rows);
      if (added === 0) showToast('Every retrieved encoder is already in the list.', 'warning');
      else showToast(retrievedMessage(added));
    } catch {
      if (run === retrieveRun.current) setRetrieveFailed(true);
    } finally {
      if (run === retrieveRun.current) setRetrieving(false);
    }
  };

  const cancelRetrieve = () => {
    retrieveRun.current++;
    setRetrieving(false);
    setRetrieveFailed(false);
  };

  const save = useCallback(async (): Promise<boolean> => {
    // Nothing to save in View-only mode (the button is gone; this guards the Enter key and the leave prompt).
    if (readOnly) return false;
    const found = validateEncoderRows(rows);
    const first = rows.find((r) => found[r.id]);
    if (first) {
      setTouched(new Set(rows.map((r) => r.id)));
      document.getElementById(inputId(first.id))?.focus();
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.keycards.saveEncoders(encoderKeysToSave(rows));
      setSaved(stored);
      // Show each saved key in its stored form; blank rows and focus stay where they are.
      setRows((current) =>
        current.map((r) => (isBlankRow(r) ? r : { ...r, value: normalizeEncoderKey(r.value) })),
      );
      showToast('Encoder Keys Saved');
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some Encoder Keys are not valid. Check the highlighted fields.'
          : 'Encoder Keys could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, rows, readOnly]);

  const saveButton = (
    <SaveButton dirty={dirty} saving={saving} noun="Encoder Keys" onClick={() => void save()} />
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
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        Encoder Keys could not be loaded.
      </Alert>
    );
  } else if (status === 'loading') {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading Encoder Keys" />
      </Box>
    );
  } else {
    body = (
      <Box sx={{ maxWidth: (t) => t.spacing(LIST_WIDTH_UNITS) }}>
        {saveError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        ) : null}
        <Box sx={(t) => ({ border: `1px solid ${t.palette.divider}` })}>
          <Box
            sx={(t) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              p: 2,
              borderBottom: `1px solid ${t.palette.divider}`,
            })}
          >
            <Typography id="encoder-key-heading" variant="subtitle2" component="h2">
              Encoder Key
            </Typography>
            <EditOnly>
              <Button
                variant="outlined"
                size="small"
                onClick={() => void retrieve()}
                // aria-disabled, not disabled: a disabled button drops keyboard focus.
                className={retrieving ? 'Mui-disabled' : undefined}
                aria-disabled={retrieving}
                aria-busy={retrieving}
                startIcon={retrieving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {retrieving ? 'Retrieving' : 'Retrieve Encoder'}
              </Button>
            </EditOnly>
          </Box>
          {rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No Encoder Keys yet. Add one or retrieve them from Visionline.
            </Typography>
          ) : (
            <Box
              component="ul"
              aria-labelledby="encoder-key-heading"
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {rows.map((row, index) => {
                const error = touched.has(row.id) ? errors[row.id] : undefined;
                return (
                  <Box
                    component="li"
                    key={row.id}
                    sx={(t) => ({
                      display: 'flex',
                      alignItems: 'flex-start',
                      borderBottom: index < rows.length - 1 ? `1px solid ${t.palette.divider}` : 0,
                    })}
                  >
                    <TextField
                      id={inputId(row.id)}
                      variant="standard"
                      fullWidth
                      value={row.value}
                      onChange={(e) =>
                        setRows((r) =>
                          r.map((x) => (x.id === row.id ? { ...x, value: e.target.value } : x)),
                        )
                      }
                      onBlur={() => setTouched((s) => new Set(s).add(row.id))}
                      placeholder={`Enter ${ENCODER_KEY_LENGTH} digit Encoder Key or Retrieve from Visionline`}
                      error={Boolean(error)}
                      helperText={error}
                      slotProps={{
                        htmlInput: {
                          'aria-label': `Encoder Key ${index + 1}`,
                          inputMode: 'numeric',
                          autoComplete: 'off',
                        },
                      }}
                      sx={{ m: 2 }}
                    />
                    <RemoveIconButton
                      label={`Encoder Key ${index + 1}`}
                      onClick={() => removeRow(index)}
                      sx={{ m: 2, mt: 2.5 }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <EditOnly>
            <Button id={ADD_BUTTON_ID} startIcon={<AddCircle />} onClick={addRow}>
              Add Encoder
            </Button>
            <Button
              color="error"
              startIcon={<DeleteOutlined />}
              disabled={rows.length === 0}
              onClick={() => setConfirmRemoveAll(true)}
            >
              Remove All
            </Button>
          </EditOnly>
        </Box>
      </Box>
    );
  }

  return (
    <AdminShell active="Keycard Integration" title="Keycard Integration" actions={saveButton}>
      {body}
      <RetrieveErrorDialog
        open={retrieveFailed}
        busy={retrieving}
        onCancel={cancelRetrieve}
        onTryAgain={() => void retrieve()}
      />
      <RemoveAllDialog
        open={confirmRemoveAll}
        onCancel={() => setConfirmRemoveAll(false)}
        onRemove={removeAll}
      />
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Encoder Keys have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </AdminShell>
  );
}

// Figma 2784:53648. The troubleshooting sentence is the Figma placeholder text (Q-75-2).
function RetrieveErrorDialog({
  open,
  busy,
  onCancel,
  onTryAgain,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onTryAgain: () => void;
}) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>No encoders retrieved.</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          Try doing something to troubleshoot and try again.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          ref={focusOnMount}
          variant="contained"
          className={busy ? 'Mui-disabled' : undefined}
          aria-disabled={busy}
          onClick={() => {
            if (!busy) onTryAgain();
          }}
        >
          Try Again
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Remove All asks first (ticket). Cancel takes focus so Enter never clears the list.
function RemoveAllDialog({
  open,
  onCancel,
  onRemove,
}: {
  open: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>Remove all Encoder Keys?</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          This clears the list. Nothing changes until you choose Save Changes.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onRemove}>
          Remove All
        </Button>
      </DialogActions>
    </Dialog>
  );
}
