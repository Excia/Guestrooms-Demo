import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { RoomChangeRule, ScheduleBlock, ScheduleData } from '../../api';
import { loadInventory } from '../../app/changeRoom';
import type { IsoDate } from '../../lib/dates';

export type ChangeRoomData =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      /** Rooms, closures and bookings for the remaining nights (unfiltered). */
      inventory: ScheduleData;
      /** The reservation room as it is now: its version guards the change. */
      block: ScheduleBlock;
      rule: RoomChangeRule;
    };

/**
 * What the Change Room dialog needs, loaded when it opens: the inventory for the remaining nights
 * (the schedule page's own window may not cover them), the current block and the rate setting.
 */
export function useChangeRoomData(
  reservationRoomId: string,
  from: IsoDate,
  to: IsoDate,
): ChangeRoomData & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: ChangeRoomData } | null>(null);
  const key = `${reservationRoomId}|${from}|${to}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([loadInventory(api, from, to, signal), api.settings.getRoomChangeRule({ signal })])
      .then(([inventory, rule]) => {
        if (signal.aborted) return;
        const block = inventory.blocks.find((b) => b.id === reservationRoomId);
        setResult({
          key,
          state: block ? { status: 'ready', inventory, block, rule } : { status: 'error' },
        });
      })
      .catch(() => {
        if (!signal.aborted) setResult({ key, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [api, reservationRoomId, from, to, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: ChangeRoomData = result?.key === key ? result.state : { status: 'loading' };
  return { ...state, retry };
}
