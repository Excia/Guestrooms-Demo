import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import NonActionableDialog from './shared/NonActionableDialog';
import type { AccessDeniedReason, AccessDeniedState } from './RequireAccess';

const REASONS: readonly AccessDeniedReason[] = ['denied', 'error', 'unconfigured'];

const isAccessDenied = (state: unknown): state is AccessDeniedState =>
  REASONS.includes((state as AccessDeniedState | null)?.accessDenied?.reason as never);

const COPY: Record<AccessDeniedReason, { title: string; body: string }> = {
  denied: {
    title: 'No access',
    body: 'You do not have access to that page. Ask an administrator if you need it.',
  },
  error: {
    title: 'Access could not be checked',
    body: 'We could not confirm what you may open, so that page was not shown. Try again later.',
  },
  unconfigured: {
    title: 'Site not configured',
    body: 'This site is not configured to reach its API, so that page was not shown. Tell whoever runs this deployment.',
  },
};

/** After the dialog closes focus would land on <body>; the page's <main> is the next stop. */
function focusMain() {
  document.querySelector<HTMLElement>('main')?.focus();
}

/**
 * Explains a route-guard redirect once. It copies the reason into local state and clears the
 * router state straight away, so closing the dialog (or reloading) never shows it again. A denial
 * while the dialog is open replaces its text; it never stacks a second dialog.
 */
export default function AccessDeniedNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reason, setReason] = useState<AccessDeniedReason | null>(null);
  const incoming = isAccessDenied(location.state) ? location.state.accessDenied.reason : null;

  // Adjusting state while rendering (not in an effect) avoids a cascading render.
  if (incoming && incoming !== reason) setReason(incoming);

  useEffect(() => {
    if (!incoming) return;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
  }, [incoming, location.pathname, location.search, navigate]);

  // Keep the last copy while the close transition runs.
  const [shown, setShown] = useState<AccessDeniedReason>('denied');
  if (reason && reason !== shown) setShown(reason);
  const copy = COPY[shown];

  return (
    <NonActionableDialog
      open={reason !== null}
      onClose={() => setReason(null)}
      onExited={focusMain}
      title={copy.title}
    >
      <Typography>{copy.body}</Typography>
    </NonActionableDialog>
  );
}
