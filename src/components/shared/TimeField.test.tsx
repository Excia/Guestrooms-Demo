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

  const RECT = { left: 0, top: 0, width: 240, height: 240, right: 240, bottom: 240 };
  const layout = (el: Element, rect = RECT) => {
    el.getBoundingClientRect = () => rect as DOMRect;
  };
  const tap = (el: Element, x: number, y: number) => {
    fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  };

  it('picks by pointer on the dial: hour first, then it moves to the minutes', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial);
    // 3 o'clock is straight right of the centre (120, 120).
    tap(dial, 200, 120);
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    layout(minutes);
    // 30 minutes is straight below the centre.
    tap(minutes, 120, 200);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onValue).toHaveBeenCalledWith('15:30'));
  });

  it('scales a dial drawn at another size', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial, { left: 100, top: 50, width: 480, height: 480, right: 580, bottom: 530 });
    // 9 o'clock: left of the centre (340, 290) by 160 of 480 px.
    tap(dial, 180, 290);
    expect(await screen.findByRole('slider', { name: 'Minutes' })).toHaveAttribute(
      'aria-valuetext',
      '0 minutes, 9:00 PM',
    );
  });

  it('reads a pointer just left of 12 as 12 and a minute at 358 degrees as 00', async () => {
    const user = userEvent.setup();
    render(<Harness initial="16:15" />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial);
    const x = 120 - 100 * Math.sin((2 * Math.PI) / 180);
    const y = 120 - 100 * Math.cos((2 * Math.PI) / 180);
    tap(dial, x, y);
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    expect(minutes).toHaveAttribute('aria-valuetext', '15 minutes, 12:15 PM');
    layout(minutes);
    tap(minutes, x, y);
    expect(minutes).toHaveAttribute('aria-valuenow', '0');
  });

  it('follows a drag across several hours and advances on release', async () => {
    const user = userEvent.setup();
    render(<Harness initial="12:00" />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial);
    fireEvent.pointerDown(dial, { clientX: 200, clientY: 120, pointerId: 1, button: 0 });
    expect(dial).toHaveAttribute('aria-valuenow', '3');
    fireEvent.pointerMove(dial, { clientX: 120, clientY: 200, pointerId: 1 });
    expect(dial).toHaveAttribute('aria-valuenow', '6');
    fireEvent.pointerMove(dial, { clientX: 40, clientY: 120, pointerId: 1 });
    expect(dial).toHaveAttribute('aria-valuenow', '9');
    fireEvent.pointerUp(dial, { clientX: 40, clientY: 120, pointerId: 1 });
    expect(await screen.findByRole('slider', { name: 'Minutes' })).toBeInTheDocument();
  });

  it('does not pick at the exact centre, outside the circle, or with another button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial);
    tap(dial, 120, 120);
    tap(dial, 239, 239);
    fireEvent.pointerDown(dial, { clientX: 200, clientY: 120, pointerId: 1, button: 2 });
    fireEvent.pointerUp(dial, { clientX: 200, clientY: 120, pointerId: 1, button: 2 });
    expect(dial).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByRole('slider', { name: 'Hours' })).toBeInTheDocument();
  });

  it('ignores a tap on a greyed hour and minute and stays on the face', async () => {
    const user = userEvent.setup();
    render(<Harness initial="13:00" isAllowed={(t) => t > 12 * 60 && t <= 15 * 60} />);
    await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    layout(dial);
    // 6 o'clock has no allowed time in the PM range.
    tap(dial, 120, 200);
    expect(dial).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByRole('slider', { name: 'Minutes' })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    layout(minutes);
    await user.keyboard('{End}');
    expect(minutes).toHaveAttribute('aria-valuenow', '55');
    // 1:30 is fine; 3:00 PM is the last time, so pick hour 3 later; here 1:55 is allowed.
    expect(minutes).toHaveAttribute('aria-describedby');
  });

  it('announces the mode, spells AM/PM in the value text and handles PageUp/PageDown', async () => {
    const user = userEvent.setup();
    render(<Harness initial="18:15" />);
    await open(user);
    const hours = screen.getByRole('slider', { name: 'Hours' });
    expect(hours).toHaveAttribute('aria-valuetext', '6 PM');
    expect(hours).not.toHaveAttribute('aria-orientation');
    await user.keyboard('{PageUp}');
    expect(hours).toHaveAttribute('aria-valuenow', '9');
    await user.keyboard('{PageDown}{Enter}');
    const minutes = await screen.findByRole('slider', { name: 'Minutes' });
    expect(screen.getByRole('status')).toHaveTextContent('Minutes, 15');
    expect(minutes).toHaveAttribute('aria-valuetext', '15 minutes, 6:15 PM');
    await waitFor(() => expect(minutes).toHaveFocus());
    await user.keyboard('{PageUp}');
    expect(minutes).toHaveAttribute('aria-valuenow', '30');
    expect(screen.getByRole('button', { name: 'Hours 06' })).toBeInTheDocument();
  });

  it('returns focus to the input and drops half-typed text on every way out', async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    input().focus();
    await user.type(input(), '{End}x');
    await open(user);
    await user.click(document.querySelector('.MuiBackdrop-root') as Element);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(input()).toHaveFocus());
    expect(input()).toHaveValue('09:00 AM');
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(input()).toHaveFocus());
    await open(user);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it('opens with F4', async () => {
    render(<Harness />);
    input().focus();
    fireEvent.keyDown(input(), { key: 'F4' });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('types 12 AM as midnight and 12 PM as noon, and waits for a complete time', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.clear(input());
    onValue.mockClear();
    await user.type(input(), '12:0');
    expect(onValue).not.toHaveBeenCalled();
    await user.type(input(), '0 am');
    expect(onValue).toHaveBeenLastCalledWith('00:00');
    await user.clear(input());
    await user.type(input(), '12:00 pm');
    expect(onValue).toHaveBeenLastCalledWith('12:00');
    await user.clear(input());
    onValue.mockClear();
    await user.type(input(), '4:05');
    expect(onValue).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('04:05');
  });

  it('turns the clock button off while keeping the field typeable', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness pickerDisabled onValue={onValue} />);
    expect(screen.getByRole('button', { name: 'Choose check in time' })).toBeDisabled();
    await user.clear(input());
    await user.type(input(), '5:00 pm');
    expect(onValue).toHaveBeenLastCalledWith('17:00');
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

  it('draws the dial ring and the AM/PM toggles in the primary green', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    const ring = screen.getByTestId('clock-ring');
    expect(ring).toHaveAttribute('stroke', theme.palette.primary.main);
    // 4:00 PM: PM is selected (filled primary, contrast text), AM is outlined with primary text.
    const pm = screen.getByRole('button', { name: 'PM' });
    const am = screen.getByRole('button', { name: 'AM' });
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    expect(getComputedStyle(pm).backgroundColor).toBe('rgb(46, 125, 50)');
    expect(getComputedStyle(pm).color).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(am).color).toBe('rgb(46, 125, 50)');
  });

  it('uses no default MUI blue anywhere in the open picker, in any state', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await open(user);
    const dial = screen.getByRole('slider', { name: 'Hours' });
    const defaultBlues = [
      'rgb(25, 118, 210)',
      'rgb(66, 165, 245)',
      'rgb(144, 202, 248)',
      'rgb(21, 101, 192)',
      'rgb(33, 150, 243)',
    ];
    const props = ['outlineColor', 'borderTopColor', 'backgroundColor', 'color', 'stroke', 'fill'];
    const scan = () => {
      for (const el of [dialog, ...Array.from(dialog.querySelectorAll('*'))]) {
        const style = getComputedStyle(el);
        for (const prop of props) {
          expect(defaultBlues, `${el.tagName} ${prop}`).not.toContain(
            style[prop as keyof CSSStyleDeclaration] as string,
          );
        }
      }
    };
    scan();
    // Hover, focus and press the dial and the toggles.
    for (const el of [
      dial,
      screen.getByRole('button', { name: 'AM' }),
      screen.getByRole('button', { name: /^Minutes/ }),
    ]) {
      await user.hover(el);
      el.focus();
      scan();
    }
    fireEvent.pointerDown(dial, { button: 0, pointerId: 1 });
    scan();
    // The dial hides the browser outline and only keyboard focus draws the green one.
    expect(getComputedStyle(dial).outlineStyle).toBe('none');
    const rules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .filter((text) => text.includes('focus-visible') && text.includes('outline'))
      .join('\n');
    expect(rules).toContain(theme.palette.primary.main);
    for (const blue of defaultBlues) expect(rules).not.toContain(blue);
  });
});

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
