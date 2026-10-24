# 7.4 Add-On Items

Ticket Excia/Guestrooms-Demo#73; PR #155. Figma: Add-Ons 13533:74182 (frame 13533:72813).
**Status:** in review (branch `feat/73-add-on-items`), 2026-10-24.

## Figma deviations

| ID     | Area              | Figma                                      | Built                                                                          | Why                                                                   | Choice (owner, ticket, agent, forced) |
| ------ | ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------- |
| F-73-1 | Item / Combo      | Radio shown above the SKU select, no label | Same position; the group has the hidden name "Add-On Type"                     | Accessible name for the radio group                                   | agent                                 |
| F-73-2 | Nightly Qty.      | Stepper beside the toggle                  | Stepper disabled (not hidden) while the toggle is off                          | Keeps the layout stable; ticket says the toggle "enables" the stepper | ticket                                |
| F-73-3 | Associations hint | No message                                 | Hint under the tabs while no location or no room type is selected              | The meaning of an empty selection is open (Q-73-3)                    | agent                                 |
| F-73-4 | Header buttons    | Delete, duplicate and SAVE ADD-ON          | Same as Room Types (Cancel replaces delete and duplicate on an unsaved add-on) | Reuses the shared setup actions                                       | agent                                 |

## Open questions

`Q-73-1` and `Q-73-2` already exist in `open-questions.md`; their "Default used" cells there hold the agent's
defaults (updated in this PR). Only the new question is listed here.

| ID     | Question                                                                                           | Blocks       | Default used                                                                                                       | Who answers | Status |
| ------ | -------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ | ----------- | ------ |
| Q-73-3 | What does an add-on with no location or no room type selected mean: offered everywhere or nowhere? | Associations | Nowhere (the safest). A new add-on starts with nothing selected and the page shows a hint; saving is still allowed | Owner       | open   |

## Decisions

| ID     | Date       | Decision                                            | Why                                                                           | Source | Status |
| ------ | ---------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ------ | ------ |
| D-73-1 | 2026-10-24 | A SKU is required to save an add-on                 | The reservation shows the SKU price; an add-on without a price cannot be sold | agent  | open   |
| D-73-2 | 2026-10-24 | Photos are optional (at most 50), unlike room types | The ticket says only "Photos and description with limits"                     | agent  | open   |
| D-73-3 | 2026-10-24 | Deleting needs a confirmation only; no in-use check | No ticket rule; reservations hold their own add-on lines                      | agent  | open   |

## Placeholders and invented values

- **P-73-1:** sample add-ons, SKUs and the location list (`src/api/addOnData.ts`; locations reuse `PLACEHOLDER_LOCATIONS`). The add-on ids match the Add-Ons offered on the Room Types page.

## API, permissions, notes

- **API:** `addOns.getOptions/list/save/delete`; section "Add-on items" in `api-contract.md`.
- **Permissions:** the existing admin page `add-on-items`; no new permission.
- **Notes:** `LINE_QTY` (per-line quantity) is defined here for ticket 3.10 and is not used by this page. Ids of deleted locations and room types are dropped when the page loads an add-on and again on save.
- **Notes (cont.):** the room type's Add-Ons tab (7.3) and this page's Room Types tab are two sides of one association; the mock keeps them separate. The Add-On Countdown screen and the reservation dropdown (3.10) read `trackNightly`, `nightlyQty`, `isSelectableOn` and the SKU price.
