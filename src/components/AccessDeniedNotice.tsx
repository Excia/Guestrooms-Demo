import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import NonActionableDialog from './shared/NonActionableDialog';
import type { AccessDeniedState } from './RequireAccess';

const isAccessDenied = (state: unknown): state is AccessDeniedState => {
  const reason = (state as AccessDeniedState | null)?.accessDenied?.reason;
  return reason === 'denied' || reason === 'error';
};

/**
 * Explains a route-guard redirect once. It copies the reason into local state and clears the
 * router state straight away, so closing the dialog (or reloading) never shows it again.
 */
export default function AccessDeniedNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reason, setReason] = useState<'denied' | 'error' | null>(null);
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

  return (
    <NonActionableDialog
      open={reason !== null}
      onClose={() => setReason(null)}
      title={reason === 'error' ? 'Access could not be checked' : 'No access'}
    >
      <Typography>
        {reason === 'error'
          ? 'We could not confirm what you may open, so that page was not shown. Try again later.'
          : 'You do not have access to that page. Ask an administrator if you need it.'}
      </Typography>
    </NonActionableDialog>
  );
}
