import { createContext } from 'react';
import type { AccessStatus } from './access';

// Without an AccessProvider the grant never loaded, so nothing is allowed.
export const AccessStatusContext = createContext<AccessStatus>('error');
