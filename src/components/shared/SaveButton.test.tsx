import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SaveButton from './SaveButton';

describe('SaveButton', () => {
  it('shows a pressable "Save <noun>" with unsaved changes', async () => {
    const onClick = vi.fn();
    render(<SaveButton dirty noun="Locations" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save Locations' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows "Saved" with the noun in its name and ignores presses when nothing changed', async () => {
    const onClick = vi.fn();
    render(<SaveButton dirty={false} noun="Locations" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Saved, Locations' });
    expect(button).toHaveTextContent('Saved');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus when the label flips to Saved', () => {
    const { rerender } = render(<SaveButton dirty noun="Rooms" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Save Rooms' });
    button.focus();
    rerender(<SaveButton dirty={false} noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Saved, Rooms' })).toHaveFocus();
  });

  it('shows Saving while saving and announces Saving then Saved', () => {
    const { rerender } = render(<SaveButton dirty noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<SaveButton dirty saving noun="Rooms" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Saving, Rooms' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    rerender(<SaveButton dirty={false} noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('does not announce on first render', () => {
    render(<SaveButton dirty={false} noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('blocks pressing with changes when disabled, and says why', async () => {
    const onClick = vi.fn();
    render(
      <SaveButton
        dirty
        disabled
        disabledReason="View-only access"
        noun="Rooms"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Save Rooms' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('View-only access');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('works without a noun', () => {
    render(<SaveButton dirty onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('announces Save failed, not a stale Saving, when the changes are still there', () => {
    const { rerender } = render(<SaveButton dirty noun="Rooms" onClick={() => {}} />);
    rerender(<SaveButton dirty saving noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    rerender(<SaveButton dirty noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Save failed');
    rerender(<SaveButton dirty={false} noun="Rooms" onClick={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
