# Match legacy: linked-room blocks, add-on quantity, Add Another Room

PR: `fix: match legacy linked-room blocks, add-on quantity and add-room rules` (branch `fix/match-legacy-linked-addons-addroom`).
No ticket. Touches tickets 2.4 (#21), 2.5 (#22) and 7.4 (#73). Figma is not the reference here: the owner chose to match the legacy
(Vue) system in three places.
**Status:** in review, 2026-10-24.

## Figma deviations

| ID     | Area                            | Figma                                              | Built                                                                                                 | Why                            | Choice |
| ------ | ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| F-LM-1 | Linked Room Block (12455:90329) | Three content tiers by drawn width; the Figma fill | Content by view and stay length (D-LM-1); grey at 75% opacity, `not-allowed` cursor, not clickable    | Owner: match the legacy system | owner  |
| F-LM-2 | Menu: Add Another Room (F-22-3) | Shown only "before NA"                             | Hidden when cancelled, all rooms checked out, or the night audit has run for the reservation (D-LM-5) | Owner: match the legacy system | owner  |

## Open questions

| ID     | Question                                                                                                                | Blocks       | Default used                                                                                                   | Who answers | Status |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-LM-1 | Is the "+N" after a linked room the number of linked rooms (legacy `multilinkageCount`) or the number of further rooms? | Linked block | The field value is shown as is, only when it is more than 1 ("202 +3"); the backend decides what it counts     | Owner       | open   |
| Q-LM-2 | Add Another Room has no permission check in legacy, so a user without `reservation.edit` sees it. Keep that?            | Menu rules   | Yes, as the owner said; built in ticket 151 (`entries/151-edit-panel.md`, D-151-4): no check in the panel or the mock; the backend decides on save     | Owner       | open   |
| Q-LM-3 | Where does the backend get "night audit has run" for a reservation: the folio inference or an audit log?                | Menu rules   | The UI reads `ReservationDetail.folioCharges` (legacy inference); a backend may send the same fact differently | Backend     | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Why                     | Source       | Status   |
| ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------ | -------- |
| D-LM-1 | 2026-10-24 | Linked-room block (replaces the width tiers of D-21-2; `linkedBlockText` in `src/app/scheduleLinked.ts`). No early/late borders; link icon. First line (bold): the linked room, plus " +N" when `multilinkageCount` is above 1, in the 7 day view or for a stay of 3+ nights, else empty. Second line: the reserver in the 7 day view (blank when several rooms are linked); in the 14 day view with a stay under 3 nights, the linked room instead; else blank. Tooltip "Linked to <room>[ +N Room]" then the reserver. Grey, 75% opacity, `not-allowed` cursor | Legacy behavior         | owner        | in force |
| D-LM-2 | 2026-10-24 | A linked-room block activates nothing: no click, Enter, Space (pick up) or drag; not draggable (`isDraggable`). It stays focusable (grid cursor, or tab stop in the Unassigned section), opens its tooltip on focus, has `aria-disabled="true"`, and the grid announces "Linked room. It cannot be opened or moved from here."                                                                                                                                                                                                                                   | Legacy; keyboard access | owner, agent | in force |
| D-LM-3 | 2026-10-24 | Nightly Qty is a whole number of 0 or more with no maximum (the stepper has no upper limit; a new add-on starts at 1). The SKU stays required                                                                                                                                                                                                                                                                                                                                                                                                                    | Legacy; closes Q-73-2   | owner        | in force |
| D-LM-4 | 2026-10-24 | An add-on with no location or room type selected can be saved and is offered nowhere (closes Q-73-3)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Legacy                  | owner        | in force |
| D-LM-5 | 2026-10-24 | Add Another Room (`addRoomVisible` in `src/app/reservationMenu.ts`) is hidden, not disabled and with no message, when the reservation is cancelled, every room is checked out, or the night audit has run for it. The audit is inferred (`nightAuditHasRunForFolio`, `src/app/folioNightAudit.ts`): any folio charge Posted or Settled that is not a mobile POS charge. It stays visible after check in until then, and also while only some rooms have checked out. No permission check. Closes Q-22-3                                                          | Legacy                  | owner        | in force |

## Placeholders and invented values

- **P-LM-1:** the mock GR-50351 linked block (P-21-3) now has `multilinkageCount: 2`, so "+2" can be seen.
- **P-LM-2:** the mock reports `ReservationDetail.folioCharges` from the mock folio, with a posted room charge reported as unposted when it is dated after the last audited date (the audit posts up to that date). Seeded stays that began before the last audited date therefore hide Add Another Room. The mock also seeds one checked-in stay that arrives today, GR-50362 (Naomi Castellano, room C6, `rs-30`), so Add Another Room can be seen in the menu: its room charges are not yet audited.

## Notes

- **30 day view:** a linked block shows the icon only for a stay under 3 nights and the bold room title for 3 nights or more (the spec did not cover this view; it follows the same rules as D-LM-1).
- **Nightly Qty:** the UI has no maximum (matches legacy), but the backend should cap it at a sane maximum and answer 422 `validation` above it.
- **Linked block contrast:** the second line uses the primary text color on the 75% grey fill to keep WCAG AA contrast.
- **Unassigned section:** Enter, Space or a click on a linked block there announces 'Linked room. It cannot be opened or moved from here.' in the grid's polite live region, as in room rows.

## API, permissions, notes

- **API:** `ScheduleBlock.linkedTo.multilinkageCount?`, `ReservationDetail.folioCharges?` (see `api-contract.md`). Both optional, validated in `http.ts`.
- **Permissions:** none new. Add Another Room ignores `reservation.edit` (Q-LM-2); the other menu edit actions still need it.
- **Not verified:** the UI was checked by component and page tests only, not in a browser.
