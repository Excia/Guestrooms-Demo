# Save button states (match legacy)

Owner feedback 2026-10-25 (no ticket). Branch `fix/save-cta-saved-state`. Legacy facts were read from the legacy Vue
app (read only, nothing copied).
**Status:** in review, 2026-10-25.

## Legacy facts

Paths are under `GuestRoomsWebsite/src` in the legacy repo.

- Every admin page-level Save is a `ButtonHtml` (`components/FormElements/ButtonHtml.vue`, a Quasar `q-btn`, no caps,
  padding `8px 56px`) of type Save. Examples: `views/Dashboard/Admin/Setup/AddOnItems/AddOnItemsEditActions.vue`,
  `Rooms/RoomsEditActions.vue`, `RoomTypes/RoomTypesEditActions.vue`, `Notifications/NotificationsEditActions.vue`,
  `RateCategories/RateCategoriesEdit.vue`, `PrimarySetup/SystemSettingsEdit.vue`, `LocationsEdit.vue`,
  `RoomOptionsEdit.vue`, `BookingRulesEdit.vue`, `EmployeesEdit.vue`, `PermissionsEdit.vue`.
- **Nothing to save** (no `hasChanged` / `isChanged`, and not a new record): label `SAVED`, `white` button colour with
  primary-colour text, a `check` icon before the label, `disabled`.
- **Changes** (or a new, unsaved record): label `SAVE <PAGE NOUN>` (for example `SAVE SYSTEM SETTINGS`, `SAVE ROOM TYPE`),
  `primary` fill with white text, no icon, enabled.
- **View-only admin access** also disables the button (System Settings, Rate Categories), with no changes it still reads SAVED (the label only follows the changed flag).
- **During a save:** no label of its own. `isBlocking` turns the button off for 200 ms (`stores/main.ts`,
  `toggleDisableActionsWithDelay`). After the save a modal "<Noun> Saved" appears and the page reloads the record, which
  clears `hasChanged`, so the button reads SAVED.
- `SaveOrRemoveButton.vue` is only the small save / delete icon button used in table rows; not a page-level Save.

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                          | Why                                                                   | Source                                                                        | Status       |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| D-SC-1 | 2026-10-25 | One shared `SaveButton` (`src/components/shared/SaveButton.tsx`, rule in `src/app/saveButtonState.ts`) on every admin page with a page-level Save. States below                                                                                                                                                                   | Owner: "Saved" when unchanged, white like legacy; one look everywhere | owner                                                                         | provisional  |
| D-SC-2 | 2026-10-25 | The clean button uses `aria-disabled` (not `disabled`) so it stays focusable and keyboard focus survives the label change after a save. Presses are ignored                                                                                                                                                                       | Focus must not drop to the page when Save flips to Saved              | assumption                                                                    | provisional  |
| D-SC-3 | 2026-10-25 | A new, unsaved record always offers Save (legacy: `newX                                                                                                                                                                                                                                                                           |                                                                       | ` the changed flag). Text in a rate cell that is not money counts as a change | Legacy `newX |     | ` check; the cell text is not in the draft | legacy | provisional |
| D-SC-4 | 2026-10-25 | "Saving…" (legacy has none; it only blocks for 200 ms) shows while the request is in flight; a polite live region says "Saving" then "Saved", or "Save failed" when the changes are still there (not on first render; any other change clears it). The existing toast stays, so "Saved" is announced twice after a save: accepted | Accessibility                                                         | assumption                                                                    | provisional  |
| D-SC-5 | 2026-10-25 | Keycard Integration reads "Save Encoder Keys" (was "Save Changes") so the clean name can carry the noun                                                                                                                                                                                                                           | Consistent noun                                                       | assumption                                                                    | provisional  |

## States

| State   | When                               | Visible label | Accessible name                | Look                                                                                                        | Pressable            |
| ------- | ---------------------------------- | ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| Saved   | `dirty` is false                   | Saved + check | "Saved, <noun>"                | white (paper) fill, primary text (AA contrast), 50% alpha outline (about 2:1; exempt for inactive controls) | no (`aria-disabled`) |
| Save    | `dirty`, not saving, not blocked   | Save <noun>   | same                           | filled primary                                                                                              | yes                  |
| Saving  | request in flight                  | Saving…       | "Saving, <noun>" (`aria-busy`) | filled primary                                                                                              | no                   |
| Blocked | `dirty` but `disabled` (view-only) | Save <noun>   | same, described by the reason  | disabled grey                                                                                               | no                   |

Pages migrated: Locations, Room Options, Booking Rules, System Settings, Keycard Integration, and (through `SetupActions`)
Add-On Items, Room Types, Rooms, Rate Categories.

Left alone: Reservation edit panels, New Reservation, Folio and dialog confirm buttons (not the admin page-level Save
pattern); Notifications, Employees, Permissions, API Integrations (not built yet).
