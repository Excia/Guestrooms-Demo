import { assertResourceId } from './validation';

describe('assertResourceId', () => {
  it.each(['', '  ', '.', '..'])('rejects %j', (id) => {
    expect(() => assertResourceId(id, 'reservation')).toThrowError(
      expect.objectContaining({ status: 400, code: 'invalid-id' }),
    );
  });
  it('accepts ordinary ids, including ones that need encoding', () => {
    expect(() => assertResourceId('res-1001', 'reservation')).not.toThrow();
    expect(() => assertResourceId('a/b', 'reservation')).not.toThrow();
    expect(() => assertResourceId('...', 'reservation')).not.toThrow();
  });
});
