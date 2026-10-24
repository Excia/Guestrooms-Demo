import { nightAuditHasRunForFolio } from './folioNightAudit';
import type { AuditCharge } from './folioNightAudit';

const c = (type: AuditCharge['type'], status: AuditCharge['status']): AuditCharge => ({
  type,
  status,
});

describe('nightAuditHasRunForFolio', () => {
  it('is false for a missing, empty or only-unposted folio', () => {
    expect(nightAuditHasRunForFolio(undefined)).toBe(false);
    expect(nightAuditHasRunForFolio([])).toBe(false);
    expect(nightAuditHasRunForFolio([c('room-rate', 'unposted'), c('add-on', 'unposted')])).toBe(
      false,
    );
  });
  it('is true once a charge is posted or settled', () => {
    expect(nightAuditHasRunForFolio([c('room-rate', 'unposted'), c('room-rate', 'posted')])).toBe(
      true,
    );
    expect(nightAuditHasRunForFolio([c('manual', 'settled')])).toBe(true);
  });
  it('ignores mobile POS charges, whatever their status', () => {
    expect(nightAuditHasRunForFolio([c('mpos', 'posted'), c('mpos', 'settled')])).toBe(false);
    expect(nightAuditHasRunForFolio([c('mpos', 'posted'), c('surcharge', 'posted')])).toBe(true);
  });
  it('a split parent alone does not count', () => {
    expect(nightAuditHasRunForFolio([c('split-parent', 'split')])).toBe(false);
  });
});
