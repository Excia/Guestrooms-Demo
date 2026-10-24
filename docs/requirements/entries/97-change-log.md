# 7.10 Change Log overlay (admin pages)

Ticket Excia/Guestrooms-Demo#97; PR not opened yet. Figma: Change Log 16718:6217 (header row 16734:6811). The Event Types
reference table next to it in the System Settings section was not read (an image of a spreadsheet).
**Status:** in review (branch `feat/97-change-log-overlay`), 2026-10-24.

## Figma deviations

| ID     | Area              | Figma                                                  | Built                                                                                                                                      | Why                                                                              | Choice |
| ------ | ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| F-97-1 | Date format       | Placeholder "Day, MM/DD/YYYY"                          | "Wed, 10/21/26" (two-digit year)                                                                                                           | The ticket's annotation says "Day, MM/DD/YY"; the Figma placeholder disagrees    | ticket |
| F-97-2 | Time format       | "HH:MM XM"                                             | "04:05 PM" (zero-padded hour)                                                                                                              | Follows the pattern literally                                                    | agent  |
| F-97-3 | Search button     | A green search button at the top right, no behavior    | Opens a small "Search descriptions" popover (free text over the Description column)                                                        | The annotation says sort and filter by four columns; the button needed a purpose | agent  |
| F-97-4 | Column filters    | A filter icon after Date, Time, Change Type, Action By | The icon opens a popover: sort direction, that column's filter (date range, time range, change type checkboxes, employee), Apply and Clear | The frame shows no filter UI                                                     | agent  |
| F-97-5 | Pagination        | None drawn                                             | The shared Pagination under the table (25 rows per page)                                                                                   | The ticket asks for pagination                                                   | ticket |
| F-97-6 | Change Log button | No frame for the button                                | A text button "Change Log" with a history icon, left of the Save button in the page header                                                 | The ticket does not place it                                                     | agent  |

## Open questions

| ID     | Question                                                                                                            | Blocks             | Default used                                                                                                                                                                                                        | Who answers | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-97-1 | Which admin pages show the Change Log (frames hint at unassigned charges, open folios, room blocks, primary setup)? | Page wiring        | The button is on every Admin Setup page that exists: System Settings, Booking Rules, Room Types, Rooms, Add-On Items. `AdminShell` takes `changeLog="<page>"`, so later pages add one prop                          | Owner       | open   |
| Q-97-2 | Who owns the event type list (the reference table is an image of a spreadsheet)?                                    | Change Type filter | Placeholder list in `src/api/changeLogData.ts` (Created, Updated, Deleted, Duplicated, Activated, Deactivated, Setting Changed), served by `GET /change-log/event-types`; the filter shows whatever the API returns | Owner       | open   |
| Q-97-3 | Who writes the entries, and from which actions (every Save and delete on the admin pages)?                          | Backend            | The backend records them when a page saves; the mock holds fixed sample entries and saving in the UI adds none                                                                                                      | Backend     | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                              | Why                                    | Source      | Status      |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- | ----------- |
| D-97-1 | 2026-10-24 | One year of retention is the backend's rule: `GET /change-log` never returns an entry older than one year before today. The mock enforces it (`retentionCutoff`, `isWithinRetention`) | Ticket: "enforced by the API contract" | ticket 7.10 | provisional |
| D-97-2 | 2026-10-24 | Entries carry the club's local `date` and `time` (`HH:mm`); the UI only formats them, so no time zone maths happens in the browser                                                    | The backend knows the club's zone      | agent       | provisional |
| D-97-3 | 2026-10-24 | Default order is newest first (date, then time, descending). Sorting by time compares the time of day and then the date                                                               | Ticket                                 | ticket 7.10 | provisional |
| D-97-4 | 2026-10-24 | The overlay is a full-screen MUI Dialog (focus trap, Escape, focus returns to the Change Log button); the X is a labelled button                                                      | Accessible by default                  | agent       | provisional |

## Placeholders and invented values

- **P-97-1:** the sample entries, employee names and event types in `src/api/changeLogData.ts` (`mockChangeLog`, `MOCK_EVENT_TYPES`). Entries are generated relative to the mock's "today" and the oldest ones fall outside the retention to prove it.

## API, permissions, notes

- **API:** `GET /change-log?page=&sort=&dateFrom=&dateTo=&timeFrom=&timeTo=&changeTypes=&actionBy=&search=&pageNumber=&limit=` answers `Page<ChangeLogEntry>` (`{items, total}`); `GET /change-log/event-types` answers `[{id, label}]`. See the section "Change Log (ticket 7.10)" in `api-contract.md`.
- **Permissions:** none new (admin routes only, ticket 0.8).
- **Notes:** the page ids are in `CHANGE_LOG_PAGES` (`src/api/changeLogTypes.ts`).
