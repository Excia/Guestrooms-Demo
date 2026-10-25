# Reservation List and Schedule control alignment (owner acceptance feedback, 2026-10-25)

Follow-up to 3.1 (list) and 3.2 (bulk check-in); no separate ticket. Figma: Reservation List 2524:31838, bulk check-in 2524:36149, Schedule controls 13908:92289.
**Status:** in review, PR pending, 2026-10-25.

## Figma deviations

| ID      | Area | Figma | Built | Why | Choice |
| ------- | ---- | ----- | ----- | --- | ------ |
| F-178-1 | Check-in bar | Centred button under the table | Same button, fixed centred near the viewport bottom while rooms are ticked | Owner asked for a floating bar | owner |

## Open questions

None.

## Decisions

| ID      | Date       | Decision | Why | Source | Status |
| ------- | ---------- | -------- | --- | ------ | ------ |
| D-178-1 | 2026-10-25 | One shared `NightAuditButton` (contained, info, large, min width 200px, shield icon) on the Schedule and the Reservation List. | The list used an outlined variant; owner wants both identical. | owner acceptance test | built |
| D-178-2 | 2026-10-25 | Field size standard in `src/components/shared/controlSizes.ts`: toolbar fields are `small` (40px high), form and dialog fields `medium` (56px). Toolbar widths: short select 114px, date field 176px, entity select 200px. | The list's date fields and Location select were 56px next to the Schedule's 40px View select. | owner acceptance test | built |
| D-178-3 | 2026-10-25 | Bulk check-in is a floating bar: fixed, centred, 24px above the viewport bottom, layer `speedDial` (above content, below the app bar and dialogs); shown only while at least one room can be checked in. The list keeps 96px extra bottom padding while it shows. Selection is announced through the polite status region. Check-in logic and result dialogs are unchanged. | Owner feedback; the button was at the very bottom of the list. | owner acceptance test | built |

## Placeholders and invented values

None.

## API, permissions, notes

- **API / permissions:** none.
- **Notes:** `DateField` gained a `size` prop (default `medium`). Row click opening the reservation panel is out of scope (later).
