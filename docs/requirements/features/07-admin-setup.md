# Epic 7: Admin Setup

Epic issue: Excia/Guestrooms-Demo#69. Figma page: Admin Setup. Back to the [index](../README.md). Entry
fields are described in [00-foundation.md](00-foundation.md).

**Shell (from tickets 7.1 and 7.3 to 7.7):** left navigation Locations, Room Options, Booking Rules,
System Settings, Employees, Permissions, Keycard Integration, API Integrations, Migration Tool; a page
title; a primary save button. Admin-only routes (ticket 0.8). **Gaps:** Locations, Employees, Permissions
and API Integrations appear in that navigation but have **no ticket and no design** (a follow-up epic
"Employees and Permissions" is planned once the Permissions screenshot arrives, D-009). The menu's six
Admin Setup entries (Primary Setup, Rate Categories, Room Types, Rooms, Add-On Items, Notifications) map to
the routes `/admin/primary-setup`, `/admin/rate-categories`, `/admin/room-types`, `/admin/rooms`,
`/admin/add-on-items`, `/admin/notifications` (all placeholder pages today). Booking Rules, Keycard
Integration and Migration Tool have **no route yet**. Responsive: desktop-first, stack below 1200px (D-010).
All tickets are **not started**.

## 7.1 Primary Setup / System Settings

Excia/Guestrooms-Demo#70. Figma: Settings tab 11895:16081, Folio Details tab 11964:11725, error states
11964:13239 and 12369:18075, section 11964:13201.

- **Requirements:** a tabbed page with one form state, dirty tracking and a single "Save System Settings"
  action; Confirm Leaving on unsaved changes. Settings tab: **Time Zone** select; **Check In Time**
  (e.g. 4:00 PM) and **Checkout Time** (12:00 PM); **Enable Early Check In and Late Check Out** switch
  revealing **Late Checkout Time** (3:00 PM; options run from the standard checkout to the standard
  check-in time; 5-minute increments); **Mobile POS Visibility** ("Folio becomes visible N hours before
  system check in time on the day of check in"; "Folio is no longer visible N hours after system checkout
  time on the day of checkout"); **Close Settled Folios** N hours after system checkout time; **Night
  Audit** Run Manually / Run Automatically; **Alternative Base Rates** 1 and 2, each "N or more nights"
  stepper; **Credit Card Options**: Enable Credit Card Authorization (new cards authorized for $0.01),
  Enable Card Present Transactions (reader or manual entry; otherwise manual only) with a Default Card
  Reader select; **Rate Change Handling**: existing reservations use rates from booking time or stay time;
  **Member Owners**: Enable Room Owner Field; **Service Charge Label** (max 15 characters); **Transfer
  Item** (folio transfer SKU), **Guest Rooms Area** (Hotel) and **Guest Member** (First Last (Member))
  lookups. **Folio Details** tab: Property Address (street, city, state, zip with counters), Property
  Contact (email, phone), Custom Details (Custom Folio Text, 400 characters), Logo upload; feeds the
  printed folio header. Cross-field validation (tested): Close Settled Folios must be later than the
  MPOS "no longer visible" value and extend past the Late Checkout Time ("Close Settled Folios value must
  extend past Late Checkout Time"); folio visibility must extend past Late Checkout Time; errors inline.
  Switch behavior propagates through a settings context. Early/late off: no field, checkboxes or
  indicators (3.12). Member Owners on enables the Room Owner field (7.3, 3.11). A setting controls
  whether Print Registration Card appears (7.8). The Change Log button opens the overlay (7.10).
- **Open questions:** Q-70-1 to Q-70-3.

## 7.2 Rate Categories

Excia/Guestrooms-Demo#71 (**needs design**). Figma: no screen exists for managing rate categories; the
"Default Rate Categories" tab label in System Settings (11895:16081) has no content. Categories seen:
Comp Rate, Member Rate, Non-Member Rate, Owner Rate. **D-016:** rate categories are managed inside
Guest Rooms (not synced from CMA). Rate Change Handling and Alternative Base Rates (7.1) depend on them.
Blocked until a design exists (Q-71-1).

## 7.3 Room Types and Rooms

Excia/Guestrooms-Demo#72. Figma: Room Types and Rooms 11970:12076, Associations 11964:23814, Quantity
Picker 11964:13394, Image Placeholder 11964:13054, Section Header 11895:18681.

- **Requirements:** **Room Type form:** left list with NEW ROOM TYPE; Room Type Name, Active Start Date,
  Active End Date with "Configure active end date?", SKU lookup, Display in Online Booking toggle;
  Occupancy and Capacity steppers (Max Occupancy, Bedrooms, Full Bath, Half Bath); Bed Types steppers
  (King, Queen, Double, Twin); Room Type Description (optional, counter); Photos (ADD PHOTOS, removable
  thumbnails); Associations tabs Features and Add-Ons (checkbox lists with Select All / Select None;
  changes are reflected on associated items); header actions delete (red), duplicate, SAVE ROOM TYPE.
  **Room form:** Room Name, **Room Owner** (member lookup with autocomplete, only when the Owner setting
  is on; always enabled; **not inherited**; set on each room including linked rooms), Active dates, Room
  Type select, toggles Inherit Details from Room Type, Inherit Rates from Room Type, Display in Online
  Booking (occupancy and bed types disabled while inheriting); tabs Linked Rooms, Features, Add-Ons;
  delete, duplicate, SAVE ROOM. Linked Rooms tab: if a "Required" switch is active a service cannot be
  booked without one available resource. Create/edit/duplicate/delete with confirmation; start before end
  validation; a reusable Quantity Picker (min 0); photo upload with preview, remove and a max count;
  deleting a room or type in use blocked or warned.
- **Open questions:** Q-72-1 to Q-72-3. The Quantity Picker divider decision is D-029.

## 7.4 Add-On Items

Excia/Guestrooms-Demo#73. Figma: Add-Ons 13533:74182; reservation side is ticket 3.10.

- **Requirements:** left list with NEW ADD-ON; Add-On Name, Active Start Date, Active End Date with
  "Configure active end date?", **Item / Combo** radio, SKU lookup, Display in Online Booking toggle,
  **Track Nightly Countdown** toggle with **Nightly Qty** stepper (min 1, max 99 per reservation line,
  nightly pool configurable), Add-On Description (optional, 400 characters), Photos; Associations tabs
  Locations and Room Types; delete, duplicate, SAVE ADD-ON. Add-ons appear in the reservation dropdown
  (price shown is the SKU price); with tracking on, remaining nightly quantity drives availability limits
  (3.10) and the Add-On Countdown screen (menu item, no design). Active dates limit when the add-on can
  be selected.
- **Open questions:** Q-73-1 (Combo is also on the owner's list of answers still needed), Q-73-2.

## 7.5 Booking Rules

Excia/Guestrooms-Demo#74. Figma: Booking Rules 15957:84601.

- **Requirements:** a table with columns **Employee Booking** (always enabled), **Member Online Booking**
  (enable toggle plus a "Unique Member Type Rules" checkbox) and **Non-Member Online Booking** (enable
  toggle), rows: Require Member Reserver (checkbox); Required Named Occupants (All occupants / Lead
  occupant only / None); Require Contact Information (Email only / Phone only / Email AND phone / Email OR
  phone); Booking Opens and Booking Closes (time prior to check in; Employee can be N/A for closes);
  **Cancellation Period** (time prior to check in; D-007); **Reservation Hold** (minutes, max 99; D-006);
  Payment Method at Booking (Payment on File Required / Deposit Required with Amount / Prepayment
  Required); Room Selection (Room Optional / Room Only / Room Type Only); Excluded Room Types (multi-select
  chips); Max. Rooms per Reservation; Display Add-On Popup (online only). Second table **Unique Member Type
  Rules**: Member Type, Exclude from Online Booking, Excluded Room Types, Booking Opens, Booking Closes, row
  delete, ADD MEMBER TYPE; unique rules take precedence over the member default. SAVE BOOKING RULES.
  Toggle logic: Member Online off clears and disables both online columns and online booking is not an
  option (member rules are the default for all member types); Non-Member Online off clears and disables its
  column and online booking is for logged-in members only (non-member rules are the default for all
  non-members); with non-member online **enabled**, "Require Member Reserver" is disabled and N/A (gray).
  The label of the member-type checkbox anchors to its table. Validation: opens later than closes, hold 1 to
  99, deposit amount required when Deposit is selected. The rules are exposed as a typed object consumed by
  Epic 5 and the admin New Reservation search.
- **Existing groundwork:** `GET /settings/booking-hold` and `BookingHold { employee, member, nonMember }`
  (1 to 99 minutes) in PR Excia/Guestrooms-Demo#119.
- **Open questions:** Q-74-1, Q-74-2.

## 7.6 Keycard Integration settings

Excia/Guestrooms-Demo#75. Figma: Keycard Integration 2829:6860.

- **Requirements:** **Encoder Key** list of rows ("Enter X digit Encoder Key or Retrieve from Visionline")
  with a delete icon; **RETRIEVE ENCODER** fetches from Visionline and fills rows; **ADD ENCODER** adds a
  blank row; **REMOVE ALL** (red, with confirmation) clears; **SAVE CHANGES**. Retrieve error dialog: "No
  encoders retrieved. Try doing something to troubleshoot and try again." (Cancel / Try Again); success
  toast "1 Encoder Successfully Retrieved". Retrieve goes through an integration interface with a mock;
  input validation (format and length, no duplicates); saved encoders feed the keycard flows (3.6).
- **Open questions:** Q-75-1 to Q-75-3.

## 7.7 Migration Tool

Excia/Guestrooms-Demo#76. Figma: page, errors and results 15957:84602.

- **Requirements:** page "Guest Room Migration Tool" with a drag-and-drop area (.CSV, .XLSX, .XLS) and
  instructions: download the template with headers **Reservation Number, Check In Date, Check Out Date,
  Reserver, Lead Occupant** (all required), upload, the system checks for errors. Only **future**
  reservations migrate; **all reservations are unassigned on migration** (check for overbooking). **SAVE
  CHANGES**. **Errors:** unsupported file type ("The [file type, file size] selected is not supported"); a
  columns mismatch ("The file uploaded does not match the columns needed to successfully import
  reservations") with the headers and a Download Migration Template link. **Results:** "N out of M
  Reservations successfully imported" with View Reservation List; per-row failures ("Row 3 | John Smith |
  Reservation #XXXX: Check In Date missing", "Reservation Number missing") and an Export Failed
  Reservations (CSV) link; an all-success variant. Row validation (required, future dates, check out after
  check in); import is idempotent by reservation number and handles partial success; client-side size
  limit. **D-017 (in scope):** the mapping flow Upload, Match columns, Review import, Complete (auto-match by
  header and pattern with percent of rows valid, confirm mapping / ignore this column, unmatched columns
  get a lookup dropdown). The frame also holds reference mockups (a column-mapping wizard and an "Upload a
  spreadsheet" address dialog) that look like examples from another product.
- **Open questions:** Q-76-1, Q-76-2.

## 7.8 Registration Card setting and PDF

Excia/Guestrooms-Demo#95 (added during refinement). Figma: tab 13319:41951, PDF 15957:187196.

- **Requirements:** a Registration Card tab in System Settings: **Enable Registration Card** switch (a
  card prints at check in; also decides whether **Print Registration Card** appears in the Hub and details
  panel menus, tickets 2.5, 3.4); **Registration Card Items** checkboxes with **Generate Preview**: Include
  Folio Header, Confirmation Number, Check In Date, Check Out Date, Early Check In Flag, Late Check Out
  Flag, Room Number, Room Type, Guest Count, Average Room Rate, Lead Occupant Name / Address / Phone
  Number, Reserver Name (if unique), Reserver Phone Number (if unique), Public Reservation Notes, Custom
  Text (500 characters), Guest Signature Area, Staff Signature Area. Unchecking a name disables its phone
  or address; Reserver Name checked with no reserver hides that section; Include Folio Header uses the
  Folio Details (7.1); custom text prints above the signatures. The PDF opens in a new tab (D-003).
- **Open questions:** Q-95-1.

## 7.9 Online Booking settings tab

Excia/Guestrooms-Demo#96 (added during refinement). Figma: Online Booking tab 15957:84617.

- **Requirements:** **Global Booking Message** (150 characters; e.g. contact group sales for more than 3
  rooms); **Cancellation Agreement** (300 characters) with **Include Link to Full Policy** and a URL field
  (URL validation); **Cancellation Fee** helper text and a **Charge a Cancellation Fee** switch;
  **Add-Ons Popup**: Display Add-Ons Popup after room selection and before the details screen (the per-user
  version is in Booking Rules). Values feed Epic 5 and save with the rest of System Settings. Fee amounts
  are out of scope (D-007).
- **Open questions:** Q-96-1, Q-96-2.

## 7.10 Change Log overlay

Excia/Guestrooms-Demo#97 (added during refinement). Figma: Change Log overlay 16718:6217 (an Event Types
table sits next to it).

- **Requirements:** a reusable `<ChangeLogOverlay page=...>` full-screen overlay titled "[Page] Change
  Log", listing only that page's changes; columns Date ("Day, MM/DD/YY"), Time ("HH:MM XM"), Change Type,
  Description, Action By; newest first; sort and filter by date, time, change type and action by;
  pagination; the X closes; **retention one year** on admin setup screens (enforced by the API contract);
  the event types table drives the Change Type filter.
- **Open questions:** Q-97-1, Q-97-2.
