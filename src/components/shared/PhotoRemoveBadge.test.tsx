import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../theme';
import PhotoRemoveBadge from './PhotoRemoveBadge';

describe('PhotoRemoveBadge', () => {
  it('is a 20px red circle with a white X inside a 24px target, with a name', async () => {
    const onClick = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <PhotoRemoveBadge label="Remove photo a.jpg" onClick={onClick} />
      </ThemeProvider>,
    );
    const button = screen.getByRole('button', { name: 'Remove photo a.jpg' });
    expect(getComputedStyle(button).width).toBe('24px');
    expect(getComputedStyle(button).height).toBe('24px');
    const circle = screen.getByTestId('photo-remove-circle');
    const style = getComputedStyle(circle);
    expect(style.width).toBe('20px');
    expect(style.height).toBe('20px');
    expect(style.backgroundColor).toBe('rgb(211, 47, 47)');
    expect(style.color).toBe('rgb(255, 255, 255)');
    expect(style.boxShadow).toContain('#ffffff');
    await userEvent.setup().click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
