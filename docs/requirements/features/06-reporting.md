# Epic 6: Reporting

Epic issue: Excia/Guestrooms-Demo#56. Figma page: Reporting (frames inside the ARCHIVE section and the
"USING FOR DEMO DO NOT UPDATE" copies are not sources; skip frames named ARCHIVE). Back to the
[index](../README.md). Entry fields are described in [00-foundation.md](00-foundation.md).

**Current code for the whole epic:** the route `/reporting` exists with a placeholder page. Quick
Stats (ticket 1.2) is built with `placement="landing"` ready for the landing page. The shared pieces
that reports need are built: `DateSelection` with compare states, `LocationFilter`, `Pagination`,
`ConfirmDialog`, `SaveToast` (ticket 0.9). No report API exists; the needs are in
[api-contract.md](../api-contract.md#planned-endpoints). All tickets are **not started**.

**Shared rules for every report:** revenue excludes taxes and service charges (room charges and
add-ons only, D-004); average rate is weighted, total revenue divided by total nights (D-005);
money is integer cents; PDFs and exports come from the backend and open in a new tab (D-003); every
standard report plugs into the shell of 6.2 and the per-report tickets only define columns, filters,
grouping and totals.

## 6.1 Reporting landing page

Excia/Guestrooms-Demo#57. Figma: Reporting Landing 310:7003; Quick Stats landing variants 78:3516, 78:3761,
120:8791.

- **Requirements:** breadcrumb "Guest Rooms | Reporting" (see D-020). Left: **Quick Stats** (Day / Week
  / Month, two-column landing placement, ticket 1.2), then **Standard Reports** tiles with icon and name:
  Housekeeping, Reservations by Room Type, Month End, Room Arrival List, Occupancy Summary, Room
  Cancelation List, Outstanding Folio Balance, Room Daily Occupancy, Room Departure List, Rooms Guest
  List, Rooms Sold, Sales Forecast. Right: **Custom Reports** with a **NEW REPORT** button, a "Search
  Custom Reports" field and a scrollable list showing name and "[Creator Name] | Updated: date time".
  A standard tile opens the report in the shell with defaults; a custom report opens the builder (6.3).
  The tile grid reflows below the desktop breakpoint; tiles come from a registry (id, label, icon,
  route); the custom list loads from the API, filters as you type, sorted by most recently updated;
  empty states for no reports and no matches.
- **Open questions:** Q-57-1, Q-57-2.
- **Status:** in review (Excia/Guestrooms-Demo#57). Built: `src/pages/Reporting.tsx` at `/reporting`
  (Quick Stats with `placement="landing"`, tile grid, custom reports panel), registry and rules in
  `src/app/reports.ts` (`STANDARD_REPORTS`, sort newest first, filter by name or creator, "MM/DD/YY h:mm AM"
  formatting), `GET /reports/custom` (`api.reports.listCustom`, mock in `src/api/reportsData.ts`).
  Two regions scroll on their own from 1200px; below it everything stacks and the tile grid reflows
  (`auto-fill`, min 260px). Empty states: "No custom reports yet..." and "No custom reports match your search."; a
  failed load shows an error with Retry.
- **Built defaults:** tiles link to `/reporting/standard/<id>`, custom rows to `/reporting/custom/<id>` and NEW
  REPORT to `/reporting/custom/new`. Those routes arrive with 6.2 and 6.3 and show "Not found" until then.
  The search also matches the creator name (the ticket says "filters by the search box"; Figma shows only
  "Search Custom Reports"). The Quick Stats average rate stays the weighted average already built in 1.2.

## 6.2 Standard report shell

Excia/Guestrooms-Demo#58. Figma: Standard Report 79:7833, Column List 3:1531, Group By List 43:4479,
Column Filter 1:34080, View Options 49:5607, Export Options 310:8132, Pagination 20:2576, Date
Selection 120:8668, Location Filter 120:6825, Confirm Leaving 88:4839.

- **Requirements:** left panel: Back to Reports; a **Standard Report** select; **Filters / Report
  Settings**: Date Range select (This Week, Today, Month, As Of Date, custom From/To), **Compare Dates**
  toggle (adds "Compare to"), add-filter links (Location, Guest, Staff, Room Type, Check In, Owner
  depending on the report); **RUN REPORT**; footer **SAVE AS NEW REPORT** and **EXPORT**. Toolbar:
  **Columns (N)** multi-select, **Group By**, **Display Totals** toggle, **VIEW** (Standard,
  Transposed). Results: "X [Results]" count, sortable headers (the active sort column is tinted with an
  arrow and a filled filter icon), rows, a bold gray **totals row**, pagination. Column menu: Sort
  Ascending/Descending, Filter, Search Values, Label, Column Settings. Export: CSV (client-side) and
  PDF (backend contract). `<ReportShell>` takes a definition (columns, defaults, filters, groupings,
  date mode, total rules); filters drive a typed `ReportQuery`; Group By adds subtotal rows; the table
  scrolls horizontally with a sticky first column and is virtualized for large results. Unsaved changes:
  Confirm Leaving "This report has not been saved. Are you sure you want to leave without saving?"
  (Leave Without Saving / Save Now).
- **Open questions:** Q-58-1, Q-58-2.

## 6.3 Custom report builder

Excia/Guestrooms-Demo#59. Figma: Custom Report 3:1522, Save Split Menu 79:8820, Save Toast 69:4219,
Confirm Leaving 88:4839, Column List 3:1531, Group By List 43:4479.

- **Requirements:** same shell with **Report Name** (default "Custom Report_MMDDYY"), **Report Type**
  select, date range, compare dates, filters; footer **SAVE** split button with **Save as New Report**,
  and **EXPORT**; toast "Report Saved" with a working **UNDO**; Confirm Leaving on a dirty state (Save
  Now saves then leaves). Entry points: NEW REPORT, an opened saved report, and Save as New Report from
  a standard report. Save updates the existing report; Save as New Report creates a copy; the name is
  required and unique per owner; pickers expose the columns of the chosen report type; saved reports
  appear in the landing list with creator and updated time.
- **Open questions:** Q-59-1, Q-59-2.

## 6.4 Housekeeping

Excia/Guestrooms-Demo#60. Figma: Housekeeping 310:8796; TYPES and STATUSES note 12336:139173.

- **Requirements:** date **Today** by default with a single Date field; filters Location and Type; count
  label "N Rooms". Columns: Location, Room Number, Arrival Date, Arriving Occupants, Departure Date,
  Departing Occupants, Public Notes, Type, Status. **Types:** New Arrival (arriving on the report date),
  Stay Over (neither arrival nor departure), Departure (leaving on the report date, no arrival to the
  same room that day), Turnover (departing with another reservation arriving the same day). **Statuses**
  show only on Departure and Turnover rooms: Not Checked Out, Needs Cleaning, Cleaned, Ready, Needs
  Maintenance. The Status column shows "Early Check In" for New Arrival rows with early check in
  selected (not a housekeeping status; cannot be set from the housekeeping block). Type derivation is a
  pure function with a test per type; multiple reservations on one room per day produce the right rows
  (Turnover shows both occupants).
- **Open questions:** Q-60-1, Q-60-2.

## 6.5 Room Arrival, Room Departure, Room Cancellation lists

Excia/Guestrooms-Demo#61. Figma: Arrival 409:17302, Departure 409:19830, Cancelation 409:18195.

- **Requirements:** **Room Arrival List** ("N Total Arrivals"): date range default This Week; filters
  Location, Room Type, Check In; columns (header says 8): Date, Occupants, Adults, Children, Check In,
  Room, Room Type, Reservation #, Nights; Early Check In indicator. **Room Departure List** ("N Total
  Departures"): filters Location, Room Type, Check In; columns (header says 6): Date, Occupants, Check
  Out, Room, Reservation #, Method of Pay, Folio Balance; Late Check Out indicator; Group By and Display
  Totals. **Room Cancelation List** ("N Total Cancelations"): filter Location; columns (header says 4):
  Date Booked, Date Canceled, Occupants, Member ID, Room. Indicators come from ticket 3.12 flags; Folio
  Balance as currency; Method of Pay shows the primary payment method; totals count rows.
- **Open questions:** Q-61-1, Q-61-2.

## 6.6 Daily Occupancy Compare, Occupancy Summary

Excia/Guestrooms-Demo#62. Figma: Daily Occupancy Compare 1804:26787; Occupancy Summary as-of with time
frames 409:16318, compare 1829:132767, by date 607:14098.

- **Requirements:** **Daily Occupancy Compare:** date range with Compare Dates (default Last Week);
  filter Location; columns (header says 4): Date, Total, Totals. **Occupancy Summary** (As Of Date,
  Group By Time Frame): rows Day, Month (beginning of month), Year (beginning of year); columns (header
  says 6): Total Guests, Total Number of Rooms, Total Rooms Sold, Total Rooms Available, % Occupancy,
  Actual Room Revenue, Average Room Revenue, Revenue Per Room; the compare variant shows each frame for
  the as-of date and the same date a year earlier. Alternate frame grouped by Date: Date, Number of
  Rooms, Total #. Percent occupancy = rooms sold / rooms available (document the formula); both periods
  computed and aligned; tests for time frame boundaries and year-over-year compare.
- **Open questions:** Q-62-1.

## 6.7 Rooms Sold and Rooms Sold Compare

Excia/Guestrooms-Demo#63. Figma: Rooms Sold 413:25101, Compare 1829:94234.

- **Requirements:** date range default This Week, Compare Dates (default Last Week), filters Location and
  Room Type; columns (header says 7) per date: Date, rooms sold, total rooms ("XXX Total Rooms"),
  occupancy percent ("XX% Occupancy"). Rooms sold counts occupied room-nights per date; filters apply to
  totals and percentages; compare aligns days and shows deltas.
- **Open questions:** Q-63-1.

## 6.8 Month End, Month End Compare, Month End by Location

Excia/Guestrooms-Demo#64. Figma: Month End 310:9754, Compare 1738:14399, by Location 682:15177.

- **Requirements:** **Month End:** Date Range Month (e.g. "February 2025"), optional Compare Dates, filter
  Location; columns (5): Date, Daily Revenue, Occupied, # Sold, % Occupancy; footer rows **Totals** and
  **Average** ("n/a" where an average does not apply; averages weighted, D-005). **Compare:** adds
  "Compare to" (e.g. February 2024) and "2025 Totals", "2025 Average", "2024 Totals", "2024 Average".
  **by Location:** columns (6) add Location; Group By Location, each group showing "X Reservations" and
  its own totals. One row per day of the month; leap years and 28/30/31-day months handled; tests for
  daily revenue sum, occupancy percent and month length.

## 6.9 Room Guest List, Reservations by Room Type

Excia/Guestrooms-Demo#65. Figma: Room Guest List 410:20538, Reservations by Room Type 325:8698.

- **Requirements:** **Room Guest List** ("N Reservations"): date range default This Week, filter
  Location; columns: Room Number, Reservation #, Occupants, Adults, Children, Arrival, Departure, Last
  Modified, Created By, Rate, ADR, Adjusted Rate (reflects 3.8 adjustments), Rate Category; Online Booking
  indicator; Totals row. **Reservations by Room Type:** filter Location, Group By Room Type; columns (6):
  Reservation #, Room Number, Reserver, Occupants ("X [Guest Name], [Guest Name...]"), Arrival Date,
  Nights, Booking User; group header "X Reservations, X Nights"; online bookings show "(Online)" after
  the booking user (member and non-member). The Occupants column shows the first names with an overflow
  count.
- **Open questions:** Q-65-1, Q-65-2.

## 6.10 Sales Forecast (and Compare), Outstanding Folio Balance

Excia/Guestrooms-Demo#66. Figma: Sales Forecast 310:8233, Compare 1804:21238, Outstanding Folio Balance
406:9475.

- **Requirements:** **Sales Forecast:** date range default This Week (future dates), Compare Dates (default
  Last Week), filters Location and Room Type; columns (header says 9): Date, Room Arrivals, Room
  Departures, Rooms Sold, Rooms Available, Occupancy, Revenue, with **Totals** and **Average** rows; uses
  booked reservations for future dates and actuals for past dates. **Outstanding Folio Balance:** As Of
  Date, filter Location; columns (5): Jump to Folio (link to the folio, 4.1), Reservation #, Reserver, Lead
  Occupant, Outstanding Balance, plus Folio Details; footer **Total Outstanding Folio Balance**; lists
  reservations with a balance above zero as of the date.
- **Open questions:** Q-66-1.

## 6.11 Owner Report

Excia/Guestrooms-Demo#67. Figma: Owner Report 13468:41372, ALT Counts Only 14722:71680, Grouped by Owner
13471:54734, Room Selection Menu 13471:54562.

- **Requirements:** **standard:** date range (This Week, Past Year, Custom), filters Location and Owner;
  columns: Owner, Room, Linked Room Occupied Nights, Total Occupied Nights, Owner-Occupied Nights, Vacant
  Nights, Total Occupancy %, Non-Owner Occupancy %, Total Revenue, Owner Revenue Share; Totals and
  Averages rows; a member owning several rooms (including linked rooms) shows each room under the owner.
  **Counts Only:** Owner, Room, Non-Owner Occupied Nights, Owner-Occupied Nights, Total Revenue, Owner
  Revenue Share. **Grouped by Owner:** the same measures per owner. The room selection menu lists
  "[Room #] ([Owner Name] | XX%)", suggesting a per-room owner share percentage. The Owner filter lists
  members who own rooms. Depends on the Owner setting and Room Owner field (3.11, 7.3).
- **Open questions:** Q-67-1, Q-67-2 (also named in the owner's list of answers still needed).

## 6.12 Room Revenue Report and groupings

Excia/Guestrooms-Demo#68 (marked "blocks Ready"). Figma: section 13479:72729 with six frames 13468:38292,
13479:68527 (totals), 13468:39343, 13468:40321, 13880:88112, 13880:89135.

- **Requirements:** columns Room #, Date, Nights, Location, Room Type, Owner, Occupancy Type, Rate
  Category, Nightly Revenue; totals "Rooms: N" and "Total Revenue: $X". **Occupancy Type** reflects the
  Lead Occupant; if the Lead Occupant is TBD it follows the Reserver with an "(Reserver)" indicator
  (Member, Non-Member or Owner); derivation tested. **Nightly Revenue** includes room charges and
  add-ons, without taxes and service charges (D-004). Rate Category examples: Owner Rate ($0.00), Member
  Rate, Non-Member Rate. The six frames show different groupings, implemented through the shell's Group By
  with subtotal rows.
- **Open questions:** Q-68-1.
