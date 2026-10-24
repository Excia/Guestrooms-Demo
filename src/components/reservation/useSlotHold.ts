import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** False releases the hold (panel closing, time expired, no permission). */
  enabled: boolean;
  /**
   * True while the panel's timer is paused (the closure tab): nothing changes. When it turns false
   * the slot is asked for again, so a hold that ended meanwhile is placed anew.
   */
  paused?: boolean;
  /** The hold in place (with the server's expiry), or null when there is none. */
  onChange: (hold: ScheduleHold | null) => void;
  /** The server refused the slot because it is booked or held: the schedule should reload. */
  onClash?: (kind: HoldClash) => void;
}

/**
 * Keeps a server-side hold on the slot a New Reservation has chosen (ticket 152, Q-19-3): placed or
 * moved when the room or dates change, released when the panel closes or stops needing it. The hold
 * id is this panel's own, so a repeat is idempotent. Requests go one at a time, in order (a slow
 * answer to an old slot can never overwrite a newer one, and the release always follows a PUT that
 * is still in flight); a request that a newer change has made pointless is not sent. Best effort: a
 * failed hold (network, 5xx) never blocks the form; the create request stays the authority. Returns
 * the reason the last attempt was refused, if it was.
 */
export function useSlotHold({
  holdId,
  slot,
  enabled,
  paused = false,
  onChange,
  onClash,
}: Options): {
  clash: HoldClash | null;
} {
  const api = useApi();
  const [refused, setRefused] = useState<{ key: string; clash: HoldClash } | null>(null);
  // A request was sent (or queued) since the last release: a release is owed.
  const asked = useRef(false);
  const held = useRef(false);
  // Bumped by every change of plan; an answer from an older one is ignored.
  const seq = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ onChange, onClash });
  useEffect(() => {
    latest.current = { onChange, onClash };
  });

  const target = slot && holdableSlot(slot) ? slot : null;
  const key = target ? `${target.roomId}|${target.startDate}|${target.endDate}` : '';

  const enqueue = useCallback((task: () => Promise<void>) => {
    chain.current = chain.current.then(task);
  }, []);

  const release = useCallback(() => {
    seq.current++;
    const owed = asked.current;
    asked.current = false;
    if (held.current) {
      held.current = false;
      latest.current.onChange(null);
    }
    // Queued behind any PUT still in flight, so the hold cannot be left behind.
    if (owed) enqueue(() => api.schedule.releaseHold(holdId).catch(() => undefined));
  }, [api, holdId, enqueue]);

  useEffect(() => {
    if (paused) return;
    if (!enabled || !target) {
      release();
      return;
    }
    const mine = ++seq.current;
    asked.current = true;
    enqueue(async () => {
      if (mine !== seq.current) return; // a newer change replaced this one before it was sent
      try {
        const hold = await api.schedule.holdSlot({
          holdId,
          roomId: target.roomId,
          startDate: target.startDate,
          endDate: target.endDate,
        });
        if (mine !== seq.current) return;
        held.current = true;
        setRefused(null);
        latest.current.onChange(hold);
      } catch (error) {
        if (mine !== seq.current) return;
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
          enqueue(() => api.schedule.releaseHold(holdId).catch(() => undefined));
        }
        latest.current.onChange(null);
        setRefused({ key, clash });
        latest.current.onClash?.(clash);
      }
    });
    // `target` is derived from `key`; the key is what changes the slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, holdId, enabled, paused, key, release, enqueue]);

  // Leaving the panel releases the hold, whatever state the effect above was in.
  useEffect(() => release, [release]);

  return { clash: refused && refused.key === key ? refused.clash : null };
}
