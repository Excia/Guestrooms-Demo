import { useCallback, useState } from 'react';
import { ApiError, useApi } from '../../api';
import type { ReservationListRow } from '../../api';
import {
  failedReservationIds,
  failureReason,
  roomsToCheckIn,
  type RoomCheckInResult,
} from '../../app/bulkCheckIn';
import { newRequestId } from '../../lib/requestId';

/**
 * Runs a bulk check-in: one API call per room, all at once, each succeeding or failing on its own.
 * `failedIds` are the reservations with a failed room, kept until the page is refreshed (they live
 * in this state); `reloadToken` changes after an attempt so the list is fetched again and shows the
 * rooms that are now checked in.
 */
export function useBulkCheckIn() {
  const api = useApi();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RoomCheckInResult[] | null>(null);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);

  const checkIn = useCallback(
    async (rows: readonly ReservationListRow[]) => {
      const rooms = roomsToCheckIn(rows);
      if (rooms.length === 0) return;
      setRunning(true);
      const outcomes = await Promise.all(
        rooms.map(async (room): Promise<RoomCheckInResult> => {
          try {
            await api.reservationList.checkInRoom({
              reservationRoomId: room.reservationRoomId,
              requestId: newRequestId(),
            });
            return { room, failure: null };
          } catch (error) {
            return {
              room,
              failure: failureReason(error instanceof ApiError ? error.code : undefined),
            };
          }
        }),
      );
      setResults(outcomes);
      // Rooms that now succeeded are no longer failed; those that failed stay tinted.
      setFailedIds((prev) => {
        const next = new Set(prev);
        for (const o of outcomes) if (o.failure === null) next.delete(o.room.reservationId);
        for (const id of failedReservationIds(outcomes)) next.add(id);
        return next;
      });
      setReloadToken((n) => n + 1);
      setRunning(false);
    },
    [api],
  );

  return { running, results, dismiss: () => setResults(null), failedIds, reloadToken, checkIn };
}
