# Housekeeping block on every stay and complete status colors

No ticket; advances candidates C2 and C4 and gap item 5 of `functional-requirements-gaps-schedule.md` (Legacy Port epic #146). Figma: "Housekeeping Block" 12125:14157 and "Schedule Blocks" 15963:188278 (states NYCI 12125:14386, CheckedIn 12125:14391, CheckedOut 12125:14400, Linked Room 12228:27673, DueOut 15214:8379).
**Status:** in review, 2026-10-24.

## Audit: why only some stays showed an H block

`ScheduleItemView` drew the chip only when `block.housekeeping` was set, and the mock set it only for `checked-in` and `checked-out` blocks. Confirmed and NYCI stays never had one, and a real API that omits the field would show none. Legacy draws one per stay (a backend housekeeping event per reservation room stay, placed on the check-out day; none for unassigned reservations, and linked-room rows are not stays so they get none).

## Figma deviations

| ID     | Area                   | Figma                                                              | Built                                                                                               | Why                        | Choice |
| ------ | ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| F-HK-1 | Linked-room block fill | Linked Room state fill is rgb(189,189,189) at 80%                  | New token `palette.schedule.linked` with that value; the code used `grey[300]` (#e0e0e0), too light | Match Figma                | agent  |
| F-HK-2 | Due-out fill           | Orange rgb(228,113,0) at 40% (was marked PLACEHOLDER in the theme) | Same value, the placeholder note is removed: the Figma value is now confirmed                       | Read from Figma 15214:8379 | agent  |

## Open questions

| ID     | Question                                                                                                                            | Blocks | Default used                                                                                                                               | Who answers | Status |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ |
| Q-HK-1 | What does the Figma "NYCI" housekeeping variant (fully transparent) mean for a stay not yet checked in? Legacy has no such state    | None   | Drawn as nothing (no chip, no pop-up) when the backend sends `nyci`; a stay with no stored status shows the legacy default Not Checked Out | Owner       | open   |
| Q-HK-2 | Should a confirmed or NYCI stay's H block be clickable (set the status before arrival)? Legacy allows it for any stay with an event | None   | Yes, the same as any other stay                                                                                                            | Owner       | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Why                                                                                                                           | Source | Status   |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| D-HK-1 | 2026-10-24 | Every assigned stay (a block with a room that is not a linked-room block) gets an H block at its departure edge, whatever its check-in status. Unassigned reservations and linked-room blocks get none. A stay with no stored status shows Not Checked Out (`housekeepingStatusOf`)                                                                                                                                                                                                                                                                                                             | Owner request 2026-10-24; legacy one event per stay                                                                           | owner  | in force |
| D-HK-2 | 2026-10-24 | The status colors are final: not yet checked in rgba(250,250,250,.8) with a green border at 80%; checked in rgba(175,210,177,.8); due out (checked in, leaving today) rgba(228,113,0,.4); checked out rgba(224,224,224,.8); linked room and closure rgba(189,189,189,.8). H chip: not checked out rgba(66,66,66,.3), needs cleaning rgba(228,113,0,.8), cleaned rgba(253,216,53,.8), ready rgba(56,142,60,.8), needs maintenance rgba(239,83,80,.8), NYCI transparent. All are `palette.schedule` tokens, mapped by `blockFillToken` and `housekeepingFillToken` in `src/app/scheduleColors.ts` | Figma is the source of truth; legacy hexes (gray #a1afbf, orange, yellow, green #05b732, red #f54f4f) differ and are not used | owner  | in force |

## Placeholders and invented values

- **P-HK-1:** the mock housekeeping states (`createScheduleState`): checked-in stays Not Checked Out (one with a note), checked-out stays cycle through Needs Cleaning, Cleaned, Ready, Needs Maintenance, the first four confirmed stays also carry those four states (departed stays end before the default view, which starts today) and the first NYCI stay carries `nyci`. Covered by `src/api/scheduleHousekeepingSeeds.test.ts`.

## API, permissions, notes

- **API:** none changed. `ScheduleBlock.housekeeping` may now be absent for any stay; the UI treats that as Not Checked Out.
- **Permissions:** none changed (`reservation.edit` still gates the pop-up).
- **Code:** `src/app/housekeepingBlocks.ts` (which stays get a block, default status), `src/app/scheduleColors.ts` (status to token), `ScheduleItemView`, `HousekeepingChip`, `src/theme.ts`.
- **Not verified:** legacy sizes/positions against a running legacy app; Figma `get_design_context` failed for the block variants, fills were read through the Plugin API (read only).
