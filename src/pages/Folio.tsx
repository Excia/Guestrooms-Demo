import CallSplit from '@mui/icons-material/CallSplit';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import CreditScore from '@mui/icons-material/CreditScore';
import Email from '@mui/icons-material/Email';
import IndeterminateCheckBox from '@mui/icons-material/IndeterminateCheckBox';
import AddBox from '@mui/icons-material/AddBox';
import Print from '@mui/icons-material/Print';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useId, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { ApiError, useApi } from '../api';
import type { Folio as FolioData, FolioCharge } from '../api';
import { applyPanel } from '../app/panelUrl';
import { balanceTone, folioBalances } from '../app/folio';
import { NIGHT_AUDIT_HISTORY_PATH, SCHEDULE_PATH } from '../app/routes';
import BalanceSummary from '../components/folio/BalanceSummary';
import ChargesTable from '../components/folio/ChargesTable';
import PaymentsTable from '../components/folio/PaymentsTable';
import PostChargeDialog from '../components/folio/PostChargeDialog';
import { useFolio } from '../components/folio/useFolio';
import SaveToast from '../components/shared/SaveToast';
import { todayIso, type IsoDate } from '../lib/dates';
import { newRequestId } from '../lib/requestId';

const CHECK_IN_CHIP = {
  'not-checked-in': { label: 'Not Checked In', color: 'notCheckedIn' },
  'checked-in': { label: 'Checked In', color: 'balanceGreen' },
  'checked-out': { label: 'Checked Out', color: 'balanceGrey' },
} as const;

function StatusIndicators({ folio }: { folio: FolioData }) {
  const chip = CHECK_IN_CHIP[folio.checkInStatus];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Chip
        label={chip.label}
        sx={{
          bgcolor: (t) => t.palette.folio[chip.color],
          color: 'text.primary',
          borderRadius: 1,
          textTransform: 'uppercase',
          fontWeight: 'fontWeightMedium',
        }}
      />
      {folio.mposVisible ? (
        <Chip
          label="POS"
          variant="outlined"
          sx={{
            borderRadius: 1,
            borderColor: 'primary.outlinedBorder',
            color: 'primary.main',
            fontWeight: 'fontWeightBold',
          }}
        />
      ) : null}
      <Typography
        sx={{
          px: 1,
          fontWeight: 'fontWeightBold',
          color: folio.open ? 'primary.main' : 'text.secondary',
        }}
      >
        {folio.open ? 'Folio Open' : 'Folio Closed'}
      </Typography>
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: (labelledBy: string) => React.ReactNode;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Box component="section" aria-labelledby={`${id}-title`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <IconButton
          size="small"
          color="primary"
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <IndeterminateCheckBox /> : <AddBox />}
        </IconButton>
        <Typography id={`${id}-title`} variant="h6" component="h2">
          {title}
        </Typography>
      </Box>
      <Collapse in={expanded} id={`${id}-body`}>
        {children(`${id}-title`)}
      </Collapse>
    </Box>
  );
}

/** Folio of one reservation (ticket 4.1): balances, charges, payments and the action bar. */
export default function Folio({ today = todayIso() }: { today?: IsoDate } = {}) {
  const { id = '' } = useParams();
  const state = useFolio(id);
  const api = useApi();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) => setNotice((n) => ({ id: (n?.id ?? 0) + 1, text }));
  // `posting` stays set while the dialog fades out, so its title does not go blank.
  const [posting, setPosting] = useState<FolioCharge | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  // One idempotency key per confirmed action: a retry of a failed post reuses it.
  const postKey = useRef<string | null>(null);

  const backTo = {
    pathname: SCHEDULE_PATH,
    search: applyPanel(new URLSearchParams(), { kind: 'details', reservationId: id }).toString(),
  };

  if (state.status === 'loading') {
    return (
      <Box sx={{ p: 4 }} role="status" aria-label="Loading folio">
        <CircularProgress aria-hidden />
      </Box>
    );
  }
  if (state.status === 'error') {
    return (
      <Box sx={{ p: 2.5 }}>
        <Alert
          severity="error"
          action={
            state.notFound ? undefined : (
              <Button color="inherit" size="small" onClick={state.retry}>
                Retry
              </Button>
            )
          }
        >
          {state.notFound ? 'This reservation was not found.' : 'The folio could not be loaded.'}
        </Alert>
        <Button component={RouterLink} to={SCHEDULE_PATH} sx={{ mt: 2 }}>
          Back to schedule
        </Button>
      </Box>
    );
  }

  const { folio } = state;
  const balances = folioBalances(folio.charges);
  const tone = balanceTone(folio, balances);
  const closedHint = folio.open ? undefined : 'The folio is closed';

  const closePost = () => {
    setPostOpen(false);
    setPostError(null);
    postKey.current = null;
  };
  const confirmPost = async () => {
    if (!posting) return;
    postKey.current ??= newRequestId();
    setPostBusy(true);
    setPostError(null);
    try {
      state.replace(
        await api.folios.postCharge({
          requestId: postKey.current,
          reservationId: folio.reservationId,
          chargeId: posting.id,
        }),
      );
      say(`${posting.description} posted.`);
      closePost();
    } catch (error) {
      setPostError(
        error instanceof ApiError && error.status === 409
          ? 'This charge can no longer be posted. Reload the folio to see its current state.'
          : 'The charge could not be posted. Try again.',
      );
    } finally {
      setPostBusy(false);
    }
  };

  const quick = (icon: React.ReactNode, label: string, onClick: () => void, disabled = false) => (
    <Button
      variant="contained"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? closedHint : undefined}
      sx={{ flexDirection: 'column', gap: 1, flex: 1, minWidth: 0, p: 1, lineHeight: '22px' }}
    >
      {icon}
      {label}
    </Button>
  );
  const slate = (label: string, onClick: () => void, disabled = false) => (
    <Button
      variant="contained"
      size="large"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      title={disabled ? closedHint : undefined}
      sx={{
        bgcolor: (t) => t.palette.folio.slateButton,
        color: 'common.white',
        '&:hover': { bgcolor: (t) => t.palette.folio.slateButton, filter: 'brightness(1.15)' },
      }}
    >
      {label}
    </Button>
  );

  return (
    <Box component="main" sx={{ px: 2.5, py: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Typography variant="h6" component="h1" sx={{ textTransform: 'uppercase' }}>
          Reservation #{folio.confirmationNumber} Folio
        </Typography>
        <StatusIndicators folio={folio} />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: '335px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Paper component="aside" aria-label="Folio summary" sx={{ p: 2.5 }}>
          <Button component={RouterLink} to={backTo} startIcon={<ChevronLeft />} color="inherit">
            Back to Reservation
          </Button>
          <Typography
            variant="subtitle1"
            sx={{ color: 'text.secondary', fontWeight: 'fontWeightBold', my: 1.5 }}
          >
            {folio.rooms.length} {folio.rooms.length === 1 ? 'Room' : 'Rooms'} | {folio.nights}{' '}
            {folio.nights === 1 ? 'Night' : 'Nights'} | {folio.guests}{' '}
            {folio.guests === 1 ? 'Guest' : 'Guests'}
          </Typography>
          <BalanceSummary
            tone={tone}
            postedCents={balances.postedCents}
            unpostedCents={balances.unpostedCents}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {quick(
              <CreditScore />,
              'Quick Settle',
              () => say('Quick Settle arrives with the quick split and settle ticket.'),
              !folio.open,
            )}
            {quick(
              <CallSplit />,
              'Quick Split',
              () => say('Quick Split arrives with the quick split and settle ticket.'),
              !folio.open,
            )}
            {quick(<Print />, 'Print', () =>
              say(
                'Print is a stub: the backend will generate the folio PDF and it will open in a new tab.',
              ),
            )}
            {quick(<Email />, 'Email', () =>
              say('Email is a stub: the backend will send the folio PDF to the chosen address.'),
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
            {slate(
              'Manual Charge / Credit',
              () => say('Manual Charge / Credit arrives with its own ticket.'),
              !folio.open,
            )}
            {slate(
              'Add Deposit / Payment',
              () => say('Add Deposit / Payment arrives with its own ticket.'),
              !folio.open,
            )}
            {slate('Jump to Night Audit History', () => void navigate(NIGHT_AUDIT_HISTORY_PATH))}
          </Box>
        </Paper>
        <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <Section title="Charges">
            {(labelledBy) => (
              <ChargesTable
                key={folio.reservationId}
                folio={folio}
                labelledBy={labelledBy}
                today={today}
                onPost={(c) => {
                  postKey.current = null;
                  setPosting(c);
                  setPostOpen(true);
                }}
                onStub={say}
              />
            )}
          </Section>
          <Section title="Payments">
            {(labelledBy) => <PaymentsTable payments={folio.payments} labelledBy={labelledBy} />}
          </Section>
        </Paper>
      </Box>
      <PostChargeDialog
        open={postOpen}
        description={posting?.description ?? ''}
        busy={postBusy}
        error={postError}
        onGoBack={closePost}
        onPost={() => void confirmPost()}
      />
      <SaveToast
        open={notice !== null}
        message={notice?.text}
        saveId={notice?.id}
        onClose={() => setNotice(null)}
        autoHideDuration={6000}
      />
    </Box>
  );
}
