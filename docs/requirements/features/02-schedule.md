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
- **Implemented (branch, in review once the PR is open):**
  - **Entry point (D-076):** a "Change Room" text button under the room card (single room) or the room
    selector (multi-room) in the reservation details panel (`ReservationDetails.tsx`). It is shown for
    every room but is `aria-disabled` with the reason as its description (and a tooltip) unless the room is
    checked in, the user holds `reservation.edit`, a room is assigned, at least one night is left (the stay
    does not end today) and no room change is being saved. Clicking it while unavailable shows the reason in
    the panel's notice. The other stubs ("Edit Room", the pencil, Undo Check In) are unchanged.
  - **Room menu:** `ChangeRoomDialog` step 1, a searchable listbox (MUI Autocomplete) grouped
    "location | room type" like the New Reservation Room field. Every room is listed; rooms that cannot take
    the remaining nights are disabled (`aria-disabled`, reason as text and `aria-describedby`): "Same room",
    "Closed 10/17-10/20", "Booked 10/16-10/19", "Checked-out stay 10/16-10/19" and "Locked to its room type".
    Nights are half-open, so a stay that arrives on the departure day is a same-day turnover and does not
    block. The rooms, bookings and closures come from the API for the remaining nights (several 30-day
    `schedule.get` windows when the stay is long), not from the schedule page's own window.
  - **Confirmation:** step 2 states "Move from Room 201 to Room 205 effective 10/16/2026 through
    10/18/2026." (D-078), that the reservation stays checked in and that the nights already stayed keep their
    room and price. Back, Cancel, Escape and the backdrop change nothing; the primary action "Move to New
    Room" has focus and works once.
  - **Rate question (D-015, D-079, D-081):** when the setting `askRateOnRoomChange` is on and the new room's
    nightly rate differs for a remaining night, radios ask "Retain the current rate ($249.00 per night)" or
    "Update to the new room's rate ($199.00 per night, -$100.00 for 2 nights)" (default Retain). Same rates,
    or the setting off: no question and the new rates apply to the nights not yet stayed.
  - **Rate rules (pure, `src/lib/roomChangeRates.ts`, shared with the mock):** nights before today are
    stayed and never repriced; tonight is the current night and is repriced; integer cents, excluding taxes
    and service charges; the weighted average rate is not touched.
  - **Segments (D-077):** the stay becomes several blocks with the same reservation id and confirmation
    number: a `previous` block (checked out, not movable) holds the nights already stayed in the old room and
    the `current` block, which keeps the reservation-room id, holds the rest in the new room. The grid
    shows "GR-50240 → 205" and "GR-50240 ← 201" and the labels read "moved to Room 205" / "moved from Room
    201". Early Check In stays on the first segment and Late Check Out on the current one.
  - **Optimistic update and refresh:** the grid shows the change at once (`applyRoomChange`), then confirms or
    rolls back like a drag (409/404/400 revert; no response, 408, 5xx or an unusable 2xx reload with a neutral
    message). After success the schedule is refetched, the open details reload in place and a toast says
    "Moved to Room 205". The hub does not exist yet (D-076), so only the schedule and the panel refresh.
  - Code: `src/app/changeRoom.ts` (availability, eligibility, windows, copy, request, optimistic update,
    failures), `src/lib/roomChangeRates.ts`, `src/components/reservation/ChangeRoomDialog.tsx`,
    `useChangeRoomData.ts`, API `reservations.changeRoomDuringStay` and `settings.getRoomChangeRule`
    (`src/api/*`), optional `ScheduleBlock.roomChange`, `ScheduleRoom.housekeeping`,
    `ReservationRoomDetail.previousStays` and `ReservationStayLine.reservationRoomId`.
- **Deviations from Figma:** the Figma frame is the "Change Room During Stay" switch inside the room editor
  with one room Select per remaining night and locked "Night n | Room" lines (shield icon) for stayed nights;
  there is no frame for a menu item, the confirmation dialog or the rate question. The build keeps the
  locked night lines and the room menu look (room type groups, `[Room #]` items) but asks for **one** room
  for all remaining nights and confirms in a second step (the ticket's confirmation). Per-night rooms are
  Q-20-3. The rate question copy is the agent's (Q-20-4). See [figma-deviations.md](../figma-deviations.md).
- **Assumptions and defaults chosen:** D-076 to D-081; setting off applies the new rates silently (Q-20-2);
  the vacated room is marked `dirty` (Q-20-1); dragging a checked-in block to another room still moves the
  whole stay (D-050) and was not changed (Q-20-5).
- **Stubs and placeholders:** the setting `askRateOnRoomChange` (default on) and `ScheduleRoom.housekeeping`
  are placeholders; the housekeeping state is not shown anywhere yet (Housekeeping report 6.4, "H" blocks);
  nightly rates are the placeholder room type rates ([placeholders.md](../placeholders.md)).
- **API:** `POST /reservation-rooms/{id}/change-room`, `GET /settings/room-change-rule`
  ([api-contract.md](../api-contract.md)).
- **Permissions:** `reservation.edit` (no new permission). Not exercised in the browser: no mock user lacks it,
  so the read-only state is covered by tests only.
- **Open questions:** Q-20-1, Q-20-2 (built defaults), Q-20-3 to Q-20-5 (new).
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
