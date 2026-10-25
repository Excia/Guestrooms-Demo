import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import AmountField from './AmountField';

describe('AmountField', () => {
  it('shows the amount without a $ adornment (the Rates heading says dollars)', () => {
    render(
      <ThemeProvider theme={theme}>
        <AmountField
          label="Default, King Room, Standard Base"
          cents={1250000}
          onChange={() => {}}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Default, King Room, Standard Base' })).toHaveValue(
      '12,500.00',
    );
    expect(screen.queryByText('$')).not.toBeInTheDocument();
  });
});
