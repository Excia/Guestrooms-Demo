import { emptyGuestForm, validateGuest } from './guest';

describe('add guest validation', () => {
  it('needs only a name', () => {
    expect(validateGuest({ ...emptyGuestForm, name: 'Ann Lee' })).toEqual({});
    expect(validateGuest(emptyGuestForm).name).toBeDefined();
    expect(validateGuest({ ...emptyGuestForm, name: '   ' }).name).toBeDefined();
    expect(validateGuest({ ...emptyGuestForm, name: 'x'.repeat(201) }).name).toMatch(/too long/);
  });

  it('checks email and phone only when given', () => {
    const ok = { name: 'A', email: 'a@b.co', phone: '+1 (555) 010-0100' };
    expect(validateGuest(ok)).toEqual({});
    expect(validateGuest({ ...ok, email: 'nope' }).email).toBeDefined();
    expect(validateGuest({ ...ok, phone: 'call me' }).phone).toBeDefined();
    expect(validateGuest({ ...ok, phone: '5'.repeat(41) }).phone).toMatch(/too long/);
    expect(validateGuest({ name: 'A', email: ' ', phone: ' ' })).toEqual({});
  });
});
