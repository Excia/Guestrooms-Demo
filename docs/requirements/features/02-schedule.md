# Epic 2: Schedule | Home

Epic issue: Excia/Guestrooms-Demo#17. Figma page: Schedule. The Schedule is the home screen
(`/schedule`; `/` redirects there). Back to the [index](../README.md). Entry fields are described in
[00-foundation.md](00-foundation.md).

## 2.1 Schedule grid (rooms by dates)

Ticket Excia/Guestrooms-Demo#18; PR Excia/Guestrooms-Demo#118 (1.3.0). Figma: Schedule (grid,
filters, drag dialogs) 15967:188321; Schedule Blocks 15963:188278.

- **Requirements:** rooms down the side, dates across the top; 7, 14 and 30 day views with
  horizontally scrollable dates and a sticky room column; controls row: View select, single and double
  chevrons, calendar picker, Today, Night Audit, New Reservation, "All Rooms" select with Available
  only / Booked only, filter icon; list/calendar toggle (list is ticket 3.1); filter panel with
  Locations and Room Types checkbox lists and Select All / Select None; row header "location | room
  type" plus room number; weekday header such as "Monday 11/10"; closures as gray blocks (e.g.
  "Reserved: Fixed Loss") with an orange block-end marker. Drag and drop (Figma notes): can drag to
  the same room type, a different room type, a future date, and NYCI rooms; cannot drag onto a room
  with a reservation or closure on the same dates, checked-out rooms, closures; a room of a multi-room
  reservation dragged to a new date moves all rooms. Confirmations: **Room Change** dialog and **Date
  Change** dialogs (single and multi-room with a "split the room from reservation" link); buttons
  Cancel / Move to New Room / Move to New Dates. Target 200 rooms x 30 days without jank; keyboard
  accessible; unit tests for the rules.
- **Implemented:** `src/pages/Schedule.tsx` (lazy chunk, 63.5 kB), `src/components/schedule/*`
  (`ScheduleGrid`, `ScheduleControls`, `ScheduleFilterPanel`, `MoveConfirmDialog`,
  `ScheduleItemView`, `ScheduleSkeleton`, `useSchedule`), pure rules `src/app/schedule.ts`,
  `scheduleDrag.ts` (`canDrop`), `scheduleGrid.ts`, `scheduleUrl.ts`.
  - View state in the URL: `start`, `view`, `locations`, `types`, `rooms` (tolerant of bad input;
    defaults omitted; other params such as `?mock=` kept).
  - Today's column is tinted; 30-day headers are shortened (full name in the accessible label).
  - Pointer drag shows a ghost and a green/red drop indicator; invalid drops snap back with a message.
    Keyboard: pick up with Enter, Space or M (Enter changed in PR #119, D-057), arrows to a target,
    Enter to drop, Escape to cancel, with live-region announcements.
  - `role=grid` with column and row headers and named gridcells; one tab stop with
    `aria-activedescendant`; visible focus.
  - Rows are virtualized: with `?schedule=large` (200 rooms x 30 days, dev only) about 17 rows render;
    first rows in about 1.1 s; median scroll frame 16.7 ms (p95 about 33 ms for 30-day vertical scroll
    in headless Chrome with software rendering).
  - The multi-room split link gives the split room a new reservation id.
  - An `ErrorBoundary` wraps every lazy page.
  - Block colors are theme tokens under `palette.schedule`.
- **Decisions:** D-050 to D-056.
- **Deviations:** the availability control is a 3-item menu (Figma: split button, D-052); the chevron
  steps and default view are the agent's defaults (D-051); the due-out block color is a placeholder
  (Q-18-7).
- **Not built:** early/late edge markers beyond the minimal ones added in PR #119, housekeeping "H"
  blocks, the linked-room block style (ticket 2.4). Touch users cannot drag; no edge auto-scroll.
- **Notes:** mock schedule data follows the real current date. `?mock=empty|error|loading` also drive
  the permissions call, so they redirect before the Schedule shows; a `?schedule=empty|error` dev
  toggle would fix that (not done). `routes.ts` gained `RESERVATIONS_PATH` and
  `NIGHT_AUDIT_HISTORY_PATH`.
- **API:** `GET /schedule`, `POST /schedule/move-room`, `POST /schedule/move-dates`
  ([api-contract.md](../api-contract.md)).
- **Open questions:** Q-18-1 to Q-18-7 (the first three were answered by the defaults in D-050).
- **Status:** done.

## 2.2 Reservation details panel with split CTA

Ticket Excia/Guestrooms-Demo#19; PR Excia/Guestrooms-Demo#119 (open, **in review**). Figma: NEW Res
Details Panel with Split CTA 2623:9046; New Res Panel 11905:17751; Search Results CTA Placement
11905:17750; components Res Panel Split CTAs 15793:32604, Res CTAs 2623:8293, ResDetailsAccordion
2623:8964 and 11896:14626. Frames named ARCHIVE are superseded.

- **Requirements:** clicking a block opens the details panel with accordion sections; New Reservation
  opens the new-reservation variant; split CTA (primary action plus a menu of secondary actions per
  state); the Room field lists every room regardless of location and room type, grouped or
  searchable; "Back to schedule" returns to the view the panel was opened from (view, date range,
  filters); a hold timer appears on a new reservation (length from Booking Rules, D-006); Early Check
  In and Late Check Out checkboxes in the panel header work like the hub and **auto-save**; Escape and
  outside click close the panel with focus returned to the trigger.
- **Implemented in PR #119 (not yet on `main`):** `src/components/reservation/*`
  (`ReservationPanel`, `ReservationDetails`, `NewReservationPanel`, `DetailsAccordion`,
  `EarlyLateToggles`, `RoomAutocomplete`, `CountStepper`, hooks), `src/components/shared/SplitButton.tsx`,
  `src/app/splitCta.ts`, `holdTimer.ts`, `earlyLate.ts`, `panelUrl.ts`, `newReservation.ts`,
  `roomOptions.ts`, `reservationPanel.ts`, API additions `reservations.getDetail`, `setEarlyLate`,
  `create`, `settings.getBookingHold`, permission `reservation.edit`.
  - Panel is a 400px right drawer, full width below 1200px; state in the URL (`?res=<id>&rr=<reservationRoomId>`
    or `?panel=new`) next to the schedule's own params.
  - Room list: 30 rooms in 8 groups while the grid showed 9 rows; all 200 in the large inventory;
    Location and Room Type are derived from the chosen room. Escape closes an open Room list first and
    is ignored while the hold-expiry dialog is open.
  - Early/Late: Saving, Saved, error with Retry (polite announcements); a change that cannot be
    confirmed (timeout, 5xx) reloads; if the reload also fails the box keeps the user's choice with a
    Reload button.
  - Create is idempotent: a retry after an unknown outcome reuses its `requestId`.
  - Early/late edge markers added to schedule blocks (optional `earlyCheckIn` / `lateCheckOut`), kept
    minimal for ticket 2.4.
- **Owner requests being implemented now in the same PR (requested by owner, in progress):** side
  configurable (right drawer, left configurable), Booking Guest TBD, Lead Occupant optional, Unassigned
  dropdowns, an empty-cell click opens New Reservation with the room prefilled, green close X, the
  "New Room Closure" tab selectable but not implemented (D-063 to D-069). This file will be updated
  when the PR changes.
- **Deviations:** header shows "Confirmed" / "Pending" before check in (Figma draws no label, D-061);
  the Early/Late checkboxes sit under the stay dates (no frame shows them in the header);
  "Back to schedule" is not drawn on the details panel in Figma (only the close X) and is a text
  button on the New Reservation variant; the ARCHIVE flow is not built (D-062).
- **Not built (Figma frames exist):** Edit Reservation form, Add Another Room panel, the "Search
  Results CTA Placement" frame.
- **Stubs (each shows a polite notice, none is a silent no-op):** Check In / Check Out variants,
  Manage Reservation, Edit Room, Print Registration Card, Edit Guests, add-ons, Edit notes, Payment.
  The notices say "ticket 3.12" (developer wording) until the Hub exists. Jump to Folio goes to
  `/open-folios` (stub route). A read-only user (no `reservation.edit`) still sees the primary CTA
  enabled (stubs); the reason is shown at the top of both panels.
- **Placeholders:** hold minutes 15 / 10 / 10; Booking Guest text field; placeholder nightly rates
  (estimated total excludes taxes) ([placeholders.md](../placeholders.md)).
- **Needs backend:** a hold/reserve call when the panel opens and a hold token sent with `create`
  (nothing holds the room on the server yet, Q-19-3).
- **Known minor issues:** after a failed create the footer alert covers part of the Room field and
  focus stays on Create; merge hotspots for tickets 2.3 to 2.5 and 3.x: `Schedule.tsx`,
  `ScheduleGrid.tsx`, `routes.ts`, `permissions.ts`, `mockUsers.ts`.
- **Open questions:** Q-19-1 to Q-19-5.
- **Status:** in review (Excia/Guestrooms-Demo#119); the owner requests above are in progress.

## 2.3 Change room during stay (menu and dialog)

Ticket Excia/Guestrooms-Demo#20; PR not opened yet (branch `feat/20-change-room-during-stay`). Figma: Change
Room During Stay 1326:19431; room menu 2623:14538; Room Number 818:7756; reservation menu 2623:11689; hub
menu 2623:11665. "ARCHIVE Change Room During Stay/On" is superseded.

- **Requirements:** from a checked-in reservation the user opens Change Room During Stay and selects
  a new room from a menu; Change Room available only when checked in; the menu lists eligible rooms
  (available for the remaining stay dates), ineligible rooms disabled with a reason; a confirmation
  states old and new room and effective dates (Cancel changes nothing); the reservation stays checked
  in on the new room; folio and room charges follow the rate rules (D-015: setting-driven retain-rate
  dialog; nights already stayed keep their price); schedule and hub refresh.
- **Source order (D-090):** Figma first, then the functional-requirements document (behavior and rules text
  only; its old layouts are outdated). Figma 1326:19431 and requirements 27.9.1.2 / 27.9.3.2 **agree**: a
  "Change Room During Stay" toggle (off by default) shows each night of the reservation as its own line with a
  dedicated room dropdown (27.9.1.2.1); the dropdowns list the rooms available on that single night even when
  not free for the whole stay (27.9.1.2.2), may list all rooms, with a filtered dropdown by room type or
  location suggested (27.9.1.2.3); Update Reservation shows errors (27.9.1.3); a multi-room Edit Room follows the
  same behavior (27.9.3.2).
- **Implemented (branch, in review once the PR is open):**
  - **Entry point (D-083):** a "Change Room" text button under the room card (single room) or the room
    selector (multi-room) in the reservation details panel (`ReservationDetails.tsx`). It is shown for every
    room but is `aria-disabled` with the reason as its description (and a tooltip) unless the room is checked in,
    the user holds `reservation.edit`, a room is assigned, at least one night is left (the stay does not end
    today) and no room change is being saved. Clicking it while unavailable shows the reason in the panel's
    notice. The other stubs (Edit Room, the pencil, Undo Check In) are unchanged.
  - **Per-night dialog (D-084):** `ChangeRoomDialog` step 1 shows the stay one line per night as in Figma:
    nights already stayed are locked ("Night 1: 10/15/2026 | Room 301" with the shield icon), every remaining
    night is "Night n: date" over its own searchable room menu (MUI Autocomplete) defaulting to the night's
    current room. Each menu lists the rooms available on **that night** (half-open nights, same-day turnover
    allowed), grouped "location | room type"; unavailable rooms are disabled (`aria-disabled`, reason as text and
    `aria-describedby`): "Closed 10/17-10/20", "Booked 10/17-10/19", "Checked-out stay ...", "Locked to its room
    type". The current room of a night is always selectable; the stay's own other parts never block. A changed
    night shows "Was Room 301". An optional Location and Room Type filter above the nights narrows every menu
    (27.9.1.2.3.1; keeps each night's own room). Continue is disabled with the reason "Choose a different room for
    at least one night." until a night differs (putting a night back disables it again). The inventory for the
    remaining nights comes from `schedule.get` windows, not the page's own window. "Apply this room to all
    remaining nights" is not built (Figma does not show it). Each menu's options are built only when it opens,
    from an index of the inventory made once; a stay of more than 60 remaining nights lists its nights in a
    windowed scrolling container (only the rows in view are rendered); the dialog asks for at most 13 schedule
    windows. Focusing a menu selects its text so typing a room number replaces it.
  - **Confirmation:** step 2 states "New room plan effective 10/16/2026 through 10/20/2026:" and lists the plan
    with consecutive nights in one room grouped ("Room 107: 10/21/2026 to 10/22/2026 (1 night) (changed)"), how
    many nights change room, that the reservation stays checked in and that the nights already stayed keep their
    room and price. Back, Cancel, Escape and the backdrop change nothing; the primary action "Update Reservation"
    (27.9.1.3) has focus and works once.
  - **Rate question (D-015, D-086, D-088):** when the setting `askRateOnRoomChange` is on and a changed night's
    nightly rate differs, radios ask "Retain the current rate ($349.00 per night)" or "Update to the new rooms'
    rates ($199.00 per night, -$150.00 for 1 night)" (Retain preselected). Equal rates, or the setting off: no
    question and the new rates apply to the changed, not-yet-stayed nights. Nights that keep their room keep
    their price.
  - **Rate rules (pure):** `src/lib/roomChangeRates.ts` (per-night outcome in integer cents excluding taxes: nights
    before today never repriced; only changed nights repriced; retain or update; weighted average untouched) and
    `src/lib/stayPlan.ts` (plan normalization into runs, plan validation, changed nights); shared with the mock.
  - **Segments (D-084):** the stay becomes one block per run of consecutive nights in one room, same
    reservation id and confirmation number, linked by `roomChange {part, index, count, stayId}`. Runs in the same
    room are always one block: a stayed night in the same room as the first remaining night belongs to the
    current, checked-in block, so `previous` (checked-out) blocks exist only where the room really differs, and
    **a stay that ends up as one block carries no link at all** (it is unsplit again, also after reverting every
    night, and can be dragged like any stay). The block with the first remaining night keeps the
    reservation-room id (`current`), later runs are `next`. The grid shows "GR-50271 · 3/5 ← 301 → 301" and the aria label ends
    "part 3 of 5, moved from Room 301, continues in Room 107" (a neighbour in the same room is not mentioned).
    Early Check In stays on the first part, Late Check Out on the last.
  - **Dragging (D-089):** no block of a stay that has several blocks can be dragged (reason in the refusal
    message, and the server answers 409 `not-movable`); a single-block stay, including one that was split and
    merged back, can; Q-20-5 stays open for single-block stays.
  - **Multi-room reservations:** a click on any block of a split room opens that room (the details are selected
    by the reservation-room id, which every block of the stay carries as `stayId`); after the reload the same room
    stays selected and the order of the rooms does not change.
  - **Drift (D-091):** the server owns the effective date (the club's today). When what the user saw drifted
    (409 `stale`, a different effective date, 400 about the nights or the rate choice) the page reverts the
    optimistic change, reloads, adopts the server's today and reopens the dialog on step 1 with the choices that
    are still valid and "The schedule changed while you were editing. Review the plan."
  - **Readability (D-092):** the reason a Change Room action is unavailable is visible text under the button
    (not only a tooltip); disabled room options keep their reason at normal secondary contrast; blocks have a
    lazily created tooltip with the full text (guest, confirmation number, part n of m, room and neighbours)
    on hover (only when cut off) or keyboard-driven grid focus (an arrow key or keyboard focus; a mouse press,
    a drag or closing the panel clears it), the aria-label unchanged. Toasts are green only for success: an
    unknown outcome or "review the plan" is a warning (orange) and a failure is an error (red), from the theme.
    The success toast is accurate for what moved ("Moved to Room 107", "Moved to Room 107 for the night of
    10/19", "Room plan updated: 2 nights changed"). The drag confirmation of a checked-in single-block stay says
    the whole stay moves, including the nights already stayed, and points to Change Room During Stay (D-050,
    Q-20-5; the move itself is unchanged).
  - **Optimistic update and refresh:** the grid shows the plan at once (`applyRoomPlan`), then confirms or rolls
    back like a drag (409/404/400 revert; no response, 408, 5xx or an unusable 2xx reload with a neutral
    message). After success the schedule is refetched, the open details reload in place and a toast says "Moved to
    Room 107" (or "Rooms updated for the remaining nights" when several rooms are involved). The details panel
    lists "Earlier in this stay" and "Later in this stay" and shows the departure of the whole stay. The hub does
    not exist yet (D-083), so only the schedule and the panel refresh.
  - Code: `src/app/changeRoom.ts` (availability, per-night eligibility, filter, plan summary, request, optimistic
    update, failures), `src/lib/stayPlan.ts`, `src/lib/roomChangeRates.ts`,
    `src/components/reservation/ChangeRoomDialog.tsx`, `useChangeRoomData.ts`, API
    `reservations.changeRoomDuringStay` and `settings.getRoomChangeRule` (`src/api/*`), optional
    `ScheduleBlock.roomChange`, `ScheduleRoom.housekeeping`, `ReservationRoomDetail.previousStays` /
    `upcomingStays` and the required `ReservationStayLine.reservationRoomId`, `segmentLinks` in `src/app/scheduleGrid.ts`.
- **Deviations from Figma:** Figma draws the feature as a switch inside the room editor (the Edit panel of the
  Reservation Hub, not built; Q-20-7); the build keeps the per-night lines and the Select look but opens them in a
  dialog from a "Change Room" button. Extras Figma does not show: the optional Location and Room Type filter
  (from 27.9.1.2.3.1), the confirmation step with the room plan, the rate question and the "Update Reservation"
  CTA (from 27.9.1.3). The menus are searchable listboxes grouped "location | room type" (Figma's menu groups by
  room type only, Q-20-13). See [figma-deviations.md](../figma-deviations.md).
- **Assumptions and defaults chosen:** D-083 to D-092; setting off applies the new rates silently (Q-20-2); the room
  the guest sleeps in tonight becomes `dirty` when it changes (Q-20-1); stayed means before today (Q-20-8);
  dragging an unsplit checked-in block still moves the whole stay (D-050, Q-20-5).
- **Stubs and placeholders:** the setting `askRateOnRoomChange` (default on) and `ScheduleRoom.housekeeping` are
  placeholders; the housekeeping state is not shown anywhere yet (Housekeeping report 6.4, "H" blocks); nightly
  rates are the placeholder room type rates ([placeholders.md](../placeholders.md)).
- **Known limits:** when the focused row of the windowed night list (stays of more than 60 remaining nights) is
  scrolled out and unmounts, focus falls back to the dialog container; the part label of an optimistic block
  ("part n of m") can differ from the committed one when an earlier part lies outside the loaded date range (the
  server's answer replaces it); a stayed block that ends where the visible range starts is not drawn (at start = today a
  stayed part has no column; the panel lists it under "Earlier in this stay"); the windowed list of a very long
  stay is reached by scrolling (Tab does not visit rows that are not rendered).
- **Performance (200 rooms, a 365-night stay, Chrome, mock latency excluded):** opening the dialog costs about
  100 ms of work after the data arrives (the 13 windows load in parallel); opening a night's menu with 200
  rooms about 100 ms; typing a character in a menu 6 to 56 ms; 8 night rows are rendered instead of 364.
- **Not built (follow-up candidates from requirements 15 to 20 and 27, not covered by Figma or the ticket):**
  Edit panel with Check-in Date, Check out Date, Location, Room Type, Room and the unified Update Reservation
  (27.9.1, 27.9.2 multi-room dates with unassigned rooms, 27.9.3); rate detail with lock / override PIN
  (27.3.4.3, 27.3.4.4) and location / room type permission on drag (15.11.7.1); housekeeping event states and the
  "H" blocks (15.13); past opacity of finished events (15.4.5, 15.11.5); Undo Check In until the night audit
  (20.5.4); change log entry for a room change (27.11); linked room treatment (15.11.3.5); unassigned section of
  the schedule (15.9.4).
- **API:** `POST /reservation-rooms/{id}/change-room`, `GET /settings/room-change-rule`
  ([api-contract.md](../api-contract.md)).
- **Permissions:** `reservation.edit` (no new permission). Not exercised in the browser: no mock user lacks it, so
  the read-only state is covered by tests only.
- **Open questions:** Q-20-1, Q-20-2 (built defaults), Q-20-3 (answered: per night), Q-20-4, Q-20-5, Q-20-6 to Q-20-13
  (gaps and conflicts between the requirements, Figma and the ticket), Q-20-14 (which clock decides today), Q-20-15 (segments in reporting).
- **Status:** in review (branch complete; PR link to be added when it is opened), 2026-10-20.

## 2.4 Schedule blocks and linked room blocks

Ticket Excia/Guestrooms-Demo#21. Figma: Schedule Blocks 15963:188278; Linked Room Block 12455:90329;
Schedule Block Exploration 12843:35986; States and Variations 12423:59315.

- **Requirements:** `<ScheduleBlock>` renders not yet checked in, checked in, checked out, canceled,
  unassigned, closure, linked states; treatment icon and name color per ticket 3.11. Linked room
  block tiers by size: link icon only (30-day view, single night); icon plus linked room number (14-day
  view, single night, may wrap to two lines); reserver name on the second line when the icon and room
  number fit on one line. Linked rooms also show early/late indicators from the room they are linked
  to. Tooltip on hover/focus: "Linked to [Room Number]" then "Reserver First Last". Early/late
  indicators: Not Yet Checked In shows only early check in; Checked In and Checked Out show only late
  check out, even if both are selected. Truncation with an ellipsis and the full text in the tooltip.
  Owner icon: the svgrepo hand/key icon (D-018).
- **Implemented:** a base block renderer exists from 2.1 (`ScheduleItemView`: confirmed/NYCI,
  checked-in, checked-out, due-out, closure, guest type colors); minimal early/late edge markers in
  PR #119. Canceled, unassigned and linked states, the owner icon and the tooltips are not built.
- **Open questions:** Q-21-1.
- **Status:** not started (partial groundwork in 2.1 and 2.2).

## 2.5 Reservation menus and multi-room selector

Ticket Excia/Guestrooms-Demo#22. Figma: Reservation Menus 17239:17738; Hub-MultiRoomSelector
1463:22758; Hub States Multi 2626:23175.

- **Requirements:** menu items per state: Not yet checked in: Edit Reservation, Cancel Reservation,
  Add Another Room, Print Registration Card(s); Checked in: Undo Check In, Edit Reservation, Add
  Another Room, Print Registration Card(s); Unassigned: Edit Reservation / Assign Room, Cancel
  Reservation, Add Another Room, Print Registration Card(s). Print Registration Card opens a PDF in a
  new tab (stub URL until the API exists, D-003). Undo Check In is hidden after the night audit has
  run for that business date ("Remove after NA run"). Multi-room reservations show a room selector at
  the top of the hub listing all rooms with status; the selected room is visually distinct. Cancel
  Reservation asks for confirmation. Online cancellation window uses the "Cancellation Period" rule;
  fee amounts out of scope (D-007).
- **Implemented:** nothing (PR #119 adds `splitCta()` for the panel's primary/secondary actions only).
- **Open questions:** Q-22-1, Q-22-2.
- **Status:** not started.
