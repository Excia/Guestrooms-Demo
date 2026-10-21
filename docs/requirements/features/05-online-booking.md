# Epic 5: Online Booking

Epic issue: Excia/Guestrooms-Demo#47. Figma page: Online Booking (overall flow board referenced by the
annotations: "Guest Rooms Supplements" FigJam, board key `j7WpbvAFvPDYc5H1uKSwNh`). Back to the
[index](../README.md). Entry fields are described in [00-foundation.md](00-foundation.md).

Member and non-member online booking is **embedded in the club's Axis site** (the booking widget) with
results in a new Guest Rooms window or tab (D-011). It is enabled and constrained by Booking Rules
(ticket 7.5). Online booking has real mobile designs (D-010). Shared decisions: D-002 (mock payments,
hosted fields), D-003, D-006, D-007. All tickets are **not started**; no online booking route or API
exists yet. Permissions here are audience based (signed out, non-member, member), not staff
permissions.

## 5.1 Online booking header, account menu, return to site tooltip

Excia/Guestrooms-Demo#48. Figma: Online Booking Navigation 13189:62842, GR Online Booking Header
12213:12296, Account Menu 12213:12011, Return to Site Tooltip 12562:29382, GR Menu 12136:20563.

- **Requirements:** system title (club favicon, club name, "Guest Rooms") links to the landing/results
  page. Menu: **Make a Reservation** (landing/results with default parameters) and **My Reservations**
  (always labeled so; if signed out, sign-in first, then land on My Reservations). Breadcrumbs: earlier
  ones clickable, current page name shown. **Sign In** (signed out) goes to the sign-in prompt; **Account**
  (signed in) opens the Account Menu: Account (non-members to their non-member Core account; members to
  the Axis member account), Payment Methods (non-members to Core; members to their Paycloud account), Sign
  out (back to the unauthenticated results view). Everyone must sign in before completing a reservation.
  **Return to Site** goes to the main club site, tooltip "Return to [Club Name] main site." Mobile:
  truncated header with Menu, favicon, current page, Account/Sign In icon and Return to Site icon.
  Embedded in the mobile app: the app's navigation replaces the Guest Rooms mobile navigation (flag or
  query parameter). Club name, favicon and Axis URLs come from tenant config.
- **Built (PR for #48):** `OnlineBookingHeader` (`src/components/onlineBooking/`) with the pure rules in
  `src/app/onlineBookingNav.ts`. Tenant values (club name, favicon, Axis, Core, Paycloud URLs) are a
  `BookingTenant` prop until tenant config exists. Embedded mode is the query parameter `embedded=1`
  (also `true` or `app`) and hides the header entirely; the name is a placeholder pending Q-48-2. Account
  and Payment Methods URLs are props pending Q-48-1. Below `md` the header shows the favicon, the current
  page and icon-only Sign In/Account and Return to Site. Not wired into a route yet (the online booking
  routes arrive with 5.2 and later). Deviations: figma-deviations 51 to 53.
- **Open questions:** Q-48-1, Q-48-2.

## 5.2 Reservation widget and adjust search

Excia/Guestrooms-Demo#49. Figma: Reservation Widget 12136:20608, Adjust Search 12136:20582,
Update-search notice 12136:20607.

- **Requirements:** `<ReservationWidget>` is an embeddable component (a **web component**: script tag
  plus custom element, themed per club through CSS variables, D-011) and the results page shares the
  form. **Check In** and **Check Out**: typed or picked from a calendar; defaults today and Check In + 1
  day. **Location** single select: "Any" (default) or one location; hidden for a single-location club.
  **Guests:** adults and children steppers, default 1 adult and 0 children, maximum = the highest Max
  Occupancy of any room type or room; the "children" label is customizable per club. **Add Another
  Room** adds guest selectors for the same dates ("Room 1", "Room 2"), the CTA moves below, a Remove link
  deletes the latest; max rooms per booking comes from Booking Rules. **Search X Night Stay** updates
  with the night count and navigates to Results with criteria in the URL. The **global online booking
  message** (Admin Setup 7.9, 150 characters) shows with the fields. **Adjust Search** on Results carries
  the fields over; **Update Search** refreshes; a notice "You have changed search options, please click
  UPDATE SEARCH to refresh" shows after a change and clears after update. Unit tests for defaults, max
  guests, max rooms and the nights label.
- **Related built code:** the admin New Reservation search (ticket 1.4) is a different, staff-side
  form with different limits (D-042).

## 5.3 Results cards

Excia/Guestrooms-Demo#50. Figma: Desktop Member Multi Room 13074:17041, Non-Member Single Room
13074:17043, Results Card states 13076:25695, Results Card 12138:54077, Booking MultiRoomSelector
12141:16498, Room Selector 12179:18829, RoomDropdown 12179:18997, CTA BAR 12213:27136, Result Type
12539:22002, Additional States 13460:48588.

- **Requirements:** results list room types (most common) or specific rooms with availability for all
  nights that fit the guest count; signed-out users see non-member rates, rules and availability, and
  once signed in the user's own. **Results card:** image carousel (click for full screen; hidden if no
  images), name, location tag (hidden for one location), occupancy (always), bedrooms/beds/baths (each
  hidden when 0), description (required in setup when shown online; fades with **Expand Details**),
  features (hidden if none), summary bar with **average nightly rate** (Thu $100, Fri and Sat $150 gives
  $133.33) and **total** "plus taxes and fees"; expanded: all features and comma-separated Available
  Add-Ons; **Details** opens a full-screen scrollable overlay. **Select Room:** outlined becomes a filled
  "Selected" with a checkbox; selecting another deselects; no auto-advance; **Continue Booking**.
  **Multi-room:** pick a unique room type/room per room; room selector with prev/next arrows (disabled at
  the ends, labeled with the neighbor), a dropdown, "Select a Room Type" (gray) versus "[Room Type]
  Selected" (white, green outline), and a "1 / 2 Selected" counter (hidden for single room).
  **Availability updates between selections** (the first selection took the last King; choosing room 500
  linked to 510 removes 510). **CTA bar:** gray and disabled until a selection, green after at least one;
  with unselected rooms Continue goes to the next unselected room, when all are selected it goes to
  Details. **Hold:** a selection creates a hold; the timer starts at the first selection (not visible
  here) and resets to the full hold time when Continue is clicked with all rooms selected (via the API
  contract; hold errors handled). Edit flow: current selection summary with a release warning; waitlist
  hidden for now.
- **Open questions:** Q-50-1, Q-50-2.

## 5.4 Guest selection, name guests, secondary occupant

Excia/Guestrooms-Demo#51. Figma: details frames 13074:17041, Member Booking Guest Selection
12141:23647, Name Guests 12141:23995, Secondary Occupant 12166:15686, (M) Res Details Header 12136:20602.

- **Requirements:** party size starts from the search values and can change here. **Reserver:** the
  logged-in user is fixed in "Reserving Guest (Myself)" on every room. For someone else (or when the
  user is lead occupant on only some rooms) they tick "I'm reserving for someone else": the title
  becomes "Reserver (Myself)" and a **Lead Guest** field (required, standard error otherwise) appears in
  the collapsible **Name Guests** panel. Additional guests default to **TBD** and may stay TBD; the
  dropdown lists only guests the user has added (no buddy lists). **Notes:** one field saved to the
  public notes of the admin side, same max length. **Add-Ons:** as admin booking (3.10), only those
  marked "Display in Online Booking". **Multi-room:** the room selector works as on results; details
  for all rooms are required before payment; the CTA bar is gray until complete (Continue jumps to the
  next incomplete room), then green. The hold countdown is one value for all rooms (5.5). Mobile
  stacking per 5.8.
- **Open questions:** Q-51-1.

## 5.5 Stay summary, fee line items, review details

Excia/Guestrooms-Demo#52. Figma: Stay Summary 12186:10306, Fee Line Item 12187:11492, Review Details
12976:26121.

- **Requirements:** left column: reservation summary (rooms, room type or room, nights, check in/out)
  with a **Change** link back to results (selections persist), and the stay summary: per-room per-night
  lines, additional charges (add-ons), taxes, service charges and fees, an **estimated total** on top;
  lines update dynamically (more children, add-ons); a $0 line does not display; totals reconcile
  (pricing API, mock). **Hold countdown:** one value for all rooms, club-defined (Reservation Hold per
  audience, D-006), counts to 0:00, **turns red at 1:00 remaining**, at zero shows "Booking Time
  Expired" and prompts a return to refreshed results (hold released); it continues from details to
  payment. **Review Details** collapsible (collapsed by default), static; the vertical layout is also
  used on payment. Payment overview by payment model: payment on file, deposit, or pay in full
  (initially all clubs use payment on file, so $0 is charged at booking); shows **amount due today**
  and **estimated due at stay**, repeated in the CTA bar. After booking "Due Today" becomes **"Paid
  Today"** on confirmation and **"Paid at Booking"** on confirmation and the hub.

## 5.6 Payment: credit card fields, payment method menu, CTA bar

Excia/Guestrooms-Demo#53. Figma: Credit Card Fields 12539:24609, Payment Method Menu 12183:29047,
Payment CTAs 12187:10722, CTA BAR 12213:27136, Select 12213:14609, Desktop Non-Member Single Room
13074:17043.

- **Requirements:** saved methods as a list, the default (the Paycloud default) preselected, switch or
  **Add Method** (hosted card fields embedded in the screen, mock via the payments interface, D-002); a
  new method must be stored with Add Method before completing. Helper text states how the method is used
  (card on file, deposit, pay in full) with amount due today and due at stay. **Cancellation policy:**
  short agreement text and a link to the full policy (Admin Setup 7.9) with a required checkbox. **CTA
  bar:** gray until a payment method is selected and the agreement is checked (still clickable and shows
  errors on incomplete sections, checkbox in error state); green when both are done; **Complete
  Booking** processes and navigates to the confirmation (5.9); on failure shows an error and keeps the
  hold. Member payment-method changes go through Paycloud; payment on file charges $0 at booking. No
  card data touches our servers.
- **Open questions:** Q-53-1.

## 5.7 My Reservations and cancellation dialogs

Excia/Guestrooms-Demo#54. Figma: My Reservations 12136:20651, Cancellation Dialogs 13189:62342.

- **Requirements:** reached from the menu; tabs **Upcoming** and **Past**; none upcoming shows "You
  have no upcoming reservations." A new search can start here like the widget; on mobile a "Make a New
  Reservation" button replaces the widget. **Upcoming:** cards ascending (lazy loading allowed); click
  opens the reservation hub; title is the stay dates ("Month DD - DD, YYYY", "Month DD - Month DD,
  YYYY" across months, "Month DD, YYYY - Month DD, YYYY" across years; formatter unit tested); summary:
  confirmation number, rooms and nights; per room: primary image, room type/name, adults and children,
  add-ons; lead occupant name only when the signed-in user is the reserver but not lead occupant.
  **Edit** opens the full hub first; **Cancel** opens the confirm dialog based on club cancellation
  settings and timing. A reservation the user did not make shows but cannot be edited or canceled.
  **Past:** completed and canceled, most to least recent; canceled with a future date at the top; a
  Canceled indicator; room summaries at 70% opacity; **Details** opens the hub. **Cancellation
  dialogs:** confirm shows the reservation number and rooms, an optional club notice with a link to the
  full policy; Go Back / Cancel Reservation (returns to the canceled hub state); outside the online
  cancellation window ("Cancellation Period", D-007): "can no longer be canceled online", asking the
  user to call the club. Fee amounts out of scope.

## 5.8 Mobile layout with stepper

Excia/Guestrooms-Demo#55. Figma: Mobile Member Multi 13074:17044, Mobile Stepper 12880:33981, Results
Card mobile 12228:20141.

- **Requirements:** collapsible "Adjust Search" panel summarizing nights, dates, rooms, location
  (expanded: widget fields with Update, collapsing after update). **Stepper:** shows the active step
  label and icons only for other steps; the hold timer sits above it. **Results:** the room selector
  fixes to the top once scrolled to; the collapsed card shows carousel, location overlay, name,
  occupancy, bedrooms/beds/baths; Details opens a full-screen overlay (description, features, add-ons;
  square carousel; summary and Select; selecting returns to the list; X closes). A fixed bottom CTA bar
  with the counter and green/gray rules. **Details:** fields stack, the stay summary is below add-ons,
  Back returns to results keeping the selection. **Confirmation and hub:** each section shows Edit (no
  hover); the Edit/Cancel split button is fixed to the bottom; after check in no edit; after check out
  all static with the Checked Out indicator. Review Details sits below the policy. Verified on small
  viewports.

## 5.9 Booking confirmation and online reservation hub

Excia/Guestrooms-Demo#98 (added during refinement). Figma: confirmation and hub frames 13074:17041,
Additional States 13460:48588, Review Details 12976:26121.

- **Requirements:** **Confirmation:** short message at the top; "Make a Reservation" replaced by the
  reservation number; the Change link is gone; the stay summary shows "Paid Today"; the payment method
  cannot be changed online. **Hub:** as the confirmation without the message; **Back to My
  Reservations** returns to the matching tab; Guest, Notes and Add-On sections have a hover edit state
  (always visible Edit on mobile). **Edit Reservation** (split CTA): back to results with the current
  selection and a release warning; new rooms released/held on Continue; entered details populated;
  payment shows only the original method (locked); amount changes are handled at stay; the cancellation
  policy must be re-selected. **Cancel Reservation** from the split menu (5.7). **Checked In:** warning
  that it cannot be edited, indicator, no Edit/Cancel, no hover edit; for multi-room, any room checked in
  makes the whole reservation checked in. **Checked Out:** same plus a **View Folio** button that opens
  the folio PDF in a new tab (D-003) and a stay summary with totals, balance, and a link to the folio
  with its last update time (manual charge, settlement, night audit).
- **Open questions:** Q-98-1.

## 5.10 Sign-in prompt for guest and member

Excia/Guestrooms-Demo#99 (added during refinement). Figma: Desktop Non-Member Single Room 13074:17043;
mobile variant in 13074:17044.

- **Requirements:** members who arrive authenticated from the main site are authenticated
  automatically; unauthenticated users are prompted after selecting a room. To complete a reservation
  every guest must be signed in to a member or non-member account. On **Continue Booking** the user
  chooses **Guest Sign In** (Core sign-in / create account, returns to details) or **Member Sign In**
  (Axis sign-in, returns to details). Selections and the hold persist through sign-in; the auth state
  propagates to rates, rules and availability (5.3); session timeout handling preserves the booking
  where possible; identity providers are mocked in development.
- **Open questions:** Q-99-1.
