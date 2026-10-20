import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ApiProvider } from './ApiProvider';
import { createMockClient } from './mock';
import type { ApiClient } from './types';

/** Test helper: render under an ApiProvider (a zero-latency mock unless `client` is given). */
export function renderWithApi(
  ui: ReactElement,
  {
    client = createMockClient(),
    ...options
  }: { client?: ApiClient } & Omit<RenderOptions, 'wrapper'> = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <ApiProvider client={client}>{children}</ApiProvider>,
    ...options,
  });
}
