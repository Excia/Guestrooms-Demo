import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import Select from './Select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('Select', () => {
  it('has an accessible name from its label and shows the placeholder', () => {
    render(
      <Select
        label="Room type"
        placeholder="[Input Selection]"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );
    const combo = screen.getByRole('combobox', { name: /Room type/ });
    expect(combo).toHaveTextContent('[Input Selection]');
  });

  it('selects with the keyboard', async () => {
    const onChange = vi.fn();
    render(<Select label="Room type" value="a" options={OPTIONS} onChange={onChange} />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await screen.findByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('links helper text and error state', () => {
    render(
      <Select
        label="Room type"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
        error
        helperText="Choose one."
      />,
    );
    const combo = screen.getByRole('combobox');
    expect(combo).toHaveAccessibleDescription('Choose one.');
    expect(combo).toHaveAttribute('aria-invalid', 'true');
  });

  it('can be disabled', () => {
    render(<Select label="Room type" value="a" options={OPTIONS} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the selected option in green and bold, in the original order', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Select label="Room type" value="b" options={OPTIONS} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Alpha', 'Beta']);
    const selected = screen.getByRole('option', { name: 'Beta' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    const style = getComputedStyle(selected);
    expect(style.color).toBe('rgb(32, 87, 35)');
    expect(style.fontWeight).toBe('700');
    expect(getComputedStyle(screen.getByRole('option', { name: 'Alpha' })).color).not.toBe(
      style.color,
    );
  });
});
