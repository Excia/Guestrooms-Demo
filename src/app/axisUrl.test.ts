import { getAxisUrl } from './axisUrl';

describe('getAxisUrl', () => {
  it('uses the configured URL', () => {
    expect(getAxisUrl(' https://axis.example.com ')).toBe('https://axis.example.com');
  });
  it('falls back to / when unset or blank', () => {
    expect(getAxisUrl(undefined)).toBe('/');
    expect(getAxisUrl('  ')).toBe('/');
  });
});
