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

  // The candidates follow the employees, so a person who was just added is not offered again and a
  // removed one can be added back, even when the refresh after the change failed.
  const patch = useCallback((change: (list: EmployeeSetup[]) => EmployeeSetup[]) => {
    setState((s) => {
      const employees = change(s.employees);
      const added = new Set(employees.map((e) => e.id));
      const back = s.employees
        .filter((e) => !added.has(e.id) && !s.candidates.some((c) => c.id === e.id))
        .map((e) => ({ id: e.id, label: e.name }));
      const candidates = [...s.candidates.filter((c) => !added.has(c.id)), ...back];
      return { ...s, employees, candidates };
    });
  }, []);

  return { ...state, reload, refresh, patch };
}
