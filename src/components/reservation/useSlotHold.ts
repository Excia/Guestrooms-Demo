import { useEffect, useRef, useState } from 'react';
import { ApiError, useApi } from '../../api';
import type { ScheduleHold } from '../../api';
import { holdableSlot } from '../../app/slotHolds';

export interface HoldTarget {
  roomId: string;
  startDate: string;
  endDate: string;
}

/** Why the slot could not be held: booked or closed (`conflict`), or held by another user (`held`). */
export type HoldClash = 'conflict' | 'held';

interface Options {
  /** This panel's own hold id (also sent with the create request). */
  holdId: string;
  /** The room and nights the form has chosen; null (or not holdable) holds nothing. */
  slot: HoldTarget | null;
  /** False releases the hold (panel closing, saved, time expired, no permission). */
  enabled: boolean;
  /** The hold in place (with the server's expiry), or null when there is none. */
  onChange: (hold: ScheduleHold | null) => void;
  /** The server refused the slot because it is booked or held: the schedule should reload. */
  onClash?: (kind: HoldClash) => void;
}

/**
 * Keeps a server-side hold on the slot a New Reservation has chosen (ticket 152, Q-19-3): placed or
 * moved when the room or dates change, released when the panel closes or stops needing it. The hold
 * id is this panel's own, so a repeat is idempotent. Best effort: a failed hold (network, 5xx) never
 * blocks the form; the create request stays the authority. Returns the reason the last attempt was
 * refused, if it was.
 */
export function useSlotHold({ holdId, slot, enabled, onChange, onClash }: Options): {
  clash: HoldClash | null;
} {
  const api = useApi();
  const [refused, setRefused] = useState<{ key: string; clash: HoldClash } | null>(null);
  const asked = useRef(false);
  const held = useRef(false);
  const latest = useRef({ onChange, onClash });
  useEffect(() => {
    latest.current = { onChange, onClash };
  });

  const target = slot && holdableSlot(slot) ? slot : null;
  const key = target ? `${target.roomId}|${target.startDate}|${target.endDate}` : '';

  useEffect(() => {
    if (!enabled || !target) {
      if (held.current) {
        held.current = false;
        void api.schedule.releaseHold(holdId).catch(() => undefined);
        latest.current.onChange(null);
      }
      return;
    }
    const controller = new AbortController();
    asked.current = true;
    api.schedule
      .holdSlot(
        { holdId, roomId: target.roomId, startDate: target.startDate, endDate: target.endDate },
        { signal: controller.signal },
      )
      .then(
        (hold) => {
          if (controller.signal.aborted) return;
          held.current = true;
          setRefused(null);
          latest.current.onChange(hold);
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          const clash: HoldClash | null =
            error instanceof ApiError && error.status === 409
              ? error.code === 'held'
                ? 'held'
                : 'conflict'
              : null;
          if (!clash) return;
          // The old slot's hold (if any) no longer matches the form.
          if (held.current) {
            held.current = false;
            void api.schedule.releaseHold(holdId).catch(() => undefined);
          }
          latest.current.onChange(null);
          setRefused({ key, clash });
          latest.current.onClash?.(clash);
        },
      );
    return () => controller.abort();
    // `target` is derived from `key`; the key is what changes the slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, holdId, enabled, key]);

  // Leaving the panel releases the hold, whatever state the effect above was in.
  useEffect(
    () => () => {
      if (asked.current) {
        asked.current = false;
        held.current = false;
        void api.schedule.releaseHold(holdId).catch(() => undefined);
        latest.current.onChange(null);
      }
    },
    [api, holdId],
  );

  return { clash: refused && refused.key === key ? refused.clash : null };
}
