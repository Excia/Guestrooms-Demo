# LP-S.1 Block content, month view and tooltips

Ticket Excia/Guestrooms-Demo#147 (epic #146); PR Excia/Guestrooms-Demo#168. Figma: "Reservation Schedule Block" (12063:34272, "[Name]" / "[Relevant Detail]" / type icon) and tooltip 12105:14144. The owner chose to match the legacy (Vue) schedule box for the content rules; layout, tokens and icons stay this build's.
**Status:** in review, 2026-10-24.

## Figma deviations

| ID      | Area                   | Figma                                    | Built                                                                                                                             | Why                                                | Choice |
| ------- | ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| F-147-1 | Block second line      | One "[Relevant Detail]" line             | The detail by the legacy order (D-147-2); the confirmation number when there is no detail (it was the second line before this PR) | Ticket: legacy parity without losing existing info | ticket |
| F-147-2 | Tooltip on every hover | Tooltip on a cut-off block (12105:14144) | A reservation block's tooltip opens on every hover and on keyboard focus; a closure's still only when its text is cut off         | The tooltip now lists more than the block shows    | ticket |

## Open questions

| ID      | Question                                                                                                 | Blocks | Default used                                                                                                                      | Who answers | Status                                                         |
| ------- | -------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| Q-147-1 | Ticket question: which detail wins on the second line when room type and housekeeping status both apply? | None   | They cannot both apply: only an unassigned reservation shows a room type, and it has no room, so no housekeeping status (D-147-2) | Owner       | answered by the legacy rules (getRelevantDetailLabel), confirm |
| Q-147-2 | Initials format: legacy writes "L, F" from "Last, First"; the functional doc writes "F.L."               | None   | "F.L." from "First Last" (this build writes names first name first)                                                               | Owner       | open                                                           |
| Q-147-3 | "Folio balance when it fits": shown by CSS ellipsis, not measured. Is that enough?                       | None   | Yes: the balance is the detail of a checked-in or checked-out stay with an open folio; narrow blocks cut it; the tooltip has it   | Owner       | open                                                           |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                             | Source | Status |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------ | ------ |
| D-147-1 | 2026-10-24 | First line (`blockContent`, `src/app/scheduleBlockContent.ts`): the lead occupant with " +N" (N = guests in the room minus one), else the reserver, else the block name, else the guest count ("3 guests"). Month (30 day) view and a stay under 2 nights: initials ("D.W.") and no guest-type icon                                                                                                                                                         | Legacy + ticket                 | owner  | built  |
| D-147-2 | 2026-10-24 | Second line, first match wins: no room: the room type; checked in or out: "Balance due: $X" while the folio balance is above zero (zero or negative shows nothing), else the reserver when not the lead occupant (no "+N" on it, unlike legacy, which repeats the lead's; here it would duplicate the first line); the reserver when not the lead occupant; "Maintenance" when housekeeping needs maintenance; the block name; else the confirmation number | Legacy `getRelevantDetailLabel` | owner  | built  |
| D-147-3 | 2026-10-24 | Tooltip lines: the existing summary (guest, confirmation number, part, room), the guest type (Room owner, Club member, Non-member guest), "Reserver: X" when not the lead, "Occupants: ..." listing every occupant with TBD for unnamed guests (when more than one guest), room type when unassigned, block name, open balance                                                                                                                              | Legacy title + ticket           | owner  | built  |
| D-147-4 | 2026-10-24 | Guest-type icon and name color were already built (ticket 3.11 treatments: owner, member, none/guest tokens `ownerText`, `memberText`); only the compact-month hiding is new. The icon is decorative; the type is named in the tooltip                                                                                                                                                                                                                      | Reuse                           | agent  | built  |

## Placeholders and invented values

- **P-147-1:** `BLOCK_CONTENT_SEEDS` in `src/api/scheduleData.ts` gives a few seeded blocks occupants, a reserver, a block name, a room type (unassigned) and a balance so the rules can be seen. The backend sends real values.

## API, permissions, notes

- **API:** `ScheduleBlock` gains optional `occupantCount`, `occupants` (named, lead first), `reserverName`, `blockName`, `roomTypeName` (unassigned) and `balanceCents`. `guestName` stays the lead occupant. Absent fields drop their line. Worth a section in `api-contract.md` when the backend contract is written.
- **Permissions:** none.
- **Notes:** The accessible name (`blockAriaLabel`) starts with the block's visible first line (initials and +N included, WCAG 2.5.3), then the guest type, confirmation number, status, room and dates, and every fact the tooltip states (full lead name on a compact block, reserver, occupants, room type, block name, balance); the tooltip stays hidden from assistive technology. Folio balance on a checked-out stay is the legacy "unsettled folio" signal; the red outline for it (functional doc 15.11.3.4.2, gap C3) is not built.
