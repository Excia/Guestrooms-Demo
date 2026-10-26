import { createPermissions } from './permissions';
import {
  changedFields,
  fieldsToUnlock,
  lockedFields,
  missingFields,
  unlockMessage,
  UNLOCK_PERMISSION,
} from './overrideUnlock';

const all = createPermissions().can;
const none = createPermissions([]).can;
const onlyRoom = createPermissions([UNLOCK_PERMISSION.room]).can;
const a = { id: 'r1', roomTypeId: 't1', locationId: 'l1' };

describe('lockedFields', () => {
  it('shows no lock to a user who holds the functions', () => {
    expect(lockedFields(all, new Set()).size).toBe(0);
  });
  it('locks the fields whose function is missing, and only those', () => {
    expect([...lockedFields(onlyRoom, new Set())]).toEqual(['location', 'roomType']);
    expect([...lockedFields(none, new Set())]).toEqual(['location', 'roomType', 'room']);
  });
  it('an unlocked field stays open', () => {
    expect([...lockedFields(none, new Set(['roomType'] as const))]).toEqual(['location', 'room']);
  });
});

describe('changedFields and missingFunctions', () => {
  it('a different room of the same type and location changes only the room', () => {
    const changed = changedFields([{ from: a, to: { ...a, id: 'r2' } }]);
    expect([...changed]).toEqual(['room']);
    expect(missingFields(changed, onlyRoom)).toEqual([]);
    expect(missingFields(changed, none)).toEqual(['room']);
  });
  it('another room type and location add those fields', () => {
    const changed = changedFields([
      { from: a, to: { id: 'r3', roomTypeId: 't2', locationId: 'l2' } },
    ]);
    expect([...changed].sort()).toEqual(['location', 'room', 'roomType']);
    expect(missingFields(changed, onlyRoom)).toEqual(['location', 'roomType']);
  });
  it('an unchanged night changes nothing', () => {
    expect(changedFields([{ from: a, to: a }]).size).toBe(0);
  });
});

describe('fieldsToUnlock and unlockMessage', () => {
  it('lists only the changed fields that are still locked', () => {
    const changed = new Set(['room', 'roomType'] as const);
    expect(fieldsToUnlock(changed, new Set(['roomType', 'location'] as const))).toEqual([
      'roomType',
    ]);
    expect(fieldsToUnlock(changed, new Set())).toEqual([]);
  });
  it('words the instruction', () => {
    expect(unlockMessage(['room'])).toBe('Unlock Room to make this change.');
    expect(unlockMessage(['location', 'roomType', 'room'])).toBe(
      'Unlock Location, Room Type and Room to make this change.',
    );
  });
});
