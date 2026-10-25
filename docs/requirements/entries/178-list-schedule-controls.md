# Reservation List and Schedule control alignment (owner acceptance feedback, 2026-10-25)

Follow-up to 3.1 (list) and 3.2 (bulk check-in); no separate ticket. Figma: Reservation List 2524:31838, bulk check-in 2524:36149, Schedule controls 13908:92289.
**Status:** in review, PR pending, 2026-10-25.

## Figma deviations

| ID      | Area                | Figma                          | Built                                                                      | Why                              | Choice |
| ------- | ------------------- | ------------------------------ | -------------------------------------------------------------------------- | -------------------------------- | ------ |
| F-178-1 | Check-in bar        | Centred button under the table | Same button, fixed centred near the viewport bottom while rooms are ticked | Owner asked for a floating bar   | owner  |
| F-178-2 | Pager rows-per-page | Filled select (Figma 20:2576)  | Kept filled (144px wide), outside the toolbar standard                     | Figma draws it filled on purpose | Figma  |

## Open questions

None.

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                           | Source                | Status |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------- | ------ |
| D-178-1 | 2026-10-25 | One shared `NightAuditButton` (contained, info, large, min width 200px, shield icon) on the Schedule and the Reservation List.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | The list used an outlined variant; owner wants both identical.                                | owner acceptance test | built  |
| D-178-2 | 2026-10-25 | Field size standard in `src/components/shared/controlSizes.ts`: toolbar fields are `small` (40px high), form and dialog fields `medium` (56px). Toolbar widths: short select 114px, date field 176px, entity select 200px.                                                                                                                                                                                                                                                                                                                                                                                                            | The list's date fields and Location select were 56px next to the Schedule's 40px View select. | owner acceptance test | built  |
| D-178-3 | 2026-10-25 | Bulk check-in is a floating bar: fixed, centred, 24px above the viewport bottom, layer `speedDial` (above content, below the app bar and dialogs); shown only while at least one room can be checked in. The list keeps 96px extra bottom padding while it shows. Selection is announced through the polite status region. Check-in logic and result dialogs are unchanged.                                                                                                                                                                                                                                                           | Owner feedback; the button was at the very bottom of the list.                                | owner acceptance test | built  |
| D-178-4 | 2026-10-25 | Heights are enforced, not left to line-height arithmetic: the theme sets an explicit height on every outlined input root, `FIELD_HEIGHT_PX.small` (40px) for `size="small"` and `.medium` (56px) otherwise, and gives the Select's inner line the same 1.4375em as a text input. Select and DateField are therefore exactly equal at each size. Widths stay: date field 176px (fits yyyy-mm-dd plus the calendar button), View select 114px, Location 200px. Expected rendered boxes: View 114x40, Check in From and To 176x40, Location 200x40, Rows per page 144 wide, filled, unchanged (about 57px). Multiline inputs are exempt. | Owner: date fields must match the View field; measured 41px vs 40px.                          | owner follow-up       | built  |

## Placeholders and invented values

None.

## API, permissions, notes

- **API / permissions:** none.
- **Notes:** `DateField` gained a `size` prop (default `medium`). Row click opening the reservation panel is out of scope (later).
