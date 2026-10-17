import { render, screen } from '@testing-library/react';
import { ApiProvider, useApi } from './ApiProvider';
import { createMockClient } from './mock';
import { useEffect, useState } from 'react';

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
    render(
      <ApiProvider client={createMockClient({ scenario })}>
        <Probe />
      </ApiProvider>,
    );
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
