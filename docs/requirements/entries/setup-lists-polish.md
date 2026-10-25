# Setup lists polish: legacy spacing, Inactive tags, lighter photo remove badge

Owner feedback 2026-10-25 (no ticket). Branch `fix/setup-lists-inactive-legacy-spacing`. Legacy values were read from the legacy
Vue app (read only, nothing copied). Figma: Room Types list 11964:24902 (unchanged).
**Status:** in review, 2026-10-25.

## Legacy facts

Room Types, Rooms and Add-On Items in legacy all use `SideBarControl.vue` (via `RoomTypesEditSideTabs.vue` and siblings), the same
component as the Primary Setup navigation.

| Part                      | Legacy                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| List padding, left margin | `padding-top: 10px`, `margin-left: 18px`                                                  |
| Item                      | `margin-top: 10px`; button `padding: 15px 0 15px 10px`, radius 4px, uppercase, weight 500 |
| Gap tab to bar            | button `margin-right: 15px`                                                               |
| Hover                     | light green background (`$gr-light-green-v3`)                                             |
| Active                    | green fill, white text, 5px bar at the edge (`right: 0`, radius `4px 0 0 4px`)            |
| NEW entry                 | 1px green border, radius 6px, `margin-right: 15px`, sticky at the top                     |
| Inactive item             | `opacity: 0.3` only (class `ce-sidebar-inactive`); no tag, not moved                      |
| How inactive is derived   | the API flag `isActive` of the record (room types: `!x.isActive`)                         |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Why                                         | Source | Status      |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------ | ----------- |
| D-SL-1 | 2026-10-25 | One `SetupList` component (Room Types, Rooms, Add-Ons, Rate Categories) takes the Primary Setup nav geometry: items 59px tall (`spacing(7.375)`), 10px apart (`gap 1.25`), tab 15px short of the bar from 1200px up, 5px bar absolutely at the panel edge, the NEW button the same height and width as a tab                                                                                                                                                                                                                                                                                                                                       | List looked tight; match legacy and the nav | owner  | provisional |
| D-SL-2 | 2026-10-25 | Inactive means outside its active dates (`!isActiveOn`: start after today, or end date before today), the rule the app already used; the mock has no separate flag. `sortSetupItems` orders the items once (active first, inactive last, each group by name) and `toSetupListEntries` (pure, `src/app/roomSetup.ts`) maps that SAME order to rows, so the default selection and the first row agree. Rate Categories builds its own rows with `isActiveOn` and does not use the helper. "Today" is the club date (`useClubToday`). An item that has not started yet (future start) is also tagged Inactive                                         | One shared derivation for the lists         | owner  | provisional |
| D-SL-3 | 2026-10-25 | **Superseded by D-MM-1 and D-MM-2 (italic removed, chip white on the selected row).** An inactive item shows a small red outlined "Inactive" chip (theme error, bold, opaque so it reads on the selected green item), its name is greyed (`text.secondary`, 5.7:1 on white; `text.disabled` is 2.5:1 and fails AA) and italic, and it stays selectable and editable. Active unselected items use `text.primary` so the grey reads as different. A visually hidden ", " sits between the name and the tag so screen readers read "Cottage, Inactive". The selected row is scrolled into view (`block: nearest`) after a save re-sorts the list. Supersedes the old "(Inactive)" suffix; legacy only dimmed to 30% opacity, which fails AA | Not colour alone; AA                        | owner  | provisional |
| D-SL-4 | 2026-10-25 | The photo remove control (room photos, Folio logo) is `PhotoRemoveBadge`: a 20px round error-red badge with a white X (14px) and a 2px white halo, inside a 24px button (the minimum target), in the photo's corner (2px inset; the rounded logo sits 6px outside its corner). Red hover is `error.dark`; focus ring is the 2px primary outline. Names unchanged ("Remove photo <name>", "Remove logo")                                                                                                                                                                                                                                            | The red full-size X looked clunky           | owner  | provisional |

## Placeholders and invented values

- **P-SL-1:** mock retired room `300 (retired)` (room type King Room, 2024-01-01 to 2024-12-31, like its type) in `src/api/roomSetupData.ts`, so Rooms has an inactive row. A retired room still blocks deleting its room type: King Room now reports "2 rooms use it" (tested). Room Types and Add-Ons already had one.

## Not verified

Layout, spacing and the badge were not checked in a real browser (jsdom: computed style only).
