# LP-A.6 follow-up: override PIN unlocks Location, Room Type and Room

Ticket Excia/Guestrooms-Demo#187 (follow-up); PR from branch `feat/override-pin-unlock-fields`. Figma: no frame; built from legacy
`ReservationHubEditPanel.vue` (lock icons, `overridePermission`) and `PermissionOverrideDialog.vue`.
**Status:** in review, 2026-10-26.

## Figma deviations

| ID      | Area | Figma | Built | Why | Choice (owner, ticket, agent, forced) |
| ------- | ---- | ----- | ----- | --- | ------------------------------------- |
| F-187-2 | Lock icons | No frame | Lock icon buttons beside the Location and Room type filters and a "Room" row of Change Room During Stay | The Reservation Hub edit panel (ticket 3.12) is not built, so the lock UI lives in the only place a reservation room's location, type and room are chosen today | agent |

## Open questions

| ID      | Question | Blocks | Default used | Who answers | Status |
| ------- | -------- | ------ | ------------ | ----------- | ------ |
| Q-187-4 | Two fields unlocked with two different PINs: legacy keeps only the last code. Should the request carry one code per function? | Request shape | One `overrideCode`, the last PIN entered | Owner / backend | open |
| Q-187-5 | What is `requestedPermissionValue` (legacy sends an access-set option with the code)? | Request shape | Not sent; the function name identifies what the PIN must hold | Backend | open |
| Q-187-6 | Location is hidden when the club has one location (legacy: single-location clubs?). Does the lock then still apply to Location? | Location lock | Hidden with the Location filter: nothing to unlock | Owner | open |
| Q-187-7 | Where else must the locks appear once the Reservation Hub edit panel (3.12) exists, and for unassigned rooms? | Ticket 3.12 | Only Change Room During Stay | Owner | open |

## Decisions

| ID      | Date | Decision | Why | Source | Status |
| ------- | ---- | -------- | --- | ------ | ------ |
| D-187-4 | 2026-10-26 | Match legacy: the existing past-date check-in PIN stays (Check In = On Check-In Date Only) and the PIN also unlocks Location, Room Type and Room | Owner decision relayed by the CEO | owner | decided |
| D-187-5 | 2026-10-26 | A field is locked while the user lacks its function and no PIN opened it; a user who holds the function sees no lock; a locked Location or Room Type keeps the room menus to the current room's location and type | Legacy `isLocationLocked` and friends | legacy | decided |
| D-187-6 | 2026-10-26 | The server works out the changed fields from the plan and requires the code only for functions the caller lacks | The UI is not authorization | agent | decided |

## Not built

- **Change Rate Category** and **Adjust Room Rate** (functions on the Permissions page): in legacy they only lock or disable fields; they have no PIN. Those screens are not built yet and are not part of this PR.
- The Reservation Hub edit panel itself (ticket 3.12) and the lock UI for an unassigned room.

## API, permissions, notes

- **API:** `OverridePermission` gains the three functions; `ChangeRoomRequest.overrideCode?`; errors `override-required` / `override-invalid` (403), `override-locked` (429). See api-contract.md, "Override PINs for the Change Reservation functions".
- **Permissions:** `function.changeReservationRoom`, `function.changeReservationLocation`, `function.changeReservationRoomType` (already granted by the permission sets); see permissions.md.
- **Notes:** UI in `src/components/reservation/ChangeRoomDialog.tsx`; rules in `src/app/overrideUnlock.ts`; mock enforcement in `src/api/mock.ts` and `src/api/scheduleData.ts`.
