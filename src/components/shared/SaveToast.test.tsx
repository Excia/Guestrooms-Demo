import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveToast from './SaveToast';

describe('SaveToast', () => {
  afterEach(() => vi.useRealTimers());

  it('announces the message in a polite live region', () => {
    render(<SaveToast open onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Report Saved');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders nothing while closed', () => {
    render(<SaveToast open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses itself after the auto-hide time', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<SaveToast open onClose={onClose} autoHideDuration={3000} />);
    act(() => vi.advanceTimersByTime(2900));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the Dismiss button', async () => {
    const onClose = vi.fn();
    render(<SaveToast open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Undo only when a handler is given and closes after it', async () => {
    const { rerender } = render(<SaveToast open onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    const onUndo = vi.fn();
    const onClose = vi.fn();
    rerender(<SaveToast open onClose={onClose} onUndo={onUndo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks elsewhere on the page', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button>Elsewhere</button>
        <SaveToast open onClose={onClose} />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
