import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import AccessDeniedNotice from './AccessDeniedNotice';
import type { AccessDeniedReason, AccessDeniedState } from './RequireAccess';

function Harness() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const deny = (reason: AccessDeniedReason) => {
    const next: AccessDeniedState = { accessDenied: { reason } };
    navigate('/dashboard', { state: next, replace: true });
  };
  return (
    <>
      <button onClick={() => deny('denied')}>deny</button>
      <button onClick={() => deny('error')}>deny error</button>
      <output data-testid="state">{state ? 'state' : 'clean'}</output>
      <main tabIndex={-1}>page</main>
      <AccessDeniedNotice />
    </>
  );
}

const setup = (strict = false) => {
  const tree = (
    <MemoryRouter initialEntries={['/dashboard']}>
      <Harness />
    </MemoryRouter>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return userEvent.setup();
};

describe.each([false, true])('AccessDeniedNotice (StrictMode: %s)', (strict) => {
  it('shows nothing without a denial', () => {
    setup(strict);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows once per denial: dismiss, then a second denial shows it again', async () => {
    const user = setup(strict);
    await user.click(screen.getByRole('button', { name: 'deny' }));
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean'));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('state')).toHaveTextContent('clean'); // dismissed: not replayed

    await user.click(screen.getByRole('button', { name: 'deny', hidden: true }));
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('does not stack a second dialog for a denial while one is open', async () => {
    const user = setup(strict);
    await user.click(screen.getByRole('button', { name: 'deny' }));
    await screen.findByRole('dialog', { name: 'No access' });
    // The page behind a modal is inert; trigger the second denial directly.
    screen.getByRole('button', { name: 'deny error', hidden: true }).click();
    expect(
      await screen.findByRole('dialog', { name: 'Access could not be checked' }),
    ).toBeVisible();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('moves focus to the main landmark when the dialog closes', async () => {
    const user = setup(strict);
    await user.click(screen.getByRole('button', { name: 'deny' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });
});
