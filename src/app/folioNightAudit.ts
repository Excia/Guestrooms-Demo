// "Has the night audit run for this reservation?" read off its folio, the way the legacy system
// infers it (owner decision 2026-10-24): the audit posts the room charges, so any folio charge that
// is Posted or Settled and did not come from the mobile POS means it has. Pure, no React.
import type { FolioCharge } from '../api/types';

export type AuditCharge = Pick<FolioCharge, 'type' | 'status'>;

export function nightAuditHasRunForFolio(charges: readonly AuditCharge[] | undefined): boolean {
  if (!charges) return false;
  return charges.some(
    (c) => (c.status === 'posted' || c.status === 'settled') && c.type !== 'mpos',
  );
}
