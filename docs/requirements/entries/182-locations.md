# 7.11 Locations (Legacy Port LP-A.1)

Tickets Excia/Guestrooms-Demo#182 and #123 (one PR closes both); PR Excia/Guestrooms-Demo#192. Figma: no frame (checked file
`WksR3zAy2S8cDsjrVvRklE`; the Admin Setup frames show the "Locations" item in the left navigation only).
**Status:** in review (branch `feat/182-locations`), 2026-10-25.

Source of behavior: the legacy `LocationsEdit` screen (Name with a 50-character counter, Area lookup, Remove, Add Location,
Save, unsaved-changes prompt, view-only mode) and functional doc 3.3. The layout is this build's Admin Setup shell.

## Figma deviations

| ID      | Area       | Figma                                                                                       | Built                                                                                                    | Why                                                                  | Choice (owner, ticket, agent, forced) |
| ------- | ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| F-182-1 | Whole page | No Locations frame                                                                          | Rows of Location Name, Location Area (type-ahead) and Remove, an Add Location button, Save in the header | Port the legacy behavior in the shell of Booking Rules; owner rule   | owner                                 |
| F-182-2 | Add / Save | Legacy adds a row with its own Save and Cancel buttons and writes each action to the server | Rows are edited in one draft and the header Save stores the whole list                                   | Matches the other setup pages (one Save, one unsaved-changes prompt) | ticket                                |

## Open questions

| ID      | Question                                                                                                                                                      | Blocks               | Default used                                                                                                                                       | Who answers     | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Q-182-1 | Is read-only mode a system flag or a permission? (ticket open question, also Q-123)                                                                           | Read-only mode       | A permission, `locations.edit`; without it the page is read-only. The mock administrator ("all") holds it                                          | Owner           | open   |
| Q-182-2 | Should a location in use by room types or rooms be removable with a confirmation, or blocked (legacy)?                                                        | Remove               | Blocked, like legacy: a dialog names the room types and links to Room Types. The ticket text says "confirm"                                        | Owner           | open   |
| Q-182-3 | Should the "Location \| Room type" captions (schedule row headers, room pickers, group labels) also hide for one location?                                    | Single-location rule | No: only selectors, filters, fields and columns follow the rule. The captions still show the location name                                         | Owner           | open   |
| Q-182-4 | The Room Types and Rooms pages have no location field today (a room type is tied to locations elsewhere). Where is a location chosen for a room type or room? | Room Types, Rooms    | Nothing built; the rule is applied to the Add-On Items Locations association tab (hidden for one location, the add-on is saved with that location) | Owner           | open   |
| Q-182-5 | May two locations share a name?                                                                                                                               | Validation           | No: a duplicate name (ignoring case and spaces) is refused. Legacy does not check; the selectors would show two identical entries                  | Owner           | open   |
| Q-182-6 | Can a club end up with no location (remove every row)?                                                                                                        | Remove               | No: the only row cannot be removed, and an empty list is refused (422)                                                                             | Owner           | open   |
| Q-182-7 | Which areas can a location be tied to (all areas, or only revenue areas), and does the type-ahead search on the server?                                       | Area lookup          | All areas, loaded once (`locations.listAreas`) and filtered in the browser                                                                         | Owner / backend | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                      | Why                                                                                   | Source | Status |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ | ------ |
| D-182-1 | 2026-10-25 | The single-location rule is one pure function, `showLocations(locations \| count)` in `src/app/locations.ts`: true for two or more. Every selector, filter and column asks it | One rule in one place (ticket); the Schedule filter's `showLocationFilter` moved here | ticket | open   |
| D-182-2 | 2026-10-25 | Save replaces the whole list (`PUT /locations`) and rows carry client-made ids, so a repeated save changes nothing                                                            | Idempotent save without a request id; new rows get a UUID when added                  | agent  | open   |
| D-182-3 | 2026-10-25 | The success toast stays 10 seconds (legacy and doc 3.2)                                                                                                                       | Doc 3.2; it keeps the shared bottom-left toast of this build instead of the top right | ticket | open   |
| D-182-4 | 2026-10-25 | Names are trimmed on save; name and area are required                                                                                                                         | Legacy asks for "a name" and "an area selected"                                       | legacy | open   |

## Placeholders and invented values

- **P-182-1:** the three locations (ids and names reuse `PLACEHOLDER_LOCATIONS`), their areas, the five area names and each
  location's usage by room types and rooms (`src/api/locationsData.ts`). North Lodge is unused, so removing it can be tried.
  Changes saved on the Locations page do not reach the schedule or the other mock data yet (they keep their own lists).

## API, permissions, notes

- **API:** `locations.list`, `locations.listAreas`, `locations.save`; section "Locations" in `api-contract.md`.
- **Permissions:** new route `locations` (`page.locations`, an Admin Setup page, not in the menu) and new action permission
  `locations.edit`; see `permissions.md`. Change Log page id `locations` added.
- **Notes:** the migrated selectors are the Schedule filter group, the Reservation List Location select and column, the New
  Reservation search, the Schedule New Reservation and Add Room panels, the online booking widget and Adjust Search, and the
  Add-On Items association tab. Room Types and Rooms have no location field in this build (Q-182-4).
