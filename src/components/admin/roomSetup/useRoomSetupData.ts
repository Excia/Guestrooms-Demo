import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { RoomSetup, RoomSetupOptions, RoomTypeSetup } from '../../../api/types';

export interface RoomSetupData {
  status: 'loading' | 'error' | 'ready';
  options: RoomSetupOptions | null;
  roomTypes: RoomTypeSetup[];
  rooms: RoomSetup[];
  /** Retry after a load error. */
  reload: () => void;
  /** Re-reads room types and rooms after a save or delete (a save can change the other list too). */
  refresh: () => Promise<void>;
}

// Room Types and Rooms read each other (usage counts, the room type select, inherited details),
// so both pages load the options and both lists together.
export function useRoomSetupData(): RoomSetupData {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: RoomSetupData['status'];
    options: RoomSetupOptions | null;
    roomTypes: RoomTypeSetup[];
    rooms: RoomSetup[];
  }>({ status: 'loading', options: null, roomTypes: [], rooms: [] });

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    Promise.all([
      api.roomSetup.getOptions(signal),
      api.roomSetup.listRoomTypes(signal),
      api.roomSetup.listRooms(signal),
    ])
      .then(([options, roomTypes, rooms]) =>
        setState({ status: 'ready', options, roomTypes, rooms }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [api, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    const [roomTypes, rooms] = await Promise.all([
      api.roomSetup.listRoomTypes(),
      api.roomSetup.listRooms(),
    ]);
    setState((s) => ({ ...s, roomTypes, rooms }));
  }, [api]);

  return { ...state, reload, refresh };
}
