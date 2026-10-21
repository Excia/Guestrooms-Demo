import { useContext, useEffect } from 'react';
import { SystemSettingsContext, type SystemSettingsState } from './systemSettingsContext';

/** The club's System Settings; the first caller triggers the fetch. */
export function useSystemSettings(): SystemSettingsState {
  const state = useContext(SystemSettingsContext);
  const { load } = state;
  useEffect(() => load(), [load]);
  return state;
}
