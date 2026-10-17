import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Fragment, StrictMode, useState, type ComponentType, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';
import NonActionableDialog from './NonActionableDialog';

function ConfirmHarness({ onDiscard = vi.fn(), onConfirm = vi.fn() }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Leave page</button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onDiscard={() => {
          onDiscard();
          setOpen(false);
        }}
      />
    </>
  );
}

// Focus handling must hold under StrictMode too (double-invoked effects in dev).
const WRAPPERS: Array<[string, ComponentType<{ children?: ReactNode }>]> = [
  ['plain', Fragment],
  ['StrictMode', StrictMode],
];

describe.each(WRAPPERS)('ConfirmDialog (Confirm Leaving), %s', (_name, Wrapper) => {
  it('is a labelled, described modal with the Figma copy', async () => {
    render(<ConfirmHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    const dialog = await screen.findByRole('dialog', { name: 'This report has not been saved.' });
    expect(dialog).toHaveAccessibleDescription('Are you sure you want to leave without saving?');
    expect(screen.getByRole('button', { name: 'Leave without saving' })).toBeInTheDocument();
  });

  it('moves focus to the safe primary action on open', async () => {
    render(<ConfirmHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save now' })).toHaveFocus());
  });

  it('keeps Tab inside the dialog', async () => {
    render(<ConfirmHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    await screen.findByRole('dialog');
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('Escape closes it and returns focus to the opener', async () => {
    render(<ConfirmHarness />, { wrapper: Wrapper });
    const opener = screen.getByRole('button', { name: 'Leave page' });
    await userEvent.click(opener);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('runs the matching action', async () => {
    const onDiscard = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onDiscard={onDiscard} onConfirm={onConfirm} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Enter on the initial focus saves rather than discards', async () => {
    const onDiscard = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onDiscard={onDiscard} onConfirm={onConfirm} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save now' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });
});

function InfoHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Details</button>
      <NonActionableDialog open={open} onClose={() => setOpen(false)} title="FYI">
        Some information.
      </NonActionableDialog>
    </>
  );
}

describe.each(WRAPPERS)('NonActionableDialog, %s', (_name, Wrapper) => {
  it('focuses the close button, has a title and body', async () => {
    render(<InfoHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog', { name: 'FYI' });
    expect(dialog).toHaveAccessibleDescription('Some information.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  });

  it('closes with the button and restores focus', async () => {
    render(<InfoHarness />, { wrapper: Wrapper });
    const opener = screen.getByRole('button', { name: 'Details' });
    await userEvent.click(opener);
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('closes with Escape', async () => {
    render(<InfoHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
