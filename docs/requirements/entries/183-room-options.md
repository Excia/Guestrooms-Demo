# LP-A.2 / 7.12 Room Options: Features and Bed Sizes

Tickets Excia/Guestrooms-Demo#183 (Legacy Port) and #124 (main board); one PR closes both. No Figma frame: built from
the legacy page (`RoomOptionsEdit`, `FeaturesEdit`, `BedSizesEdit`, read only) on this build's Admin Setup shell and theme.
**Status:** in review (branch `feat/183-room-options`), 2026-10-25.

## What legacy does (described, not copied)

- One page "Room Options" with two tabs, Features and Bed Sizes, and one save button ("Save Room Options", shown as
  "Saved" while nothing is pending).
- Each list is a column of text inputs (50 characters, with a counter) with a Remove button per row, and an "Add Feature" /
  "Add Bed Size" button that opens one extra row with its own Remove (cancel) and Save.
- Remove asks a yes/no confirmation and deletes straight on the server. The client has **no in-use check**; the server's
  answer for an item still assigned is not visible from the front end code.
- The only client validation is "must have a name" (a dialog listing the errors). The 50 limit is a hard input limit.
  Duplicates are not checked on the client.
- Leaving with pending edits asks for confirmation; permission "view only" disables everything.
- The label of the add button is "Add Bed Size" (the functional doc's "Add Room Size" is not used).

## Figma deviations

| ID      | Area       | Figma           | Built                                                                                 | Why                                                                     | Choice |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| F-183-1 | Whole page | No frame exists | Admin Setup shell, two tabs, a field + Remove row per item, Add button below the list | Owner rule: port legacy behavior, keep this build's structure and theme | owner  |

## Open questions

| ID      | Question                                                                                                         | Blocks   | Default used                                                                                                                           | Who answers     | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Q-183-1 | What does the legacy server do when a removed Feature or Bed Size is assigned (refuse, or unassign it)?          | Removal  | Refuse, naming the Room Types and Rooms that use it (like the Room Types delete rule)                                                  | Owner           | open   |
| Q-183-2 | Should Remove still ask "Are you sure?" like legacy?                                                             | Removal  | No: Remove only edits the draft and nothing changes until Save; leaving unsaved changes is guarded                                     | Owner           | open   |
| Q-183-3 | Should a schedule room keep a removed feature's id, and should the Schedule's own room features count as in-use? | Schedule | The Schedule's per-room features are sample data tied to room type; unknown ids are dropped from `schedule.get`; not counted as in use | Owner / backend | open   |

## Decisions

| ID       | Date       | Decision                                                                                                                                                                                                                        | Why                                                                                | Source | Status |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ------ |
| D-183-1  | 2026-10-25 | One draft and one Save for both lists; Save replaces both lists in display order                                                                                                                                                | Legacy has one save button; replace-all keeps `PUT` idempotent                     | agent  | open   |
| D-183-2  | 2026-10-25 | Duplicates are refused case-insensitively after trimming, within one list (the same name in both lists is allowed)                                                                                                              | Ticket; the lists are independent                                                  | ticket | open   |
| D-183-3  | 2026-10-25 | In-use removal is blocked on the page (naming what uses it) and again by the API (409 `in-use`)                                                                                                                                 | See Q-183-1; consistent with Room Types delete (`checkDeleteRoomType`)             | agent  | open   |
| D-183-4  | 2026-10-25 | Ids are stable and issued by the server for new items; Room Types, Rooms and Schedule keep working with old ids                                                                                                                 | Existing seeds, tests and saved room details refer to `feature-*` / `bed-*` ids    | ticket | open   |
| D-183-5  | 2026-10-25 | Items are labelled "Feature 1", "Bed Size 2"... (position) so each field has a distinct accessible name                                                                                                                         | Screen readers need to tell the fields apart; legacy has no label on existing rows | agent  | open   |
| D-183-6  | 2026-10-25 | "Add" appends a blank row in the draft (focus moves to it); there is no separate row-level Save / cancel                                                                                                                        | One draft and Save covers it; Remove deletes a blank row                           | agent  | open   |
| D-183-7  | 2026-10-25 | Permissions: the existing admin page permission `page.room-options` (new route id); no view-only mode                                                                                                                           | The Permissions page design is pending (D-009); `can()` gates the route only       | agent  | open   |
| D-183-8  | 2026-10-25 | The lists carry a `version`; Save sends it and a stale one is refused (409 `stale`). The page keeps the draft and offers Reload, which re-bases the draft (my renames, removals and new items stay where the item still exists) | A tab with old lists must not silently delete items added elsewhere                | review | open   |
| D-183-9  | 2026-10-25 | After a refused in-use removal the page names the items, puts them back in the draft, keeps other edits and refreshes the usage it checks against (also after every save)                                                       | The user should not have to reload and lose the draft                              | review | open   |
| D-183-10 | 2026-10-25 | The API rejects the same `id` twice in one request (422); the mock rejects a Room Type or Room (not one that inherits) naming a Feature or Bed Size that is not in the lists (422)                                              | Keeps the one list authoritative                                                   | review | open   |

## Placeholders and invented values

- **P-183-1:** the seeded Features and Bed Sizes moved from `roomSetupData.ts` to `src/api/roomOptionsData.ts` (same
  ids and labels). The Change Log sample entries for the page (`changeLogData.ts`).

## API, permissions, notes

- **API:** `roomOptions.get` / `save`; section "Room options" in `api-contract.md`. `roomSetup.getOptions` and
  `schedule.get` now read the mock's single list, so the duplicated lists are gone (the Schedule's `SCHEDULE_FEATURES`
  seed is derived from the same data and its `features` and per-room `featureIds` are filtered to the current list).
- **Permissions:** new page id `room-options` (`page.room-options`); admins see it, the navigation item is enabled by it.
  It is not a menu entry (Figma's menu omits it), like Booking Rules.
- **Notes:** the page loads Room Types and Rooms once to explain a blocked removal before the user saves; if that load
  fails the server check still protects the data. A bed size removed from the list is dropped from the counts of Room
  Types and Rooms in the mock (a backend should do the same).
