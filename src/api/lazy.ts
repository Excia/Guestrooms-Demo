import type { ApiClient } from './types';

type Method = (...args: unknown[]) => unknown;

/**
 * An ApiClient that loads its implementation on first use, so code behind `load` (the mock and
 * its data) lands in a separate chunk and real-URL builds never fetch it.
 *
 * Areas and methods are forwarded by name, so a new endpoint needs no entry here.
 */
export function createLazyClient(load: () => Promise<ApiClient>): ApiClient {
  let loaded: Promise<ApiClient> | undefined;
  const client = () =>
    (loaded ??= load().catch((error) => {
      loaded = undefined; // let the next call retry
      throw error;
    }));
  const area = (name: keyof ApiClient) =>
    new Proxy(
      {},
      {
        get: (_target, method) =>
          // Not a method name: keeps the proxies from looking like a thenable or being inspected.
          typeof method === 'symbol' || method === 'then'
            ? undefined
            : (...args: unknown[]) =>
                client().then((c) => {
                  const target = c[name] as unknown as Record<string, Method>;
                  return target[method](...args);
                }),
      },
    );
  return new Proxy({} as ApiClient, {
    get: (_target, name) =>
      typeof name === 'symbol' || name === 'then' ? undefined : area(name as keyof ApiClient),
  });
}
