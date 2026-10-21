import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import QuantityPicker from './QuantityPicker';

function Harness({ initial = 1, min, max = 3 }: { initial?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return <QuantityPicker label="Bedrooms" value={value} min={min} max={max} onChange={setValue} />;
}

describe('QuantityPicker', () => {
  it('steps up and down within its range, with a minimum of 0 by default', async () => {
    const user = userEvent.setup();
    render(<Harness initial={0} />);
    const group = screen.getByRole('group', { name: 'Bedrooms' });
    expect(group).toHaveTextContent('0 bedrooms');
    await user.click(screen.getByRole('button', { name: 'Decrease bedrooms' }));
    expect(group).toHaveTextContent('0 bedrooms');
    await user.click(screen.getByRole('button', { name: 'Increase bedrooms' }));
    expect(group).toHaveTextContent('1 bedrooms');
  });
  it('honours a custom minimum and the maximum, keeping focus on the pressed button', async () => {
    const user = userEvent.setup();
    render(<Harness initial={2} min={2} max={3} />);
    const plus = screen.getByRole('button', { name: 'Increase bedrooms' });
    await user.click(plus);
    await user.click(plus);
    expect(screen.getByRole('group', { name: 'Bedrooms' })).toHaveTextContent('3 bedrooms');
    expect(plus).toHaveAttribute('aria-disabled', 'true');
    expect(plus).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Decrease bedrooms' })).not.toHaveAttribute(
      'aria-disabled',
    );
    await user.click(screen.getByRole('button', { name: 'Decrease bedrooms' }));
    await user.click(screen.getByRole('button', { name: 'Decrease bedrooms' }));
    expect(screen.getByRole('button', { name: 'Decrease bedrooms' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
  it('disables both buttons when disabled', () => {
    render(<QuantityPicker label="Bedrooms" value={1} max={3} onChange={() => {}} disabled />);
    expect(screen.getByRole('button', { name: 'Increase bedrooms' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease bedrooms' })).toBeDisabled();
  });
});
