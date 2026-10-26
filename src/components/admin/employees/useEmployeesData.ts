import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { EmployeeSetup, LookupRef } from '../../../api/types';

export interface EmployeesData {
  status: 'loading' | 'error' | 'ready';
  employees: EmployeeSetup[];
  /** People of the club directory who can still be added. */
  candidates: LookupRef[];
  permissionSets: LookupRef[];
  /** Retry after a load error. */
  reload: () => void;
  /** Re-reads employees and candidates after a save or removal. */
  refresh: () => Promise<void>;
  /** Updates the lists locally (when a refresh fails after the change was stored). */
  patch: (change: (list: EmployeeSetup[]) => EmployeeSetup[]) => void;
}

// The employees, the people who can be added and the permission sets load together.
export function useEmployeesData(): EmployeesData {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: EmployeesData['status'];
    employees: EmployeeSetup[];
    candidates: LookupRef[];
    permissionSets: LookupRef[];
  }>({ status: 'loading', employees: [], candidates: [], permissionSets: [] });

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    Promise.all([
      api.employees.list(signal),
      api.employees.listCandidates(signal),
      api.employees.listPermissionSets(signal),
    ])
      .then(([employees, candidates, permissionSets]) =>
        setState({ status: 'ready', employees, candidates, permissionSets }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [api, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    const [employees, candidates] = await Promise.all([
      api.employees.list(),
      api.employees.listCandidates(),
    ]);
    setState((s) => ({ ...s, employees, candidates }));
  }, [api]);

  const patch = useCallback((change: (list: EmployeeSetup[]) => EmployeeSetup[]) => {
    setState((s) => ({ ...s, employees: change(s.employees) }));
  }, []);

  return { ...state, reload, refresh, patch };
}
