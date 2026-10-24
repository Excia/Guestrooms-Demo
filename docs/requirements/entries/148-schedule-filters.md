# LP-S.2 Housekeeping and Room Features filters, filter rules

Ticket Excia/Guestrooms-Demo#148 (epic #146); PR not opened yet. Figma: Filter Menu 13908:94238 shows Locations and Room Types only; the two new groups follow the legacy menu (owner: match legacy).
**Status:** in review, 2026-10-24.

## Figma deviations

| ID      | Area                           | Figma                                       | Built                                                                                                           | Why                                | Choice (owner, ticket, agent, forced) |
| ------- | ------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------- |
| F-148-1 | Filter panel groups            | Locations and Room Types only               | Adds "Housekeeping Status" (five values) and "Room Features", each with Select all / Select none                | Legacy menu; functional doc 15.8.3 | owner                                 |
| F-148-2 | Applied-filter funnel (15.8.4) | Funnel drawn green, no applied variant seen | Funnel turns primary (green) when any filter is applied, with the number of applied groups drawn on it (no dot) | Legacy; not color alone (WCAG)     | owner (legacy), agent (count)         |

## Open questions

| ID      | Question                                                                                                                            | Blocks | Default used                                                                                                                           | Who answers | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-148-1 | Ticket question: green funnel or the dot badge? Built as the green (primary) funnel plus a count, per the owner's "match legacy".   | None   | Funnel + count                                                                                                                         | Owner       | open   |
| Q-148-2 | Legacy "Select all" in Housekeeping hides rooms with no housekeeping status at all (any status counts). Keep?                       | Rules  | Yes: all five checked keeps only rooms with a reservation carrying one of the five; unchecked everything is no filter (legacy default) | Owner       | open   |
| Q-148-3 | Does the Housekeeping filter hide individual blocks inside a kept room? Legacy hides rooms and unassigned reservations, not blocks. | Rules  | No: a kept room shows all its blocks                                                                                                   | Owner       | open   |
| Q-148-4 | Is a room's feature list its own or its room type's? Legacy uses the room type's while the room inherits details.                   | Data   | `ScheduleRoom.featureIds` is the effective list; the backend resolves the inheritance                                                  | Backend     | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                                                                                                            | Why                                         | Source        | Status   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------- | -------- |
| D-148-1 | 2026-10-24 | The panel has four groups, each with Select all / Select none: Locations (only with two or more locations; a stale `?locations=` is then ignored and not counted), Room Types, Housekeeping Status (Not Checked Out, Needs Cleaning, Cleaned, Maintenance Required, Inspected / Ready) and Room Features (left out when the club has no features)   | Legacy menu; closes C5 item 15.8.1.1 and C6 | owner         | in force |
| D-148-2 | 2026-10-24 | Housekeeping Status and Room Features start with nothing checked, which is no filter (legacy). Housekeeping: a room stays when one of its reservations overlapping the range has one of the checked statuses; unassigned reservations are hidden unless they have one. Features: a room must have ALL checked features. All groups combine with AND | Legacy `filterRooms` and unassigned list    | owner         | in force |
| D-148-3 | 2026-10-24 | Available Only: a room with at least one night in the range that has neither a reservation nor a closure. This replaces "free for the whole range" (closes gap item 3)                                                                                                                                                                              | Functional doc 15.7.2; legacy               | owner         | in force |
| D-148-4 | 2026-10-24 | The filters are in the URL: `housekeeping=<status,...>` and `features=<id,...>`, omitted when empty. Unknown statuses are dropped. The funnel shows the number of applied groups (location list, room types, availability, housekeeping, features)                                                                                                  | Existing URL pattern; closes gap item 6     | ticket, agent | in force |

## Placeholders and invented values

- **P-148-1:** mock room features (`SCHEDULE_FEATURES`, `FEATURES_BY_ROOM_TYPE` in `src/api/scheduleData.ts`): the Room Options placeholder features, assigned to the schedule's rooms by room type.

## API, permissions, notes

- **API:** `GET /schedule` (`ScheduleData`) gains optional `features: {id, name}[]` (the Room Options features) and optional `featureIds: string[]` on each room. Absent means none. Filtering stays client-side.
- **Permissions:** none new.
- **Notes:** the legacy housekeeping "event status" is the schedule block's `housekeeping` value here (`nyci` matches none of the five).
