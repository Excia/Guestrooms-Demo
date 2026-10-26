import type { ReactNode } from 'react';
import { useReadOnly } from '../../app/readOnlyContext';

/** Renders its children only when the page is editable: the Add, Remove, Copy and Reorder actions. */
export default function EditOnly({ children }: { children: ReactNode }) {
  return useReadOnly() ? null : <>{children}</>;
}
