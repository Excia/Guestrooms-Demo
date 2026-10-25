import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { useState } from 'react';
import { theme } from '../../theme';
import TimeField, { type TimeFieldProps } from './TimeField';

function Harness({
  initial = '16:00',
  onValue,
  ...rest
}: { initial?: string; onValue?: (v: string) => void } & Partial<TimeFieldProps>) {
  const [value, setValue] = useState(initial);
  return (
    <ThemeProvider theme={theme}>
      <TimeField
        label="Check In Time"
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue?.(v);
        }}
        {...rest}
      />
    </ThemeProvider>
  );
}

const input = () => screen.getByLabelText('Check In Time');
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Choose check in time' }));
  return screen.findByRole('dialog', { name: 'Choose check in time' });
};

describe('TimeField', () => {
  it('shows the stored HH:mm value as hh:mm AM/PM', () => {
    render(<Harness />);
    expect(input()).toHaveValue('04:00 PM');
  });

  it('draws the clock button in the primary (green) colour', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Choose check in time' });
    expect(getComputedStyle(button).color).toBe(hexToRgb(theme.palette.primary.main));
  });

  it('opens from the button and closes with Escape, returning focus to the input', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    expect(screen.getByRole('slider', { name: 'Hours' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it('opens with Alt+ArrowDown from the input', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    input().focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('chooses the hour, then the minute, then AM/PM with the keyboard', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await open(user);
    const hours = screen.getByRole('slider', { name: 'Hours' });
    await waitFor(() => expect(hours).toHaveFocus());
    expect(hours).toHaveAttribute('aria-valuenow', '4');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(hours).toHaveAttribute('aria-valuenow', '6');
    await user.keyboard('{Enter}');
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    await waitFor(() => expect(minutes).toHaveFocus());
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(minutes).toHaveAttribute('aria-valuenow', '15');
    await user.click(screen.getByRole('button', { name: 'AM' }));
    expect(onValue).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onValue).toHaveBeenCalledWith('06:15'));
    expect(input()).toHaveValue('06:15 AM');
  });

  it('picks by pointer on the dial: hour first, then it moves to the minutes', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    dial.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 240, height: 240, right: 240, bottom: 240 }) as DOMRect;
    // 3 o'clock is straight right of the centre (120, 120).
    fireEvent.pointerDown(dial, { clientX: 200, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(dial, { pointerId: 1 });
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    minutes.getBoundingClientRect = dial.getBoundingClientRect;
    // 30 minutes is straight below the centre.
    fireEvent.pointerDown(minutes, { clientX: 120, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(minutes, { pointerId: 1 });
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onValue).toHaveBeenCalledWith('15:30'));
  });

  it('Cancel leaves the value alone', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await open(user);
    await user.keyboard('{ArrowUp}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onValue).not.toHaveBeenCalled();
    expect(input()).toHaveValue('04:00 PM');
  });

  it('accepts typed input in hh:mm AM/PM and stores HH:mm', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.clear(input());
    expect(onValue).toHaveBeenLastCalledWith('');
    await user.type(input(), '11:45 pm');
    expect(onValue).toHaveBeenLastCalledWith('23:45');
    await user.tab({ shift: false });
    await user.tab();
    expect(input()).toHaveValue('11:45 PM');
  });

  it('restores the last good time when the typed text is not a time', async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.type(input(), 'x', { initialSelectionStart: 0, initialSelectionEnd: 8 });
    expect(input()).toHaveValue('x');
    await user.tab();
    await user.tab();
    expect(input()).toHaveValue('09:00 AM');
  });

  it('skips and greys out times that are not allowed (late checkout range)', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(
      <Harness initial="13:00" onValue={onValue} isAllowed={(t) => t > 12 * 60 && t <= 15 * 60} />,
    );
    await open(user);
    const hours = screen.getByRole('slider', { name: 'Hours' });
    await user.keyboard('{ArrowUp}');
    expect(hours).toHaveAttribute('aria-valuenow', '2');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    // 4 PM and later have no allowed time: the next hour wraps to 12 PM (12:05).
    expect(hours).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('button', { name: 'AM' })).toBeDisabled();
  });

  it('disables the button and the input when disabled', () => {
    render(<Harness disabled />);
    expect(screen.getByRole('button', { name: 'Choose check in time' })).toBeDisabled();
    expect(input()).toBeDisabled();
  });
});

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
