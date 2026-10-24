# Unassigned row at zero

Fix, no ticket; PR Excia/Guestrooms-Demo (see branch `fix/unassigned-zero-collapsed`). Figma: no frame for the zero state.
**Status:** in review, 2026-10-24.

## Figma deviations

| ID     | Area                              | Figma    | Built                                                                                   | Why                       | Choice (owner, ticket, agent, forced) |
| ------ | --------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| F-UZ-1 | Unassigned row, zero reservations | No frame | Collapsed row "Unassigned (0)" with a red "+" circle toggle, dimmed and `aria-disabled` | Owner decision 2026-10-24 | owner                                 |

## Open questions

None.

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                        | Source                          | Status   |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- | -------- |
| D-UZ-1 | 2026-10-24 | When the visible range has no unassigned reservations, the Unassigned row is still shown, collapsed, as "Unassigned (0)" (before: hidden, D-21-1). The other states are unchanged: one reservation is a single row without a toggle; two or more are expanded by default and collapsible to "Unassigned (N)". At zero the toggle is shown as the collapsed "+" state but there is nothing to expand, so it is `aria-disabled="true"` (not `disabled`: it keeps keyboard focus), has `aria-expanded="false"`, does nothing on click or Enter, and is described by a visually hidden "There are no unassigned reservations in this date range." Chosen over omitting the toggle so the row looks the same in every state and the "no unassigned" fact is announced. The row counts as one grid row (`aria-rowcount`, row offsets, scroll math and virtualization already use the section's row count) | Owner decision, 2026-10-24 | owner, agent (toggle treatment) | in force |

## Placeholders and invented values

None.

## API, permissions, notes

- **API:** none.
- **Permissions:** none.
- **Notes:** supersedes the "none in the range, no row" part of D-21-1. Code: `unassignedSection` in `src/app/unassignedRows.ts` (state `empty`).
