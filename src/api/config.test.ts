import { resolveApiConfig } from './config';

describe('resolveApiConfig', () => {
  it('uses the mock when VITE_API_URL is unset or blank', () => {
    expect(resolveApiConfig({ dev: true }).baseUrl).toBeNull();
    expect(resolveApiConfig({ apiUrl: '  ', dev: true }).baseUrl).toBeNull();
  });
  it('uses the real client with trailing slashes trimmed', () => {
    expect(resolveApiConfig({ apiUrl: 'https://api.example.com/v1//', dev: false }).baseUrl).toBe(
      'https://api.example.com/v1',
    );
  });
  it('defaults to the normal scenario', () => {
    expect(resolveApiConfig({ dev: true }).scenario).toBe('normal');
  });
  it('prefers query over storage over env in dev', () => {
    const base = { dev: true, envScenario: 'error', stored: 'empty' };
    expect(resolveApiConfig({ ...base, search: '?mock=loading' }).scenario).toBe('loading');
    expect(resolveApiConfig(base).scenario).toBe('empty');
    expect(resolveApiConfig({ dev: true, envScenario: 'error' }).scenario).toBe('error');
  });
  it('ignores query and storage outside dev', () => {
    const c = resolveApiConfig({ dev: false, search: '?mock=error', stored: 'error' });
    expect(c.scenario).toBe('normal');
  });
  it('ignores unknown scenario names', () => {
    expect(
      resolveApiConfig({ dev: true, search: '?mock=bogus', envScenario: 'nope' }).scenario,
    ).toBe('normal');
  });
});
