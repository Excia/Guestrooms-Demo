import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { theme } from '../../../theme';
import NightsStepper from './NightsStepper';

function cssText() {
  return [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('');
}

describe('NightsStepper', () => {
  it('shows the value with two digits between a minus and a plus control', () => {
    render(
      <ThemeProvider theme={theme}>
        <NightsStepper
          label="Alternative Base Rate 1 nights"
          value={6}
          min={1}
          onChange={() => {}}
        />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Decrease Alternative Base Rate 1 nights' }),
    ).toBeInTheDocument();
    expect(screen.getByText('06')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Increase Alternative Base Rate 1 nights' }),
    ).toBeInTheDocument();
  });

  it('draws a divider line between the minus control and the value, like the one before the plus', () => {
    render(
      <ThemeProvider theme={theme}>
        <NightsStepper label="Nights" value={6} min={1} onChange={() => {}} />
      </ThemeProvider>,
    );
    // The value cell owns the left border; ButtonGroup hides the minus button's right border.
    expect(cssText()).toMatch(/border-left:1px solid [^;]+;[^}]*border-top:1px solid/);
  });
});
