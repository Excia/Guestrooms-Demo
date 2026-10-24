import { createContext } from 'react';
import type { SystemSettings } from '../api/types';

export type SystemSettingsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SystemSettingsState {
  /** False without a provider: nothing will ever load, so no one should wait for the settings. */
  provided: boolean;
  status: SystemSettingsStatus;
  /** Null until loaded. Consumers fall back to their defaults meanwhile (switches read as off). */
  settings: SystemSettings | null;
  /** Starts the first fetch; a no-op once loading or loaded. */
  load: () => void;
  /** Retries after an error. */
  reload: () => void;
  /** Publishes settings the backend just stored, so the rest of the app sees them at once. */
  apply: (saved: SystemSettings) => void;
}

// Without a provider nothing is loaded and every flag reads as its default.
export const SystemSettingsContext = createContext<SystemSettingsState>({
  provided: false,
  status: 'idle',
  settings: null,
  load: () => {},
  reload: () => {},
  apply: () => {},
});
