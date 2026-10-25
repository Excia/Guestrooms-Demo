import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../theme';
import RemoveIconButton from './RemoveIconButton';

const renderButton = (props: Partial<Parameters<typeof RemoveIconButton>[0]> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <RemoveIconButton label="Main Clubhouse" onClick={() => {}} {...props} />
    </ThemeProvider>,
  );

describe('RemoveIconButton', () => {
  it('is named "Remove <label>" and calls onClick', async () => {
    const onClick = vi.fn();
    renderButton({ onClick });
    await userEvent.click(screen.getByRole('button', { name: 'Remove Main Clubhouse' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('draws the trash can in the error colour by default', () => {
    renderButton();
    const button = screen.getByRole('button', { name: 'Remove Main Clubhouse' });
    expect(button.className).toMatch(/colorError/);
    expect(button.querySelector('[data-testid="DeleteIcon"]')).not.toBeNull();
  });

  it('uses the neutral colour when asked', () => {
    renderButton({ tone: 'neutral' });
    expect(screen.getByRole('button', { name: 'Remove Main Clubhouse' }).className).not.toMatch(
      /colorError/,
    );
  });

  it('explains why it is disabled', () => {
    renderButton({ disabled: true, disabledReason: 'A club needs at least one location' });
    const button = screen.getByRole('button', { name: 'Remove Main Clubhouse' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('A club needs at least one location');
  });

  it('is keyboard operable', async () => {
    const onClick = vi.fn();
    renderButton({ onClick });
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Remove Main Clubhouse' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
