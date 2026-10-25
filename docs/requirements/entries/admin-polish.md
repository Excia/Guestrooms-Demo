# Admin polish: trash icon standard, side-nav spacing, Change Log dialog

Owner feedback 2026-10-25 (no ticket). Branch `fix/admin-polish-trash-nav-changelog`. Legacy values were read from the legacy
Vue app (read only, nothing copied).
**Status:** in review, 2026-10-25.

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                       | Why                                                      | Source | Status      |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------ | ----------- |
| D-AP-1 | 2026-10-25 | Removing a row or item in admin setup uses ONE control, `RemoveIconButton` (`src/components/shared/`): the filled trash can (MUI `Delete`, the icon Keycard Integration used first) in the theme error colour (`tone="danger"`, the default). Accessible name "Remove <label>", tooltip, 24px minimum target, focus ring, disabled state with a reason (tooltip + description) | Many different remove controls; owner wants one standard | owner  | provisional |
| D-AP-2 | 2026-10-25 | The admin side-nav active bar follows the legacy `SideBarControl`: 5px wide, pinned to the panel edge, 15px from the active tab, rounded 4px on the left. Spacing units: 0.625 (5px), 1.875 (15px), 0.5 (4px)                                                                                                                                                                  | Bar was pressed against the tab and cut off at the card  | owner  | provisional |
| D-AP-3 | 2026-10-25 | The Change Log is a normal modal dialog (not full screen), 85vw by 80vh like the legacy reservation hub change log modal; below 600px it fills the width with 16px margins. The table scrolls under a sticky header, pagination sits in a footer, the "Search descriptions" field is in the header. Supersedes D-97-4                                                          | A full-screen overlay read like a new page               | owner  | provisional |
| D-AP-4 | 2026-10-25 | The Admin Setup shell does not scroll the page from 1200px (lg) up: it fills the viewport below the app bar (`100dvh` minus the app bar and its own margins), the left navigation column stays in view (it scrolls inside itself only if taller than the window), the page header row (title, Change Log, Save, divider) is fixed at the top of the content panel, and only the body below it scrolls (`region` "Page content", focusable, `scroll-padding` so focused fields clear the edge). Done once in `AdminShell`; pages keep passing `title`, `actions` and `changeLog`. Below 1200px the layout stacks as before and the page scrolls normally | Owner: only the inner content scrolls; menu and header must always be visible | owner | provisional |

## D-AP-1 audit

Migrated to `RemoveIconButton` (names unchanged, so existing tests still apply):

| Control                                                  | Before                           | After                |
| -------------------------------------------------------- | -------------------------------- | -------------------- |
| Locations row, "Remove <name>"                           | Outlined text button "Remove"    | Red trash can        |
| Room Options feature / bed row, "Remove <name>"          | Red text button "Remove"         | Red trash can        |
| Keycard Integration row, "Remove Encoder Key n"          | Trash can, default (grey) colour | Red trash can        |
| Rate Categories season, "Remove season <name>"           | Small red trash can              | Same, shared control |
| Booking Rules member type rule, "Remove rule for <name>" | Trash can, default colour        | Red trash can        |

Left as they are (deliberate other patterns):

- Add-On Items, Room Types and Rooms "Delete <record>" (`SetupActions`): deletes a whole record from the editor header; already a red trash can, with its own dialog and in-use check.
- Keycard Integration "Remove All": a text button for a page-level destructive action, with a confirmation.
- Photo "Remove photo" (`PhotosField`) and Folio logo "Remove logo": a cancel badge over an image, not a row.
- Location filter "Remove location filter" (`LocationFilter`): removes a filter group, a cancel icon.
- Dialog confirm buttons "Delete" / "Remove All" (`DeleteSetupDialog`, `RemoveAllDialog`): confirmations.
- Outside admin (not touched): folio line delete, closure delete, room removal in the booking widgets.

## D-AP-2 side-nav geometry

Legacy source: `src/components/SideBarControl.vue` (scoped styles) and `FormElements/ConfigurationPageGrid*.vue`.

| Part                             | Legacy                                      | Built (theme spacing, 8px unit)                         |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Active bar width                 | 5px, absolute, `right: 0`, full item height | `width: spacing(0.625)`, `position: absolute; right: 0` |
| Gap between tab and bar          | tab `margin-right: 15px`                    | tab `mr: spacing(1.875)` from 1200px up                 |
| Bar corners                      | `4px 0 0 4px`                               | `spacing(0.5)` on the left corners                      |
| Tab radius, padding              | 4px, `15px 0 15px 10px`                     | unchanged (Figma button; height 59px)                   |
| Nav right padding                | none (bar touches the panel edge)           | `pr: 0` from 1200px up                                  |
| Item margin-top, nav padding-top | 10px, 10px                                  | not changed (Figma governs the vertical rhythm)         |

`aria-current="page"` and the link markup are unchanged; the bar is `aria-hidden`.

## D-AP-3 dialog size

85vw wide and 80vh tall (legacy `ReservationHubChangeLogModal.vue`: `width: 85vw; height: 80vh`, search at the top right, close X in the toolbar). Focus is trapped by the MUI Dialog and returns to the Change Log button; Escape, the X and a backdrop click close it. The sort/filter popovers open above it. The legacy search toggle button is replaced by an always visible labelled field (debounced 300 ms, Enter applies at once).

## Not verified

Layout and spacing were not checked in a real browser (jsdom tests only).

## D-AP-4 scroll regions

- Header outside the scroll container, so it can never cover a focused field; `element.focus()` and
  `scrollIntoView` scroll the nearest scrollable ancestor, which is the inner body.
- The body has `tabIndex 0` so keyboard users can scroll it with arrow and page keys even when the content
  has no focusable control (loading, error). Its focus ring is inset.
- Below lg nothing is clipped: normal document scroll, navigation stacked above the panel.
- Not verified in a real browser (jsdom has no layout); covered by structure and style tests.
