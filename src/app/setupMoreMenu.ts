// Labels and rules of the three-dot menu of a setup list row (Rate Categories, Room Types, Rooms and
// Add-On Items).

export interface SetupMoreMenuLabels {
  /** Accessible name of the three-dot button, e.g. "Room 2 more options". */
  button: string;
  /** Accessible name of the menu, e.g. "Room More Options". */
  menu: string;
  changeLog: string;
  copy: string;
  delete: string;
}

/** `noun` is the title-case item name: "Room", "Room Type", "Add-On", "Rate Category". */
export function setupMoreMenuLabels(noun: string, itemLabel: string): SetupMoreMenuLabels {
  return {
    button: `${itemLabel} more options`,
    menu: `${noun} More Options`,
    changeLog: 'Change Log',
    copy: `Copy ${noun}`,
    delete: `Delete ${noun}`,
  };
}

/** Only the selected, saved, active row has the menu: inactive rows and the unsaved new row do not. */
export function showsMoreMenu(row: { selected: boolean; inactive?: boolean; isNew?: boolean }) {
  return row.selected && !row.inactive && !row.isNew;
}
