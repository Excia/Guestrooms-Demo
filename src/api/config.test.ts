import { parseApiUrl, resolveApiConfig } from './config';

describe('parseApiUrl', () => {
  it('reports a missing or blank value', () => {
    expect(parseApiUrl(undefined)).toMatchObject({ baseUrl: null, problem: 'missing' });
    expect(parseApiUrl('  ')).toMatchObject({ baseUrl: null, problem: 'missing' });
  });
  it('accepts https and trims trailing slashes', () => {
    expect(parseApiUrl('https://api.example.com/v1//')).toEqual({
      baseUrl: 'https://api.example.com/v1',
      warnings: [],
    });
  });
  it('strips query and hash', () => {
    expect(parseApiUrl('https://api.example.com/v1?x=1#top').baseUrl).toBe(
      'https://api.example.com/v1',
    );
  });
  it.each(['/api', 'api.example.com', 'ftp://x.test', 'javascript:alert(1)', 'https://u:p@x.test'])(
    'rejects %s',
    (value) => {
      const result = parseApiUrl(value);
      expect(result.baseUrl).toBeNull();
      expect(result.problem).toBe('invalid');
      expect(result.warnings).toHaveLength(1);
    },
  );
  it('warns about http outside localhost but not on localhost', () => {
    expect(parseApiUrl('http://api.example.com').warnings).toHaveLength(1);
    expect(parseApiUrl('http://api.example.com').baseUrl).toBe('http://api.example.com');
    expect(parseApiUrl('http://localhost:8080/api').warnings).toEqual([]);
    expect(parseApiUrl('http://127.0.0.1:8080').warnings).toEqual([]);
  });
});

describe('resolveApiConfig scenario', () => {
  it('defaults to normal', () => {
    expect(resolveApiConfig({ dev: true }).scenario).toBe('normal');
  });
  it('prefers query over storage over env in dev', () => {
    const base = { dev: true, envScenario: 'error', stored: 'empty' };
    expect(resolveApiConfig({ ...base, search: '?mock=loading' }).scenario).toBe('loading');
    expect(resolveApiConfig(base).scenario).toBe('empty');
    expect(resolveApiConfig({ dev: true, envScenario: 'error' }).scenario).toBe('error');
  });
  it('ignores query, storage AND env scenario in production', () => {
    const c = resolveApiConfig({
      dev: false,
      search: '?mock=error',
      stored: 'error',
      envScenario: 'error',
    });
    expect(c.scenario).toBe('normal');
  });
  it('ignores unknown scenario names', () => {
    expect(
      resolveApiConfig({ dev: true, search: '?mock=bogus', envScenario: 'nope' }).scenario,
    ).toBe('normal');
  });
  it('carries the URL result through', () => {
    expect(resolveApiConfig({ dev: false, apiUrl: 'https://a.test/' }).baseUrl).toBe(
      'https://a.test',
    );
  });
});
