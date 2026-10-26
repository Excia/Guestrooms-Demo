import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import type { CheckInPastDatePlan } from '../../app/checkInDecision';
import { PastDateCheckInDialog } from './CheckInDialogs';

const plan = { originalArrival: '2026-10-23', split: false } as unknown as CheckInPastDatePlan;

function renderPrompt(level: 'any-time' | 'arrival-date-only', split = false, onClose = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <PastDateCheckInDialog
        open
        plan={{ ...plan, split }}
        level={level}
        onFirst={vi.fn()}
        onContinue={vi.fn()}
        onClose={onClose}
      />
    </ThemeProvider>,
  );
  return onClose;
}

describe('PastDateCheckInDialog layout', () => {
  it('puts the title and the close icon in one heading row', () => {
    renderPrompt('any-time');
    const dialog = screen.getByRole('dialog');
    const heading = within(dialog).getByRole('heading');
    expect(within(heading).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(heading).toHaveTextContent('has passed');
    expect(getComputedStyle(heading).display).toBe('flex');
    expect(getComputedStyle(heading).justifyContent).toBe('space-between');
  });

  it('stacks full-width actions with the same side padding as the text and no tooltips', () => {
    renderPrompt('any-time');
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') !== 'Close');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Adjust reservation dates',
      'Check in for original date',
    ]);
    const actions = buttons[0].parentElement!;
    expect(getComputedStyle(actions).flexDirection).toBe('column');
    expect(getComputedStyle(actions).paddingLeft).toBe(getComputedStyle(actions).paddingRight);
    for (const b of buttons) {
      expect(b).not.toHaveAttribute('title');
      expect(getComputedStyle(b).width).toBe('100%');
    }
    expect(buttons[1]).not.toHaveStyle({ marginLeft: '8px' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the first action focused, then the second, in DOM order', async () => {
    renderPrompt('any-time');
    expect(screen.getByRole('button', { name: 'Adjust reservation dates' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Check in for original date' })).toHaveFocus();
  });

  it('uses the same layout for the split and override variants', () => {
    renderPrompt('arrival-date-only', true);
    expect(
      screen.getByRole('button', { name: 'Split this room from the reservation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Override and check in' })).toBeInTheDocument();
  });
});
