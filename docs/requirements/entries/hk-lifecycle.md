# Housekeeping status follows the stay's check-in status

No ticket; owner feedback from the acceptance test, 2026-10-25. Builds on `hk-and-status-colors.md` (D-HK-1..3). Figma: "Housekeeping Block" 12125:14157 (NYCI variant 12125:14386, fully transparent; no frame shows a visible NYCI chip, so the visual stays as in Figma).
**Status:** in review, 2026-10-25.

## Figma deviations

| ID     | Area                  | Figma                                          | Built                                                                   | Why                                               | Choice |
| ------ | --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| F-HK-5 | Status pop-up options | No frame for the pop-up (already deviation 54) | The select lists only the states that fit the stay's lifecycle (D-HK-5) | Owner: the status must logically reflect the stay | owner  |

## Open questions

| ID     | Question                                                                                                                                                       | Blocks | Default used                                                                          | Who answers | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-HK-3 | Can staff clear the maintenance flag on a stay not yet checked in? The pop-up offers only "Needs Maintenance" there, so today it stays until check-out         | None   | No way to clear it; a new "none" status (or a settable NYCI) would need an API change | Owner       | open   |
| Q-HK-4 | Should staff be able to flag maintenance on a guest in house (a broken fixture reported mid-stay)? Legacy allows every status on every stay                    | None   | No: a guest in house is always Not Checked Out; maintenance is set after check-out    | Owner       | open   |
| Q-HK-5 | Does the real backend derive the status the same way (D-HK-4), or send a stored one the UI should trust? The UI ignores stored values that do not fit the stay | None   | The UI derives; the mock stores per D-HK-4                                            | Backend     | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                        | Source | Status   |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| D-HK-4 | 2026-10-25 | The status of an H block is derived from the stay's check-in status by `housekeepingStatusOf` (table below). It replaces "a missing status shows Not Checked Out" of D-HK-1. Every caller (chip, block label, tooltip, turnover gap, filter, block text, room readiness) uses it                                                                                                      | Owner: an H block must be set from the check-in status; "Not Checked Out" means the guest is still in the room, which is wrong before arrival                                                                                                              | owner  | in force |
| D-HK-5 | 2026-10-25 | The pop-up offers only transitions that fit the lifecycle (`housekeepingOptionsFor`): not yet checked in, none (invisible chip), except a maintenance flag already set, which can only be kept; in house, only Not Checked Out (notes still editable); checked out, the four cleaning states, never Not Checked Out. The mock `setHousekeeping` refuses others with 409 `not-allowed` | Owner: a stay not yet checked in cannot be "Cleaned". Legacy offers every status on every stay with an event (`ReservationScheduleViewHousekeepingEventBox.vue` shows the box for any stay; the status comes from the backend); we are stricter on purpose | owner  | in force |
| D-HK-6 | 2026-10-25 | Check-in stores Not Checked Out, check-out and automatic check-out store Needs Cleaning, undoing a check-in clears the stored state. Room readiness (`roomNotReady`) reads the derived status of the stay before                                                                                                                                                                      | The mock flows and the derivation must agree                                                                                                                                                                                                               | agent  | in force |
| D-HK-7 | 2026-10-25 | A stored `needs-maintenance` on a stay not yet checked in is kept (a room flag; legacy shows "Maintenance" on such blocks, `getRelevantDetailLabel`). Any other stored value on such a stay is ignored                                                                                                                                                                                | The one case where staff knowledge about the room precedes the stay                                                                                                                                                                                        | agent  | in force |

### Derivation (D-HK-4)

| Stay                                     | Stored: none     | nyci            | not-checked-out | needs-cleaning  | cleaned         | ready           | needs-maintenance |
| ---------------------------------------- | ---------------- | --------------- | --------------- | --------------- | --------------- | --------------- | ----------------- |
| No room / linked-room block              | no H block       |                 |                 |                 |                 |                 |                   |
| Not yet checked in (`confirmed`, `nyci`) | NYCI (invisible) | NYCI            | NYCI            | NYCI            | NYCI            | NYCI            | Needs Maintenance |
| Checked in                               | Not Checked Out  | Not Checked Out | Not Checked Out | Not Checked Out | Not Checked Out | Not Checked Out | Not Checked Out   |
| Checked out                              | Needs Cleaning   | Needs Cleaning  | Needs Cleaning  | Needs Cleaning  | Cleaned         | Ready           | Needs Maintenance |

Covered cell by cell in `src/app/housekeepingBlocks.test.ts`.

## Placeholders and invented values

- **P-HK-1 (changed):** the mock stores per D-HK-4. `createScheduleState`: checked-in stays Not Checked Out (one with a note); checked-out stays carry the cleaning state in `CHECKED_OUT_HOUSEKEEPING` (others cycle); not-yet-checked-in stays store none (they show NYCI), except rr-6, flagged Needs Maintenance. The old seeds that put Needs Cleaning/Cleaned/Ready/Needs Maintenance on confirmed stays and `nyci` on the first NYCI stay are gone.
- **P-HK-2:** three seeded early check-outs (booked departure still ahead): rr-33 (room C2, needs cleaning), rr-34 (room 109, cleaned), rr-35 (room C3, ready, left today and the next guest rr-25 arrives today). With rr-27 (needs maintenance) every chip color shows in the default view, except Ready, which shows in the view that starts a day earlier (a stay that leaves today is out of a view that starts today). `scheduleHousekeepingSeeds.test.ts` checks both.

## API, permissions, notes

- **API:** no endpoint shape changed. Mock `schedule.setHousekeeping` answers 409 `not-allowed` for a status that does not fit the stay; to add to `api-contract.md` when the backend rules are known (Q-HK-5).
- **Permissions:** none changed.
- **Q-HK-2 of `hk-and-status-colors.md`** (is a not-yet-checked-in stay's H block clickable?) is answered by D-HK-4/5: it is invisible and not clickable, unless flagged for maintenance.
- **Early Check In tab:** verified the left (Early Check In) and right (Late Check Out) tabs are one component (`marker` in `ScheduleItemView`) with `EDGE_TAB_SPACING` (0.5 = 4px); a test asserts both render 4px wide. Nothing to fix.
- **Code:** `src/app/housekeepingBlocks.ts` (`stayLifecycle`, `housekeepingStatusOf`, `housekeepingOptionsFor`), `src/api/checkInData.ts`, `src/api/reservationMenuData.ts`, `src/api/reservationDetailData.ts`, `src/api/scheduleData.ts`, `HousekeepingChip` (`options` prop).
- **Not verified:** in a real browser.
