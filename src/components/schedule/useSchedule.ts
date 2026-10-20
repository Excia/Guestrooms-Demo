import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ScheduleBlock, ScheduleData, ScheduleDays } from '../../api';
import type { IsoDate } from '../../lib/dates';

export type ScheduleState =
  /** Nothing to show yet (first load). */
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  /** `refreshing`: `data` is the previous answer while the new range loads. */
  | { status: 'success'; data: ScheduleData; refreshing: boolean };

interface Settled {
  /** Which request this settled; anything else means a newer request is pending. */
  key: string;
  error?: unknown;
  failed: boolean;
}

/**
 * Fetches the (unfiltered) schedule for `days` columns from `startDate`: the drag rules need every
 * room, and the filters are applied locally. Changing the range refetches and aborts the stale
 * request. While a new range loads the last answer stays (`refreshing`); the skeleton is only for
 * the first load. `setBlocks` edits the loaded blocks (optimistic moves, merged API answers).
 */
export function useSchedule(
  startDate: IsoDate,
  days: ScheduleDays,
): ScheduleState & {
  retry: () => void;
  /**
   * Edits the loaded blocks, but only while the loaded range is still `range`: a late answer for a
   * range the user has left is ignored (returns false) instead of being merged into another window.
   */
  setBlocks: (
    range: { startDate: IsoDate; days: ScheduleDays },
    update: (blocks: ScheduleBlock[]) => ScheduleBlock[],
  ) => boolean;
} {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [data, setData] = useState<ScheduleData | null>(null);
  const key = `${startDate}|${days}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api.schedule.get({ startDate, days }, { signal: controller.signal }).then(
      (answer) => {
        if (controller.signal.aborted) return;
        setData(answer);
        setSettled({ key, failed: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({ key, failed: true, error });
      },
    );
    return () => controller.abort();
  }, [api, startDate, days, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The range of the data on screen, readable from event handlers that outlive a render.
  const loaded = useRef<{ startDate: IsoDate; days: ScheduleDays } | null>(null);
  useEffect(() => {
    loaded.current = data ? { startDate: data.startDate, days: data.days } : null;
  }, [data]);
  const setBlocks = useCallback(
    (
      range: { startDate: IsoDate; days: ScheduleDays },
      update: (blocks: ScheduleBlock[]) => ScheduleBlock[],
    ) => {
      const current = loaded.current;
      if (!current || current.startDate !== range.startDate || current.days !== range.days) {
        return false;
      }
      // Re-checked against the latest state, in case the range changed within this batch.
      setData((d) =>
        d && d.startDate === range.startDate && d.days === range.days
          ? { ...d, blocks: update(d.blocks) }
          : d,
      );
      return true;
    },
    [],
  );

  let state: ScheduleState;
  if (settled?.key === key) {
    state =
      settled.failed || !data
        ? { status: 'error', error: settled.error }
        : { status: 'success', data, refreshing: false };
  } else {
    state = data ? { status: 'success', data, refreshing: true } : { status: 'loading' };
  }
  return { ...state, retry, setBlocks };
}
