import { describe, expect, it } from 'vitest';
import { setupMoreMenuLabels, showsMoreMenu } from './setupMoreMenu';

describe('setupMoreMenuLabels', () => {
  it('names the button after the item and the menu and actions after the noun', () => {
    expect(setupMoreMenuLabels('Room', 'Room 2')).toEqual({
      button: 'Room 2 more options',
      menu: 'Room More Options',
      changeLog: 'Change Log',
      copy: 'Copy Room',
      delete: 'Delete Room',
    });
    expect(setupMoreMenuLabels('Add-On', 'Crib').copy).toBe('Copy Add-On');
  });
});

describe('showsMoreMenu', () => {
  it('shows on the selected active saved row only', () => {
    expect(showsMoreMenu({ selected: true })).toBe(true);
    expect(showsMoreMenu({ selected: false })).toBe(false);
    expect(showsMoreMenu({ selected: true, inactive: true })).toBe(false);
    expect(showsMoreMenu({ selected: true, isNew: true })).toBe(false);
  });
});
