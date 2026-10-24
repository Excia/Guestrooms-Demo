import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { CheckInReservationResult, ReservationDetail } from '../../api';
import type { RoomCheckInResult, RoomToCheckIn } from '../../app/bulkCheckIn';
import {
  checkInFailureText,
  checkInRequestFailure,
  checkInSuccessMessage,
  integrationErrorMessage,
} from '../../app/checkInCopy';
import {
  canAutoCheckOut,
  decideCheckIn,
  needsPastDatePrompt,
  roomFactsOf,
  type CheckInDecision,
} from '../../app/checkInDecision';
import type { CheckInLevel } from '../../app/permissions';
import type { ClubClock } from '../../lib/clubTime';
import { newRequestId } from '../../lib/requestId';

type Startable = Exclude<CheckInDecision, { kind: 'disabled' }>;
type PastDate = Extract<CheckInDecision, { kind: 'needsPastDateConfirmation' | 'needsOverride' }>;

export type CheckInStep =
  /** The "check-in date has passed" confirmation. */
  | { name: 'past-date'; decision: PastDate }
  /** The override code, asked for before continuing a past-date check in. */
  | { name: 'override'; decision: PastDate }
  /** "Split this room from the reservation?" */
  | { name: 'split'; roomId: string }
  /** The check in panel. `confirmed`: the prior-date prompt was accepted. */
  | { name: 'panel'; decision: Startable; confirmed: boolean; overrideCode?: string }
  /** Successes and failures of a check in where at least one room failed. */
  | { name: 'result'; results: RoomCheckInResult[]; autoCheckOutDeparture: string | null }
  /** The reservation was checked out automatically after check in. */
  | { name: 'auto-checkout'; departure: string };

export interface CheckInToast {
  id: number;
  message: string;
  severity: 'success' | 'warning' | 'error';
}

export interface UseCheckInFlowOptions {
  detail: ReservationDetail;
  level: CheckInLevel;
  /** Now on the club's clock: `date` is the club's today. */
  clock: ClubClock;
  checkOutTime: string;
  onReloaded: (detail: ReservationDetail) => void;
  /** A change was applied: the schedule and the list behind the panel reload. */
  onChanged?: () => void;
  /** "Adjust reservation dates" and "Assign now" go to the edit panel (ticket 3.12). */
  onEdit: (kind: 'edit-reservation' | 'assign-room', reservationRoomId?: string) => void;
  /** Open another reservation (the one a room was split into). */
  onOpenReservation?: (reservationId: string) => void;
}

const roomLabel = (detail: ReservationDetail, id: string): RoomToCheckIn => {
  const room = detail.rooms.find((r) => r.id === id);
  return {
    reservationRoomId: id,
    reservationId: detail.id,
    confirmationNumber: detail.confirmationNumber,
    roomNumber: room?.roomNumber ?? null,
  };
};

/**
 * The check in flow of the reservation panel (ticket 163), as a small state machine over the pure
 * rule in `app/checkInDecision.ts`: start -> (past-date prompt -> [override code | split]) -> panel
 * -> [payment method] -> request -> toast, result dialog or automatic check-out dialog. One request
 * at a time; a retry after an unknown outcome reuses its idempotency key.
 */
export function useCheckInFlow({
  detail,
  level,
  clock,
  checkOutTime,
  onReloaded,
  onChanged,
  onEdit,
  onOpenReservation,
}: UseCheckInFlowOptions) {
  const api = useApi();
  const [step, setStep] = useState<CheckInStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  // The rooms waiting on a payment method, or null.
  const [payment, setPayment] = useState<{ ids: string[]; error: boolean } | null>(null);
  const [toast, setToast] = useState<CheckInToast | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const inflight = useRef(false);
  const mounted = useRef(true);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const notify = useCallback((message: string, severity: CheckInToast['severity'] = 'success') => {
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message, severity }));
    setToastOpen(true);
  }, []);

  const decide = useCallback(
    (targetIds: string[]): CheckInDecision =>
      decideCheckIn({
        rooms: roomFactsOf(detail),
        targetIds,
        checkOutTime,
        clock,
        level,
        paymentOnFile: detail.paymentOnFile !== false,
      }),
    [detail, checkOutTime, clock, level],
  );

  /** Starts a check in for these rooms. Returns the answer; a disabled one is explained by the caller. */
  const start = (targetIds: string[]): CheckInDecision => {
    const decision = decide(targetIds);
    if (decision.kind === 'disabled') return decision;
    setCodeError(false);
    setStep(
      needsPastDatePrompt(decision)
        ? { name: 'past-date', decision }
        : { name: 'panel', decision, confirmed: false },
    );
    return decision;
  };

  const close = () => {
    setStep(null);
    setCodeError(false);
  };

  /** The first choice of the past-date prompt: adjust the dates, or split the room. */
  const chooseFirst = () => {
    if (step?.name !== 'past-date' && step?.name !== 'override') return;
    const { decision } = step;
    if (decision.split) {
      setStep({ name: 'split', roomId: decision.checkableIds[0] ?? decision.unassignedIds[0] });
      return;
    }
    const only = detail.rooms.length === 1 ? detail.rooms[0] : undefined;
    setStep(null);
    onEdit(only && only.roomId === null ? 'assign-room' : 'edit-reservation', only?.id);
  };

  /** The second choice: check in for the original date (an override code first with the "arrival date" level). */
  const chooseContinue = () => {
    if (step?.name !== 'past-date') return;
    if (step.decision.kind === 'needsOverride') {
      setCodeError(false);
      setStep({ name: 'override', decision: step.decision });
    } else {
      setStep({ name: 'panel', decision: step.decision, confirmed: true });
    }
  };

  /** Back from the override code to the prompt. */
  const cancelOverride = () => {
    if (step?.name === 'override') setStep({ name: 'past-date', decision: step.decision });
  };

  /** Validates the code (a mock until ticket 127); true when the flow moved on. */
  const submitOverride = async (code: string): Promise<boolean> => {
    if (step?.name !== 'override' || busy) return false;
    setBusy(true);
    setCodeError(false);
    try {
      const { valid } = await api.reservations.verifyOverrideCode({
        permission: 'reservation.check-in.any-time',
        code,
      });
      if (!mounted.current) return false;
      if (!valid) {
        setCodeError(true);
        return false;
      }
      setStep({ name: 'panel', decision: step.decision, confirmed: true, overrideCode: code });
      return true;
    } catch {
      if (mounted.current) setCodeError(true);
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const splitRoom = async () => {
    if (step?.name !== 'split' || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    const roomId = step.roomId;
    try {
      const created = await api.reservations.splitRoom({
        requestId: newRequestId(),
        reservationId: detail.id,
        reservationRoomId: roomId,
        version: detail.version,
      });
      onChanged?.();
      if (!mounted.current) return;
      setStep(null);
      notify(`Room split into reservation #${created.confirmationNumber}.`);
      if (onOpenReservation) onOpenReservation(created.id);
      else api.reservations.getDetail(detail.id).then(onReloaded, () => undefined);
    } catch {
      if (mounted.current) {
        setStep(null);
        notify('Could not split the room. Try again.', 'error');
      }
    } finally {
      inflight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const reload = () =>
    api.reservations.getDetail(detail.id).then(
      (fresh) => {
        if (mounted.current) onReloaded(fresh);
        onChanged?.();
      },
      () => undefined,
    );

  /** Sends the check in (after the payment method, when none is on file). */
  const send = async (ids: string[], shown: ReservationDetail) => {
    if (step?.name !== 'panel' || inflight.current) return;
    const { decision, confirmed, overrideCode } = step;
    inflight.current = true;
    setBusy(true);
    const key = `${ids.join(',')}|${shown.version}|${confirmed}`;
    const requestId = attempt.current?.key === key ? attempt.current.id : newRequestId();
    attempt.current = null;
    let result: CheckInReservationResult;
    try {
      result = await api.reservations.checkIn({
        requestId,
        reservationId: shown.id,
        version: shown.version,
        reservationRoomIds: ids,
        pastDateConfirmed: confirmed,
        ...(overrideCode ? { overrideCode } : {}),
        checkOutAfter: decision.thenCheckOut && canAutoCheckOut(level),
      });
    } catch (error) {
      const failure = checkInRequestFailure(error);
      if (failure.outcomeUnknown) attempt.current = { key, id: requestId };
      inflight.current = false;
      if (!mounted.current) return;
      setBusy(false);
      notify(failure.message, 'error');
      if (failure.askOverrideAgain && decision.kind === 'needsOverride') {
        setStep({ name: 'override', decision });
      }
      if (failure.refetch) void reload();
      return;
    }
    inflight.current = false;
    onChanged?.();
    if (!mounted.current) return;
    setBusy(false);
    onReloaded(result.reservation);
    const failed = result.rooms.filter((r) => !r.checkedIn);
    const done = result.rooms.filter((r) => r.checkedIn);
    const nextDeparture = result.autoCheckedOut ? result.reservation.departure : null;
    if (failed.length > 0) {
      setStep({
        name: 'result',
        autoCheckOutDeparture: nextDeparture,
        results: result.rooms.map((r) => ({
          room: roomLabel(result.reservation, r.reservationRoomId),
          failure: r.checkedIn ? null : checkInFailureText(r.failure),
        })),
      });
      return;
    }
    if (nextDeparture) {
      setStep({ name: 'auto-checkout', departure: nextDeparture });
      return;
    }
    setStep(null);
    if (result.integrationErrors.length > 0) {
      notify(integrationErrorMessage(result.integrationErrors), 'warning');
      return;
    }
    notify(
      checkInSuccessMessage({
        reservationRooms: result.reservation.rooms.length,
        alreadyCheckedIn:
          result.reservation.rooms.filter((r) => r.status !== 'nyci').length - done.length,
        checkedIn: done.length,
        roomNumbers: done.map(
          (r) =>
            result.reservation.rooms.find((x) => x.id === r.reservationRoomId)?.roomNumber ?? null,
        ),
      }),
    );
  };

  /** "Complete check in": needs a payment method on file first (decision D-008). */
  const submit = (ids: string[]) => {
    if (step?.name !== 'panel' || ids.length === 0) return;
    if (detail.paymentOnFile === false) {
      setPayment({ ids, error: false });
      return;
    }
    void send(ids, detail);
  };

  const addPaymentMethod = async () => {
    if (!payment || busy) return;
    setBusy(true);
    try {
      const next = await api.reservations.addPaymentMethod({
        requestId: newRequestId(),
        reservationId: detail.id,
      });
      if (!mounted.current) return;
      onReloaded(next);
      setPayment(null);
      setBusy(false);
      await send(payment.ids, next);
    } catch {
      if (mounted.current) {
        setBusy(false);
        setPayment({ ids: payment.ids, error: true });
      }
    }
  };

  const dismissResult = () => {
    if (step?.name !== 'result') return;
    const departure = step.autoCheckOutDeparture;
    setStep(departure ? { name: 'auto-checkout', departure } : null);
  };

  return {
    step,
    busy,
    codeError,
    payment,
    toast,
    toastOpen,
    closeToast: () => setToastOpen(false),
    notify,
    decide,
    start,
    close,
    chooseFirst,
    chooseContinue,
    cancelOverride,
    submitOverride,
    splitRoom,
    submit,
    cancelPayment: () => setPayment(null),
    addPaymentMethod,
    dismissResult,
    dismissAutoCheckOut: close,
  };
}

export type CheckInFlow = ReturnType<typeof useCheckInFlow>;
