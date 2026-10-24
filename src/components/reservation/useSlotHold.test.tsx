import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiProvider } from '../../api';
import { createMockClient } from '../../api/mock';
import type { ApiClient, HoldSlotRequest, ScheduleHold } from '../../api/types';
import { useSlotHold } from './useSlotHold';

const ID = 'hold-test-0001';
const slot = (roomId: string, startDate = '2026-10-20', endDate = '2026-10-22') => ({
  roomId,
  startDate,
  endDate,
});
const hold = (r: HoldSlotRequest): ScheduleHold => ({
  id: r.holdId,
  roomId: r.roomId,
  startDate: r.startDate,
  endDate: r.endDate,
  expiresAt: '2030-01-01T00:00:00.000Z',
  mine: true,
});

/** A client whose hold and release calls settle when the test says so, in the order sent. */
function controlled() {
  const base = createMockClient({ today: '2026-10-16' });
  const sent: string[] = [];
  const pending: { name: string; settle: () => void }[] = [];
  const api: ApiClient = {
    ...base,
    schedule: {
      ...base.schedule,
      holdSlot: (r) => {
        sent.push(`hold ${r.roomId}`);
        return new Promise((resolve) =>
          pending.push({ name: `hold ${r.roomId}`, settle: () => resolve(hold(r)) }),
        );
      },
      releaseHold: () => {
        sent.push('release');
        return new Promise((resolve) => pending.push({ name: 'release', settle: () => resolve() }));
      },
    },
  };
  const settleNext = async () => {
    const next = pending.shift();
    await act(async () => {
      next?.settle();
      await Promise.resolve();
    });
  };
  const flush = () => act(async () => void (await Promise.resolve()));
  return { api, sent, settleNext, flush };
}

function setup(
  api: ApiClient,
  initial: { slot: ReturnType<typeof slot> | null; enabled?: boolean; paused?: boolean },
) {
  const changes: (string | null)[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider client={api}>{children}</ApiProvider>
  );
  const view = renderHook(
    (props: typeof initial) =>
      useSlotHold({
        holdId: ID,
        slot: props.slot,
        enabled: props.enabled ?? true,
        paused: props.paused,
        onChange: (h) => changes.push(h ? h.roomId : null),
      }),
    { wrapper, initialProps: initial },
  );
  return { ...view, changes };
}

describe('useSlotHold ordering', () => {
  it('sends requests one at a time and skips a change that a newer one replaced', async () => {
    const c = controlled();
    const { rerender, changes } = setup(c.api, { slot: slot('a') });
    await c.flush();
    expect(c.sent).toEqual(['hold a']);
    // Rapid changes while the first PUT is in flight: only the newest is sent, after the first settles.
    rerender({ slot: slot('b') });
    rerender({ slot: slot('c') });
    rerender({ slot: slot('d') });
    await c.flush();
    expect(c.sent).toEqual(['hold a']);
    await c.settleNext();
    await c.flush();
    expect(c.sent).toEqual(['hold a', 'hold d']);
    await c.settleNext();
    // The old answer did not overwrite the newest one.
    expect(changes).toEqual(['d']);
  });

  it('closing while the first PUT is in flight releases after it settles', async () => {
    const c = controlled();
    const { unmount, changes } = setup(c.api, { slot: slot('a') });
    await c.flush();
    unmount();
    await c.flush();
    expect(c.sent).toEqual(['hold a']);
    await c.settleNext();
    await c.flush();
    expect(c.sent).toEqual(['hold a', 'release']);
    expect(changes).toEqual([]);
  });

  it('a slot cleared while its PUT is in flight releases after it settles', async () => {
    const c = controlled();
    const { rerender, changes } = setup(c.api, { slot: slot('a') });
    await c.flush();
    rerender({ slot: null });
    await c.flush();
    expect(c.sent).toEqual(['hold a']);
    await c.settleNext();
    await c.flush();
    expect(c.sent).toEqual(['hold a', 'release']);
    expect(changes).toEqual([]);
  });

  it('asks for the slot again when the pause ends', async () => {
    const c = controlled();
    const { rerender } = setup(c.api, { slot: slot('a') });
    await c.flush();
    await c.settleNext();
    rerender({ slot: slot('a'), paused: true });
    await c.flush();
    expect(c.sent).toEqual(['hold a']);
    rerender({ slot: slot('a'), paused: false });
    await c.flush();
    expect(c.sent).toEqual(['hold a', 'hold a']);
  });

  it('sends no release when nothing was ever asked', async () => {
    const c = controlled();
    const { unmount } = setup(c.api, { slot: null });
    unmount();
    await c.flush();
    expect(c.sent).toEqual([]);
  });
});
