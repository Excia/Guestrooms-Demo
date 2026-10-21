# Epic 1: Dashboard

Epic issue: Excia/Guestrooms-Demo#12. Figma page: Navigation + Dashboard. The dashboard is **not**
the home screen (Schedule is); it is reached through the menu's Dashboard button. All four tickets
are done. Back to the [index](../README.md). Entry fields are described in
[00-foundation.md](00-foundation.md).

## 1.1 Dashboard layout (3 columns)

Ticket Excia/Guestrooms-Demo#13; PRs Excia/Guestrooms-Demo#109 (stacked, merged into a base branch)
and Excia/Guestrooms-Demo#115 (carried #109 and #112 to `main`). Figma: Dashboard 69:3712
(1512 x 982); columns 69:3790, 69:3713, 69:3803.

- **Requirements:** `/dashboard` renders Reservation Management, Quick Stats, New Reservation in that
  order, each 450px at 1512 width with 24px gutters; uppercase headings; panels use theme paper and
  radius 4 on the `#f1f1f1` page; columns stack below the desktop breakpoint; each column scrolls
  independently (Quick Stats is a scrolling stack); header and menu present.
- **Implemented:** `src/pages/Dashboard.tsx`, `src/components/DashboardColumn.tsx`. Measured in
  Chrome: x=57, 531, 1005; width 450; panel top y=113. Titles are `<h2>` with CSS uppercase plus a
  visually hidden `<h1>` "Dashboard". Below 1200px the columns stack and the page scrolls; from 1200px
  each column scrolls on its own (an overflowing column becomes a focusable named region with a focus
  ring). Panel tops stay level through a CSS subgrid. Slot contract: slots are `ReactNode`;
  `undefined` shows the placeholder, `null` renders empty; `DashboardColumn` has `disablePadding`.
  `src/App.tsx` has a `pages` lookup by route path.
- **Deviations:** Figma gutters are about 26-27px with 54px outer margins and radius 8; the ticket
  says 24px and 4, which is what is built (D-040, Q-G-8). Columns are at most 450px and are centered
  above about 1500px. Column titles are grey (D-025).
- **Assumptions:** stacking below 1200px is the agent's proposal under D-010 (no tablet/mobile design).
- **Status:** done.

## 1.2 Quick Stats panel (Day, Week, Month)

Ticket Excia/Guestrooms-Demo#14; PR Excia/Guestrooms-Demo#113 (1.2.0). Figma component set 78:3760;
Dashboard variants Day 1302:18431, Week 1302:18299, Month 1302:18540; landing variants 78:3516,
78:3761, 120:8791.

- **Requirements:** one component `<QuickStats placement="dashboard" | "landing">` (the landing
  placement is reused by the Reporting landing page, ticket 6.1); tabs Day, Week, Month, Week by
  default; a per-tab control (Date, Start Date, Month with a "(to date)" current month); occupancy
  summary bar (booked, available, percent); revenue table (title "Daily/Weekly/Monthly Revenue",
  columns Revenue, Avg. Rate, Nights, a TOTAL row, one row per rate category from data); Day and
  Month show Room Blocks with an "ALL ROOM BLOCKS" link; Week shows Occupancy by day. Currency
  formatting (`$XX,XXX`, `$XXX.XX (avg)`), em dash for empty values; loading skeleton, empty and error
  states; `role="tablist"`; numbers right-aligned in tabular figures.
- **Implemented:** `src/components/QuickStats.tsx`, `QuickStatsTables.tsx`, `useQuickStats.ts`,
  `src/app/quickStats.ts` (pure rules), `api.dashboard.getQuickStats`, mock
  `src/api/quickStatsData.ts` (deterministic from the date). Tabs support arrows, Home and End with a
  themed focus ring. Each tab remembers its own period; a half-typed date does not refetch; a cleared
  date reverts on blur. Month select: "<Month> (to date)" first then 23 earlier months. Loading
  skeleton on the first load of a view only; while a new period loads, the previous data stays
  dimmed and `aria-busy`; stale responses are aborted. A failed refresh replaces numbers with an
  error alert and Retry. "ALL ROOM BLOCKS" links to `/room-blocks`.
- **Decisions:** D-004, D-005, D-043 to D-045.
- **Assumptions (provisional):** occupancy percent basis and TOTAL = mean of percents; door icons;
  money formats; USD; "empty" semantics; Week default Sunday of the current week (Q-14-1 to Q-14-4).
- **Stubs / placeholders:** rate category names, room block names, 24 sellable rooms, base rates
  are invented ([placeholders.md](../placeholders.md)). Figma frames 1302-18299, -18431, -18540 still
  deserve a visual pass (QA had no Figma tools).
- **Known minor issues:** an invalid date shows a red error state without helper text; the percent
  column is a few px off between the TOTAL row and body rows (unchecked against Figma); `today` is
  frozen at mount (a dashboard open past midnight keeps yesterday's defaults).
- **API:** `GET /dashboard/quick-stats` (see [api-contract.md](../api-contract.md)).
- **Status:** done.

## 1.3 Reservation Management shortcut list

Ticket Excia/Guestrooms-Demo#15; PR Excia/Guestrooms-Demo#111 (1.2.0). Figma 69:3790, badge item
14944:44821, badge icon 14944:44825.

- **Requirements:** ten links in order: Schedule | Home, Reservations, Open Folios, Unassigned
  Charges, Waitlist, Night Audit History, Add-On Countdown, Room Blocks, Member Directory, Reporting
  (same route table as the menu; no Admin Setup links); rows about 84px tall; an Unassigned Charges
  count badge in the warning color `#c24e00`, 28 x 28 minimum, 8px side padding, growing with the
  number (tested with 1, 10, 100, 1000); accessible label such as "10 unassigned charges"; count from
  the API client; keyboard-focusable links.
- **Implemented:** `src/components/ReservationManagement.tsx`, `src/app/shortcuts.ts`
  (`buildShortcuts`, `shouldShowBadge`, `unassignedChargesLabel`). Rows 450 x 84, 32px icon, 22px
  green label (`list_link` variant). The new route `unassigned-charges` has `showInMenu: false`.
  Accessible name "Unassigned Charges, 10 unassigned charges" (singular for 1); the digit is
  `aria-hidden`. Loading, empty and error leave all ten links working with no layout shift. No error
  UI when the count fetch fails (the badge is just absent). Count from `dashboard.getStats()` (mock
  returns 3).
- **Decisions:** D-041 (hide at zero, filter by page permission).
- **Deviations:** Figma shows no chevron; Figma's Reporting row links to a prototype, the app uses
  `/reporting`.
- **Open questions:** Q-15-1, Q-15-2 (built defaults awaiting owner confirmation).
- **Status:** done.

## 1.4 New Reservation search

Ticket Excia/Guestrooms-Demo#16; PR Excia/Guestrooms-Demo#112 (stacked) and Excia/Guestrooms-Demo#115;
follow-up Excia/Guestrooms-Demo#116. Figma 69:3803, fields 69:3806, CTA 69:3836.

- **Requirements:** title "NEW RESERVATION", subtitle "Search Available Rooms"; Check In / Check Out;
  Location (default "All Locations"); per-room Adults and Children steppers (default 02); "ADD ANOTHER
  ROOM"; Remove Room on rooms after the first; CTA "SEARCH X NIGHT STAY"; Check Out after Check In;
  CTA disabled until dates are valid; submit navigates to a results route with criteria in the URL;
  accessible names such as "Adults, Room 2".
- **Implemented:** `src/components/NewReservationSearch.tsx`, `src/app/reservationSearch.ts`,
  `src/pages/NewReservationResults.tsx` (stub). Nights math on UTC midnights (DST, leap day and year
  boundary tested). CTA reads "SEARCH STAY" until the dates are valid, then "SEARCH 3 NIGHT STAY" (1
  NIGHT singular). Stable room ids; Remove Room moves focus to the previous room's Remove button; a
  live region announces "Room N added/removed". Enter with invalid dates announces the problem and
  focuses the first invalid field. Submit goes to
  `/reservations/new/results?checkIn=...&checkOut=...&location=...&rooms=2.2` (stub echoing the
  parsed criteria, tolerant of malformed URLs). One range calendar for the two dates (D-027).
- **Decisions / defaults:** D-042 (limits), Occasion field omitted.
- **Deviations:** the CTA follows the content (Figma pins it to the column bottom); Figma's `#545454`
  stepper title color has no token so `text.secondary` is used; the form is 402px wide vs Figma 390px
  because the column panel pads 24px.
- **Stubs / placeholders:** the results route is a stub with no permission mapping (Q-G-16); the
  Location list is placeholder data (`src/app/placeholderLocations.ts`) because the mock API has no
  locations; `location` from the URL is unvalidated and the real results page must check it.
- **Open questions:** Q-16-1 to Q-16-4.
- **Status:** done.
