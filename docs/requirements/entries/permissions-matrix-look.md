# Permissions table in the Booking Rules matrix look (follow-up to 186 / #221)

Branch `fix/permissions-matrix-look`. Owner feedback: the Permissions page "looks good so far" but should be a framework/chart-like table similar to the
Booking Rules rules matrix. Presentation only: every legacy row, option, default and cascade is exactly as merged in #221.
Source of the look: `RulesMatrix` (Figma 15957:83580, built from the Figma variables). **Status:** in review, 2026-10-27.

## Before / after

| Part | Before (#221) | After |
| ---- | ------------- | ----- |
| Grid | Open rows with a thin divider line under each row | Bordered grid: every cell has the matrix 1px divider border (`cellSx`), same padding (px 2, py 1.5) |
| Table | Auto layout | Fixed layout, minimum width 120 spacing units, inside a scrolling wrapper (desktop-first; scrolls below 1200px), as Booking Rules |
| Header | Plain header cells | Bordered, top-aligned column headings "Management" and "Staff" (`h4_fixed`, as the audience headings); blank, borderless corner cell (visually hidden "Permission") 40 spacing units wide |
| Row labels | Bold labels with a caption hint | Bordered row-header cells; legacy hint as the secondary caption (same as the rule hints); area rows bold, function rows normal and indented |
| Cells | Underlined select | The same `CellSelect` control, inside bordered cells |
| N/A | Gray cell | The Booking Rules N/A cell: centered, gray disabled background, bordered (`notApplicableSx`) |
| View-only, a11y | Disabled selects, row/column headers, labels like "Rooms, Staff" | Unchanged (the page test and `viewOnly.test.tsx` still pass) |

## Booking Rules components reused

- `src/components/admin/bookingRules/CellSelect.tsx` (the cell select), unchanged.
- New shared `src/components/admin/bookingRules/matrixStyles.ts`: `cellSx`, `matrixTableSx` and `notApplicableSx`, moved out of `RulesMatrix.tsx` (which now imports them; no visual change there).
- Not copied: sticky header or first column (Booking Rules has none), the audience switches in the header (Permissions has none).

## Notes

- A screenshot of both pages was compared in Chrome: the grid, border colour, header weight, hint captions and N/A cells match.
