import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../../theme';
import RoomOrderPanel from './RoomOrderPanel';

const item = (id: string) => ({ id, label: `Room ${id}` });
const ui = (ids: string[], onSave = vi.fn()) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      <RoomOrderPanel
        items={ids.map(item)}
        saving={false}
        error={null}
        onSave={onSave}
        onClose={vi.fn()}
      />
    </ThemeProvider>
  </MemoryRouter>
);

describe('RoomOrderPanel', () => {
  it('drops a room that disappears while open and never sends it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(ui(['a', 'b', 'c', 'd'], onSave));
    await user.click(screen.getByRole('button', { name: 'Move Room d up' }));
    rerender(ui(['a', 'c', 'd'], onSave));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Room a',
      'Room d',
      'Room c',
    ]);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    expect(onSave).toHaveBeenCalledWith(['a', 'd', 'c']);
  });

  it('appends a room that appears while open', () => {
    const { rerender } = render(ui(['a', 'b']));
    rerender(ui(['a', 'b', 'z']));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Room a',
      'Room b',
      'Room z',
    ]);
  });

  it('unmounts right after a move without error', async () => {
    const user = userEvent.setup();
    const { unmount } = render(ui(['a', 'b']));
    await user.click(screen.getByRole('button', { name: 'Move Room a down' }));
    expect(() => unmount()).not.toThrow();
  });
});
