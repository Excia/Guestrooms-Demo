import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { Member } from '../../api';

export type MemberSearchState =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; members: Member[] };

export const MEMBER_SEARCH_DELAY_MS = 200;

/**
 * The directory people matching `query`, loaded while `enabled` (the list is open): the first
 * results for an empty query, then, after a short pause in typing, the matches. A newer query
 * aborts the older request; `retry` asks again after an error.
 */
export function useMemberSearch(
  query: string,
  enabled: boolean,
): MemberSearchState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: MemberSearchState } | null>(null);
  const key = `${query}|${attempt}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        api.members.search({ q: query }, { signal: controller.signal }).then(
          (page) => {
            if (!controller.signal.aborted) {
              setResult({ key, state: { status: 'success', members: page.items } });
            }
          },
          () => {
            if (!controller.signal.aborted) setResult({ key, state: { status: 'error' } });
          },
        );
      },
      query === '' ? 0 : MEMBER_SEARCH_DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, query, key, enabled]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: MemberSearchState = result?.key === key ? result.state : { status: 'loading' };
  return { ...state, retry };
}
