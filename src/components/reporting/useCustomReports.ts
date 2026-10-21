import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { CustomReportSummary } from '../../api';

export type CustomReportsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; reports: CustomReportSummary[] };

/** Loads the saved custom reports once; `retry` reloads after an error. */
export function useCustomReports(): CustomReportsState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ attempt: number; value: CustomReportsState } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.reports.listCustom({ signal: controller.signal }).then(
      (reports) => {
        if (!controller.signal.aborted)
          setState({ attempt, value: { status: 'success', reports } });
      },
      () => {
        if (!controller.signal.aborted) setState({ attempt, value: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [api, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const value: CustomReportsState =
    state?.attempt === attempt ? state.value : { status: 'loading' };
  return { ...value, retry };
}
