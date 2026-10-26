import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import { render, screen } from '@testing-library/react';
import { useReadOnly } from '../../app/readOnlyContext';
import EditOnly from './EditOnly';
import ReadOnlyProvider, { EditableIsland } from './ReadOnlyProvider';

function Flag() {
  return <p>{useReadOnly() ? 'read-only' : 'editable'}</p>;
}

describe('ReadOnlyProvider', () => {
  it('disables MUI fields by default and sets the flag', () => {
    render(
      <ReadOnlyProvider readOnly>
        <Flag />
        <TextField label="Name" />
        <Checkbox slotProps={{ input: { 'aria-label': 'Flag' } }} />
        <EditOnly>
          <button>Add</button>
        </EditOnly>
      </ReadOnlyProvider>,
    );
    expect(screen.getByText('read-only')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Flag' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('renders editable children untouched when not read-only', () => {
    render(
      <ReadOnlyProvider readOnly={false}>
        <Flag />
        <TextField label="Name" />
        <EditOnly>
          <button>Add</button>
        </EditOnly>
      </ReadOnlyProvider>,
    );
    expect(screen.getByText('editable')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('restores editing inside an EditableIsland', () => {
    render(
      <ReadOnlyProvider readOnly>
        <EditableIsland>
          <Flag />
          <TextField label="Filter" />
        </EditableIsland>
      </ReadOnlyProvider>,
    );
    expect(screen.getByText('editable')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Filter' })).toBeEnabled();
  });
});
