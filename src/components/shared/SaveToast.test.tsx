import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveToast from './SaveToast';

describe('SaveToast', () => {
  afterEach(() => vi.useRealTimers());

  it('announces the message through an always-mounted live region', () => {
    const { rerender } = render(<SaveToast open={false} onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    rerender(<SaveToast open onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Report Saved');
    expect(status).not.toHaveAttribute('aria-live');
  });

  it('the visible toast is not a second live region', () => {
    render(<SaveToast open onClose={vi.fn()} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Notification' })).toHaveTextContent('Report Saved');
  });

  it('renders no toast while closed', () => {
    render(<SaveToast open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Notification' })).not.toBeInTheDocument();
  });

  it('re-announces when the message or saveId changes while open', () => {
    const { rerender } = render(<SaveToast open onClose={vi.fn()} message="One" />);
    const first = screen.getByRole('status').firstElementChild;
    rerender(<SaveToast open onClose={vi.fn()} message="Two" />);
    expect(screen.getByRole('status')).toHaveTextContent('Two');
    expect(screen.getByRole('status').firstElementChild).not.toBe(first);
    const second = screen.getByRole('status').firstElementChild;
    rerender(<SaveToast open onClose={vi.fn()} message="Two" saveId={2} />);
    expect(screen.getByRole('status').firstElementChild).not.toBe(second);
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

  it('a repeated save restarts the timer', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<SaveToast open onClose={onClose} autoHideDuration={3000} />);
    act(() => vi.advanceTimersByTime(2000));
    rerender(<SaveToast open onClose={onClose} autoHideDuration={3000} saveId={1} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1100));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-hide while an Undo action is shown', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<SaveToast open onClose={onClose} onUndo={vi.fn()} autoHideDuration={1000} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(onClose).not.toHaveBeenCalled();
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
