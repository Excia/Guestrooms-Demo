import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { leavingPath } from './leaveGuard';

export interface LeaveGuard {
  /** A click wanted to leave and is waiting for the user's answer. */
  pending: boolean;
  /** Keep editing. */
  stay: () => void;
  /** Leave now (after the user chose to, or after saving). */
  leave: () => void;
}

/**
 * While `dirty`, in-app link clicks are held until the user answers, and the browser asks before
 * a reload or tab close. Browser Back is not intercepted (no data router; see leaveGuard.ts).
 */
export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const navigate = useNavigate();
  const location = useLocation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const path = leavingPath(anchor as HTMLAnchorElement, window.location, event);
      if (path === null) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(path);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty, location.pathname]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    if (target !== null) navigate(target);
    setTarget(null);
  }, [navigate, target]);
  return { pending: target !== null, stay, leave };
}
