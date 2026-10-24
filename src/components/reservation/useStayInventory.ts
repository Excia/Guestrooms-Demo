import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { ScheduleData } from '../../api';
import { loadInventory } from '../../app/changeRoom';
import type { IsoDate } from '../../lib/dates';

export type StayInventory =
  { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; inventory: ScheduleData };

/**
 * The rooms, bookings and closures over the nights [from, to), whatever window the schedule page
 * shows (Add Another Room needs every night of the stay). Pass null dates until the stay is known.
 * `reload` fetches again (after a refused room, the data may have drifted).
 */
export function useStayInventory(
  from: IsoDate | null,
  to: IsoDate | null,
): StayInventory & { reload: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: StayInventory } | null>(null);
  const key = `${from}|${to}|${attempt}`;

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    loadInventory(api, from, to, controller.signal).then(
      (inventory) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'ready', inventory } });
      },
      () => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [api, from, to, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const state: StayInventory =
    !from || !to ? { status: 'idle' } : result?.key === key ? result.state : { status: 'loading' };
  return { ...state, reload };
}
