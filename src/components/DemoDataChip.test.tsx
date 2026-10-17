import { render, screen } from '@testing-library/react';
import DemoDataChip from './DemoDataChip';

describe('DemoDataChip', () => {
  it('shows visible "Demo data" text', () => {
    render(<DemoDataChip />);
    expect(screen.getByText('Demo data')).toBeVisible();
  });
});
