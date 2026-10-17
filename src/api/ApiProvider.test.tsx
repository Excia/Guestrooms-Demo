import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { ApiProvider, useApi } from './ApiProvider';
import { createMockClient } from './mock';
import { renderWithApi } from './testing';

function Probe() {
  const api = useApi();
  const [text, setText] = useState('loading');
  useEffect(() => {
    api.dashboard.getStats().then(
      (s) => setText(s.rateCategories.length ? 'data' : 'empty'),
      () => setText('error'),
    );
  }, [api]);
  return <p>{text}</p>;
}

describe('ApiProvider', () => {
  it.each([
    ['normal', 'data'],
    ['empty', 'empty'],
    ['error', 'error'],
    ['loading', 'loading'],
  ] as const)('exposes the %s scenario to components', async (scenario, expected) => {
    renderWithApi(<Probe />, { client: createMockClient({ scenario }) });
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('follows the client prop when it changes', async () => {
    const { rerender } = render(
      <ApiProvider client={createMockClient({ scenario: 'error' })}>
        <Probe />
      </ApiProvider>,
    );
    expect(await screen.findByText('error')).toBeInTheDocument();
    rerender(
      <ApiProvider client={createMockClient({ scenario: 'normal' })}>
        <Probe />
      </ApiProvider>,
    );
    expect(await screen.findByText('data')).toBeInTheDocument();
  });

  it('throws a clear error outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <ApiProvider>/);
    spy.mockRestore();
  });
});
