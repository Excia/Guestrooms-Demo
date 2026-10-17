import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import DemoDataChip from './DemoDataChip';

describe('DemoDataChip', () => {
  it('shows visible "Demo data" text', () => {
    render(<DemoDataChip />);
    expect(screen.getByText('Demo data')).toBeVisible();
  });

  it('stacks above page content but below the menu overlay (drawer level)', () => {
    render(
      <ThemeProvider theme={theme}>
        <DemoDataChip />
      </ThemeProvider>,
    );
    const zIndex = Number(getComputedStyle(screen.getByText('Demo data').parentElement!).zIndex);
    expect(zIndex).toBe(theme.zIndex.speedDial);
    expect(zIndex).toBeLessThan(theme.zIndex.drawer);
    expect(zIndex).toBeGreaterThan(theme.zIndex.mobileStepper);
  });
});
