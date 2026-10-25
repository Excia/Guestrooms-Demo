import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DuplicateDialog from './DuplicateDialog';

const validate = (name: string) =>
  name.trim() === ''
    ? 'Enter a name.'
    : name === 'Taken'
      ? 'This name is already in use.'
      : undefined;

function setup(props: Partial<React.ComponentProps<typeof DuplicateDialog>> = {}) {
  const onDuplicate = vi.fn();
  const onCancel = vi.fn();
  render(
    <DuplicateDialog
      open
      noun="rate category"
      initialName="Member Rate (Copy)"
      validate={validate}
      maxLength={25}
      onCancel={onCancel}
      onDuplicate={onDuplicate}
      {...props}
    />,
  );
  return { onDuplicate, onCancel };
}

describe('DuplicateDialog', () => {
  it('is named for the noun and focuses the suggested name', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Duplicate Rate Category' })).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: /Rate Category Name/ });
    expect(field).toHaveValue('Member Rate (Copy)');
    expect(field).toHaveFocus();
  });

  it('returns the trimmed name on Enter', async () => {
    const user = userEvent.setup();
    const { onDuplicate } = setup();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), ' Trade Rate {Enter}');
    expect(onDuplicate).toHaveBeenCalledWith('Trade Rate');
  });

  it('shows why a name is refused and disables Duplicate', async () => {
    const user = userEvent.setup();
    const { onDuplicate } = setup();
    await user.clear(screen.getByRole('textbox'));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'Taken');
    expect(screen.getByText('This name is already in use.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('shows a request error and cancels with Cancel', async () => {
    const user = userEvent.setup();
    const { onCancel } = setup({ error: 'Could not duplicate.' });
    expect(screen.getByText('Could not duplicate.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
