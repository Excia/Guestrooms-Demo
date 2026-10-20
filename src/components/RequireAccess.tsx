import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { guardDecision } from '../app/access';
import { DASHBOARD_PATH, type PageId } from '../app/routes';
import { useAccess } from '../app/useAccess';

/** Router state carried to the dashboard so it can explain the redirect once. */
export interface AccessDeniedState {
  accessDenied: { reason: 'denied' | 'error' };
}

/**
 * Route guard: renders its children only when the user may open `pageId`. Otherwise redirects to
 * the dashboard (replace, so Back does not return to the denied URL) with an AccessDeniedState.
 * Waits while the grant loads, so a deep link is not lost on reload. The dashboard itself is the
 * redirect target and is never guarded here, which also rules out a redirect loop.
 */
export default function RequireAccess({
  pageId,
  children,
}: {
  pageId: PageId;
  children: ReactNode;
}) {
  const { status, canAccessPage } = useAccess();
  const { search } = useLocation();
  const decision = guardDecision(status, canAccessPage(pageId));
  if (decision === 'wait') {
    return (
      <Container sx={{ py: 4 }} role="status" aria-label="Checking access">
        <CircularProgress aria-hidden />
      </Container>
    );
  }
  if (decision === 'deny') {
    const state: AccessDeniedState = {
      accessDenied: { reason: status === 'error' ? 'error' : 'denied' },
    };
    return <Navigate to={{ pathname: DASHBOARD_PATH, search }} state={state} replace />;
  }
  return <>{children}</>;
}
