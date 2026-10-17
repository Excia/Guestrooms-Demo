import { getAxisUrl } from './axisUrl';

const origin = 'http://localhost:5173';

describe('getAxisUrl', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('uses a configured http(s) URL', () => {
    expect(getAxisUrl(' https://axis.example.com ', origin)).toBe('https://axis.example.com');
    expect(getAxisUrl('http://axis.test/home', origin)).toBe('http://axis.test/home');
  });
  it('accepts a same-origin path', () => {
    expect(getAxisUrl('/axis', origin)).toBe('/axis');
  });
  it('falls back to / when unset or blank', () => {
    expect(getAxisUrl(undefined, origin)).toBe('/');
    expect(getAxisUrl('  ', origin)).toBe('/');
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    'axis.example.com',
    '//evil.example',
    'ftp://x.test',
    '/\\evil.example',
    '/\t/evil.example',
    '/ok\n/evil.example',
  ])('rejects %s', (bad) => {
    expect(getAxisUrl(bad, origin)).toBe('/');
  });
});
