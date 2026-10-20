import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DevUserSwitcher from './DevUserSwitcher';
import { MOCK_USER_STORAGE_KEY } from '../api/mockUsers';

describe('DevUserSwitcher', () => {
  const reload = vi.fn();
  beforeEach(() => {
    window.localStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { ...window.location, reload });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is a labelled select with the three mock users, defaulting to non-admin', () => {
    render(<DevUserSwitcher />);
    const select = screen.getByLabelText('Mock user (dev)');
    expect(select).toHaveValue('non-admin');
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual([
      'admin',
      'non-admin',
      'partial',
    ]);
  });

  it('stores the choice and reloads', async () => {
    render(<DevUserSwitcher />);
    await userEvent.selectOptions(screen.getByLabelText('Mock user (dev)'), 'partial');
    expect(window.localStorage.getItem(MOCK_USER_STORAGE_KEY)).toBe('partial');
    expect(reload).toHaveBeenCalledOnce();
  });
});
