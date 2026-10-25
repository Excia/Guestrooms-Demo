import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, useApi } from '../api';
import type { BookingRules as BookingRulesValue, BookingRulesOptions } from '../api/types';
import { rulesDirty, validateBookingRules } from '../app/bookingRules';
import { useLeaveGuard } from '../app/useLeaveGuard';
import AdminShell from '../components/admin/AdminShell';
import MemberTypeRulesTable from '../components/admin/bookingRules/MemberTypeRulesTable';
import RulesMatrix from '../components/admin/bookingRules/RulesMatrix';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SaveToast from '../components/shared/SaveToast';
import SaveButton from '../components/shared/SaveButton';

interface Loaded {
  rules: BookingRulesValue;
  options: BookingRulesOptions;
}

/** Control id of an error key such as `member.opens` or `memberType.rule-1.closes`. */
const controlId = (key: string) => `booking-rules-${key.split('.').join('-')}`;

// Booking Rules (Figma 15957:84601): the rules matrix, Unique Member Type Rules and one save button.
export default function BookingRules() {
  const api = useApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Edits made on top of the saved rules; null while untouched.
  const [edits, setEdits] = useState<BookingRulesValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, id: 0 });
  const rowCounter = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.bookingRules.get({ signal: controller.signal }),
      api.bookingRules.getOptions({ signal: controller.signal }),
    ])
      .then(([rules, options]) => {
        if (!controller.signal.aborted) setLoaded({ rules, options });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [api, attempt]);

  const saved = loaded?.rules ?? null;
  const draft = edits ?? saved;
  const errors = useMemo(() => (draft ? validateBookingRules(draft) : {}), [draft]);
  const dirty = Boolean(saved && draft && rulesDirty(saved, draft));
  const guard = useLeaveGuard(dirty);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !loaded) return false;
    const first = Object.keys(validateBookingRules(draft))[0];
    if (first) {
      document.getElementById(controlId(first))?.focus();
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await api.bookingRules.save(draft);
      setLoaded({ ...loaded, rules: stored });
      setEdits(null);
      setToast((t) => ({ open: true, id: t.id + 1 }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.status === 422
          ? 'Some rules are not valid. Check the highlighted fields.'
          : 'Booking Rules could not be saved. Try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, draft, loaded]);

  const saveButton = (
    <SaveButton dirty={dirty} saving={saving} noun="Booking Rules" onClick={() => void save()} />
  );

  let body;
  if (failed) {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        Booking Rules could not be loaded.
      </Alert>
    );
  } else if (!loaded || !draft) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading Booking Rules" />
      </Box>
    );
  } else {
    body = (
      <>
        {saveError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveError}
          </Alert>
        ) : null}
        <Box sx={{ overflowX: 'auto' }}>
          <RulesMatrix rules={draft} onChange={setEdits} errors={errors} options={loaded.options} />
          {draft.member && draft.uniqueMemberTypeRules ? (
            <MemberTypeRulesTable
              rules={draft}
              onChange={setEdits}
              errors={errors}
              options={loaded.options}
              nextId={() => `rule-new-${(rowCounter.current += 1)}`}
            />
          ) : null}
        </Box>
      </>
    );
  }

  return (
    <AdminShell
      active="Booking Rules"
      title="Booking Rules"
      actions={saveButton}
      changeLog="booking-rules"
    >
      {body}
      <ConfirmDialog
        open={guard.pending}
        onClose={guard.stay}
        onDiscard={guard.leave}
        onConfirm={() => {
          void save().then((ok) => (ok ? guard.leave() : guard.stay()));
        }}
        title="Booking Rules have not been saved."
      />
      <SaveToast
        open={toast.open}
        saveId={toast.id}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        message="Booking Rules Saved"
      />
    </AdminShell>
  );
}
