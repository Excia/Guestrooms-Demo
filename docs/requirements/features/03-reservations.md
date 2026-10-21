# Epic 3: Reservations

Epic issue: Excia/Guestrooms-Demo#23. Figma pages: Reservation List, Reservation Hub, Contact Details
Modal, Owner/Member/Guest Treatment, Early Check In / Late Check Out. Back to the
[index](../README.md). Entry fields are described in [00-foundation.md](00-foundation.md).

**Current code for the whole epic:** the route `/reservations` exists in `src/app/routes.ts` and
shows a placeholder page. `api.reservations.list` and `get` exist (`Reservation` has id,
confirmationNumber, guestName, roomType, roomNumber, arrival, departure, adults, children, status,
rateCategoryId, hasUnassignedCharges) with six placeholder rows; the Hub route
`/reservations/:id` does not exist. The reservation details panel of ticket 2.2 (PR
Excia/Guestrooms-Demo#119) is the only reservation UI. Every ticket below is **not started** unless
stated. Shared decisions: D-008 (check in needs a payment method), D-013, D-014.

## 3.1 Reservation List with bulk actions

Excia/Guestrooms-Demo#24. Figma: Bulk Action P1 2524:23962, P2 2524:31991, P2 after attempt 2524:36149.

- **Requirements:** filters Check in From / To, Unassigned Only toggle, Location select; buttons Night
  Audit and New Reservation; list/calendar toggle (calendar is the Schedule). Columns: select
  checkbox, Check In, Check Out, Res #, Guest, Reserver, Block, Location, Room Type, Room, Status, a
  search button; sort icons (filter icons were dropped by the newest frame). Canceled rows italic with bold "Canceled"; Unassigned room in
  error red; multi-room shows "[####] +1" in Room. Multi-room status is the lowest common denominator
  of its rooms (a partially checked-in reservation shows "Checked In").
  Server-side sort, filter and pagination; filters reflected in the URL; row click opens the Hub
  (3.3), checkbox click only selects; select-all selects only selectable rows; empty, loading and
  error states. **Defaults:** date range today through the next 7 days, sorted by check-in ascending
  (D-013).
- **Status:** built on branch `feat/24-reservation-list` (PR pending). Page `src/pages/ReservationList.tsx`
  at `/reservations` (menu entry and `page.reservations` permission already existed); rules in
  `src/app/reservationList.ts` and `reservationListUrl.ts`; API `reservationList.list` / `getOptions`
  (see [api-contract.md](../api-contract.md)).
- **Built:** all Figma columns with server-side sort (first click ascending, second descending), filter and
  page-number pagination; filters, sort and page live in the URL (`from`, `to`, `unassigned`, `locations`,
  `types`, `status`, `guest`, `reserver`, `resNumber`, `block`, `room`, `q`, `sort`, `page`, `rows`; defaults
  are omitted, an empty `from=`/`to=` means no bound). Row click and the Res # link open `/reservations/:id`
  (a placeholder page until 3.3); the checkbox selects without navigating. Select-all selects only
  selectable rows; the header checkbox is indeterminate for a partial selection. Selection belongs to the
  query it was made in (a new page, sort or filter clears it). The page exposes the selected rows through
  `onSelectionChange` and a `renderBulkActions` slot for 3.2, which owns the CTA and the dialogs. New
  Reservation opens `/schedule?panel=new` (the panel lives on the schedule); Night Audit goes to Night Audit
  History like the schedule's button; the list/calendar toggle links to the schedule.
- **Newest Figma frame (2524:36149), followed on request:** Night Audit is a filled `info` large button
  with the shield icon and New Reservation a filled `primary` large button with the plus icon, both 200px
  (`spacing(25)`) with a 16px gap. The header has no column filter icons (Q-24-1): only sort, with the arrow
  on the sorted column. The URL filters (`guest`, `status`, `types`, ...) still narrow the query but no
  longer have a header control. `ReservationList` takes `failedIds`: those rows get the `warning.background`
  tint (new theme token, Figma warning/background #f9ede5) and a hidden "could not be checked in" cue;
  3.2 passes the ids, and the tint clears on refresh because the ids live in the caller's state.
- **Selectable rule (assumption, final intent of Figma P2):** a row is selectable when at least one of its
  rooms is not yet checked in. Single rooms checked in, checked out or canceled are not; unassigned rooms and
  rooms without a payment method are (3.2 reports them when the check-in is attempted). P1's stricter rule
  is not built (Q-25-1).
- **Multi-room status (assumption, Q-24-2):** canceled rooms are ignored unless every room is canceled; rooms
  that agree give that status; any other mix (partly checked in, or one out and one still to arrive) shows
  Checked In. Only the "partially checked in shows Checked In" part is in Figma.
- **Room column:** the first room's number (or "Unassigned" in the error color) plus "+N" for further rooms.
- **From the requirements document (behavior Figma does not contradict):** the search icon opens a pop-up
  (MUI Popover under the button) with the field, so the table never resizes; Escape closes it and returns
  focus to the icon, the X clears the query, and a dot on the icon shows an active search (doc 16.8 says
  the icon expands in place: changed on request); the Location select is single-select with "All Locations" and is
  hidden, with the Location column, when the property has one location (16.7, 16.10.7); Unassigned Only keeps
  its state in the URL (the doc resets it on refresh, the ticket asks for URL state: ticket wins).
- **Conflicts with the requirements document (Figma and ticket win):** default range is 2 weeks in the doc
  (16.3.3) but 7 days in D-013; status values are Booked (Admin), Booked (Online), Checked In, Checked Out,
  Canceled in the doc but Not Checked In, Checked In, Checked Out, Canceled in Figma; a row click opens the
  Reservation Details Panel in the doc but the Reservation Hub in the ticket.
- **Not built:** Print (doc 16.9, "exact functionality TBD"); the "Check In N Rooms" CTA and dialogs (3.2);
  the Reservation Hub (3.3). The mock's list-only reservations (canceled, unassigned) are not on the schedule
  and have no details (placeholders.md).
- **Open questions:** Q-24-1 (resolved: column filters dropped per Figma 2524:36149), Q-24-2.

## 3.2 Bulk check-in: success dialog and mixed-result dialog

Excia/Guestrooms-Demo#25. Figma: P1, P2, P2 after attempt, Check In Mixed Result 2524:35269.

- **Requirements:** never selectable: single rooms already checked in, checked out or canceled. **P1**
  (before the success dialog existed): unassigned or no-payment-method single rooms also not
  selectable; a multi-room reservation is selectable only when all rooms are not checked in, all
  assigned and payment is on file. **P2** (final intent): unassigned rooms and rooms without payment
  **are** selectable but trigger an error dialog and are not checked in; a partially checked-in
  multi-room reservation is selectable (unassigned rooms on it fail). CTA "CHECK IN N ROOMS" counts
  rooms (a single plus a two-room reservation is 3), hidden or disabled with zero selection. After an
  attempt: failed rows highlighted orange; successful rows can no longer be selected; CTA count
  updates; highlights clear on refresh. Per-room check-in calls; partial success handled; the dialog
  lists successes and failures with the reason (Unassigned, no payment method). Selection logic is a
  pure function with a test per row type. Consistency with D-008.
- **Open questions:** Q-25-1, Q-25-2.

## 3.3 Reservation Hub layout

Excia/Guestrooms-Demo#26. Figma: Hub page 755:16072, Header 2626:21430, Left Column 12369:32091,
Guest Column 772:18645, NotesColumn 779:5196, ResHubGuestDetails 12965:38930, CTA 12369:31016.

- **Requirements:** route `/reservations/:id`; breadcrumb "Guest Rooms > Reservations > Reservation
  Hub" (the owner dropped breadcrumbs from the header, D-020: confirm for this page); title
  "RESERVATION #XXX" with a status chip (Checked In, Checked Out, Canceled). Left column: rooms
  count, nights, Check In/Out dates, Early/Late checkboxes (3.12), split CTA (Check In / Check Out),
  **Stay Summary** (Folio Total, per-night lines with an edit pencil for rate adjust 3.8, Additional
  Charges, Taxes, Service Charges/Fees, Payment and Folio buttons). Main: room card (number, location,
  room type), **Guests** column (adult/child counts, guest cards with a send icon), **Notes** (Public
  visible to everyone, Private visible to Admin only), **Add-Ons** (3.10). **Lead Occupant** cannot be
  changed after the reservation is created; it can be switched to Reserver and back to Occupant but
  not removed; once a Reserver is set and saved they cannot go back to Lead Occupant (but can be
  additionally selected in the Lead Occupant field). Public notes editable by anyone; private notes
  visible and editable only to admins; totals computed from line items; loading and error states;
  unsaved notes prompt Confirm Leaving.
- **Open questions:** Q-26-1.

## 3.4 Hub states: single room and multi room

Excia/Guestrooms-Demo#27. Figma: Hub States Single 2623:15341, Multi 2626:23175.

- **Requirements:** one state machine drives the header chip, CTAs, enabled fields and menu items
  (unit tested per state: not yet checked in, checked in, checked out, canceled, unassigned).
  Unassigned: room card shows "Unassigned" with an **Assign Room** button; check in is blocked with an
  inline error "A room must be assigned prior to check in" in the edit dialog; Assign Room opens the
  edit-reservation dialog (Save Room Selection and Save Reservation). Multi-room: the room selector
  switches rooms; the Reserver/Lead Occupant input is disabled if at least one room is checked in;
  actions apply per room unless stated. Checked in shows **Manage Keycards (N)** and the CTA becomes
  Check Out. Undo Check In is removed after the night audit run. Print Registration Card opens a PDF in
  a new tab. Canceled and checked-out reservations are read-only (controls dimmed).
- **Open questions:** Q-27-1, Q-27-2.

## 3.5 Check in (including after the arrival date, failure dialogs)

Excia/Guestrooms-Demo#28. Figma: NEW FLOW check in after date 11653:10365; Check In Failure Dialogs
13533:72812; Dates Indicator 12369:30509.

- **Requirements:** the hub Check In validates: room assigned, room free of a current occupant,
  payment on file where required, arrival date rules. The failure dialog lists each failed room with a
  reason (**Unassigned**, or **a reservation is still checked in to the assigned room**); the success
  dialog confirms; mixed results show both. After success the hub, schedule block and list update
  without a manual refresh. **Decision D-008:** with no payment method, open the Payment Methods
  dialog (3.9), add one, then continue check in. "Check in after date" follows the new-flow frame,
  which has no annotations.
- **Open questions:** Q-28-1.

## 3.6 Keycards

Excia/Guestrooms-Demo#29. Figma: Encode in progress 2747:12783, done 2748:12953, error/timeout
2751:13534; Manage with 0 active 2751:13386, 1 active 2747:12703, 3 active 2751:13313. "ARCHIVE Encode
Keycard Window" is superseded.

- **Requirements:** the Manage Keycards dialog renders 0, 1 and N active keys with encode and
  deactivate actions; the Encode flow shows in progress (cancelable), done, and error/timeout with
  retry; the encoder integration sits behind an interface with a mock; the count in the hub header
  (**Manage Keycards (N)**, only on a checked-in reservation) updates after encode or deactivate.
  Admin Setup ticket 7.6 supplies encoder keys (Visionline).
- **Open questions:** Q-29-1.

## 3.7 Update contact info dialog and guest edit state

Excia/Guestrooms-Demo#30. Figma: Non-member 15843:46404, Member 15847:47967, with 1 additional email
15847:48090, with 2 additional emails 15847:48299, non-member editing name 15843:47314, Hub guest edit
state 15843:46468, component 15272:32340.

- **Requirements:** one `<ContactInfoDialog>` with a `guestType` prop; opened from the hub guest card;
  the modal changes the **reservation only**; Close returns with no change. **Member:** name with
  member number and no edit icon; email and phone default to the member's and are changeable for this
  reservation only; info indicator that updates apply only to this reservation. **Non-member:**
  person-search icon, static name with a non-member indicator and an edit icon; editing the name
  updates the non-member record **and** the reservation; email and phone are for this reservation only
  (the record's email and phone cannot be edited in Guest Rooms). **Additional Reservation Email:** up
  to 3 emails per guest (primary plus two); the add button moves down and disappears after the second;
  a red remove circle deletes a field; no duplicates, valid format; all notifications go to every
  email. Save validates with inline errors; helper text marks record vs reservation-only fields;
  labelled, focus trapped, Escape closes.
- **Open questions:** Q-30-1.

## 3.8 Adjust rate dialog (hub only)

Excia/Guestrooms-Demo#31. Figma: Adjust Rate Dialog Overlay 15838:44704; instance 15830:40380.

- **Requirements:** **Adjustment** and **Adjusted Rate** update each other live (base rate 250:
  adjustment -25 gives 225; adjusted rate 200 gives adjustment -50), rounded to 2 decimals, no
  feedback loop; a $/% toggle converts the entered value using the current base rate (-25 dollars
  becomes a 10% discount in the example); negative and positive adjustments allowed, adjusted rate
  cannot go below 0; Save updates the nightly line in the Stay Summary, Cancel discards; unit tests
  with the examples. **D-014:** applies to the specific charge or night line selected.
- **Open questions:** Q-31-1.

## 3.9 Payment methods dialog (quick split), penny auth

Excia/Guestrooms-Demo#32. Figma: Payment Methods Dialog 17700:79972, Penny Auth Processing
17700:80177, Penny Auth Declined 17700:80643.

- **Requirements:** dialog height is viewport-based so **Settle** and **Cancel** are always visible,
  with the split value boxes scrolling inside; one split section per payment method with dynamic
  height; split amounts must sum to the amount due before Settle is enabled; penny auth processing
  state (progress, controls disabled) and declined state (error, retry or choose another method);
  **no option to send the quick split to MPOS** (to settle to another method use manual Add Deposit /
  Payment, 4.11). Shares one dialog component with Quick Split (4.12). **D-002:** mock payments
  interface with hosted-field placeholders. **D-008:** opened by hub check in when no method is on
  file.
- **Open questions:** Q-32-1.

## 3.10 Add-on items on reservation

Excia/Guestrooms-Demo#33. Figma: Add-On Items states 2603:6475; component 798:5749. Add-ons are
defined in ticket 7.4.

- **Requirements:** add-ons from Admin Setup appear in a dropdown and can be added any time before
  check out with no limit on the number; **Add Add-On** CTA below existing add-ons; static row shows
  quantity, name and fee, with edit pencil and trash on hover (keyboard equivalents); initial
  selection: dropdown (placeholder "Select an Add-On") and a quantity selector with max **99**; the
  check circle validates and switches to the static row. Dropdown items show name and single-item
  price ($0.00 if free); an add-on whose remaining nightly quantity is 0 for all nights is disabled.
  With **tracking enabled**, quantity has tabs **All nights** (default; max = the lowest remaining
  nightly quantity, e.g. night 1 has 2 rollaways and night 2 has 1, so max is 1; disabled with an
  "unavailable" indicator at 0) and **Select nights** (per-night quantity, remaining/available shown,
  max = that night's remaining). Add-ons editable until check out, locked after. Fees go to the folio;
  the hub folio total updates.
- **Open questions:** Q-33-1.

## 3.11 Owner / Member / Guest treatment

Excia/Guestrooms-Demo#34. Figma: Reservation Treatments 12965:40501, Owner System Setting
12965:30984, Room Setup 12965:30986.

- **Requirements:** `<GuestTreatment type="guest|member|owner">`. **Guest:** person-search icon, name
  in `Text/Primary` (#000000 at 87%), reserver/lead guest name followed by "Guest". **Owner:** hand/key
  icon (svgrepo, D-018), name in `Info/Dark` `#054687`, followed by "Owner". **Member:** badge icon,
  name in `Primary/Dark` `#1B5E20`; the details panel shows the member number after the name. Icon
  before the occupant name. Used in schedule blocks (2.4), details panel (2.2) and hub (3.3). **Owner
  system setting:** when enabled, a **Room Owner** member lookup (autocomplete) appears in Room Setup
  (7.3) and owner indicators appear on Schedule blocks, the details panel and the Hub; the field is
  always enabled and **not inherited from Room Type**; a member owning several rooms (including linked
  rooms) is set on each. Owner treatment shows only when the setting is on and the reserver is the
  room's owner. Colors as theme tokens; AA contrast checked. Future (not in scope): member and owner
  names open the Member Directory in a modal.
- **Existing groundwork:** `palette.schedule.ownerText` `#043f7a` and `memberText` `#16491a` in
  `src/theme.ts` (these differ from the ticket's `#054687` and `#1B5E20`; reconcile when building,
  Q-34-2). `ScheduleGuestType` has guest, member, owner, none.
- **Open questions:** Q-34-1, Q-34-2.

## 3.12 Early check-in and late check-out

Excia/Guestrooms-Demo#35. Figma: Late Checkout System Setting 12369:20668, Hub Left Columns
12369:34431, States and Variations 12423:59315, Reservation Details Panel 12423:60028.

- **Requirements:** system setting switch. Off: no extra field, no checkboxes, no schedule indicators.
  On: a **Late Checkout Time** field appears (picker allows values from the standard checkout time to
  the standard check-in time); Check In, Check Out and Late Checkout pickers use 5-minute increments.
  Validation: Late Checkout time rules per the (ambiguous) annotation; **Closed Settled Folios** hours
  must be later than the MPOS "Folio is no longer visible" value and also validated against the late
  checkout difference; inline errors. **Hub checkboxes:** all rooms NYCI: both enabled; once any room
  is checked in: Early disabled, Late enabled; checked in past standard checkout time: both disabled;
  checked out: both disabled (pure function, one test per state). Early selected: indicator on blocks
  of reservations not yet checked in. Late selected: indicator on checked-in or checked-out blocks; at
  the system checkout time the flag is checked and the reservation **stays checked in** (not auto
  checked out); the admin may check out manually before the late checkout time, and at the Late
  Checkout Time the reservation is **auto checked out** (documented API contract plus a mock).
  Schedule: Not Yet Checked In shows only early; Checked In and Checked Out show only late, even when
  both are selected. The details panel checkboxes auto-save.
- **Existing groundwork:** the details panel checkboxes and the `POST /reservations/:id/early-late`
  contract are in PR Excia/Guestrooms-Demo#119 (D-058); the system setting, hub checkboxes, validation
  and the auto-checkout job are not built. Annotations reference another Figma file key; ignore (D-012).
- **Open questions:** Q-35-1, Q-35-2 (build the setting once with ticket 7.1).

## 3.13 Manual send (email to guest) and "no mail" state

Excia/Guestrooms-Demo#36. Figma: ManualSend 773:4530, no mail 818:21434, Send Menu 16059:192024, Guest
card 12965:39122.

- **Requirements:** the send icon opens a menu with **Send Confirmation Email** (follows the
  confirmation trigger) and **Send Guest Card** (follows the guest card trigger); the matching
  notification is sent according to its trigger and user type if an email is provided; a guest with
  no email shows the "no mail" state with the send actions disabled and an explanatory tooltip; success
  toast, error toast with retry; honors up to three emails per guest (3.7).
- **Open questions:** Q-36-1.
