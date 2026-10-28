import { useCallback, useEffect, useState } from 'react';
import { DELETE_ARM_MS, DELETE_LAPSE_MS } from '../../../app/photos';

// The legacy two-step delete (ImageContainerInput): the first click arms one photo, its Delete
// button works from DELETE_ARM_MS on (so a double click cannot delete) and the arming lapses after
// DELETE_LAPSE_MS. Arming another photo moves the arming.
export function usePendingDelete() {
  const [armedId, setArmedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (armedId === null) return;
    const arm = setTimeout(() => setReady(true), DELETE_ARM_MS);
    const lapse = setTimeout(() => {
      setArmedId(null);
      setReady(false);
    }, DELETE_LAPSE_MS);
    return () => {
      clearTimeout(arm);
      clearTimeout(lapse);
    };
  }, [armedId]);

  const arm = useCallback((id: string) => {
    setReady(false);
    setArmedId(id);
  }, []);
  const cancel = useCallback(() => {
    setReady(false);
    setArmedId(null);
  }, []);

  return { armedId, ready, arm, cancel };
}
