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
**Save button (D-SC-1):** one shared `SaveButton` on every admin page: white "Saved" with a check when nothing is
unsaved, filled "Save <page noun>" when there are changes, "Saving…" in flight. See
[entries/save-cta.md](../entries/save-cta.md).
**Scrolling (D-AP-4):** from 1200px up the page itself does not scroll: `AdminShell` fills the viewport below the
app bar, the left navigation and the page header row stay fixed, and only the content body scrolls. Below
1200px it stacks and scrolls normally.
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
- **Implemented (Excia/Guestrooms-Demo#70, in review):** `src/pages/SystemSettings.tsx` at `/admin/primary-setup`
  inside the new Admin Setup shell `src/components/admin/AdminShell.tsx` (left navigation from
  `src/app/adminNav.ts`; entries without a page are disabled; stacks below 1200px). Tabs Settings and Folio
  Details (the "Default Rate Categories" tab is shown disabled: no content until 7.2). Every Settings field and
  the Folio Details fields above; one draft for both tabs; "Save System Settings" is enabled only while the draft
  differs from what is saved. Pure rules in `src/app/systemSettings.ts` (5-minute step, late checkout options,
  cross-field validation, dirty check, logo file check), unit-tested. Close Settled Folios can show both of its
  messages at once, as in Figma 11964:13239. A refused save focuses the first invalid field (switching tab when
  needed); the API's 422 shows an inline alert. Settings context: `SystemSettingsProvider` (mounted in
  `src/main.tsx`) and `useSystemSettings()`; the first consumer starts the fetch and a save updates every
  consumer at once. Confirm Leaving (`useLeaveGuard`, `src/app/leaveGuard.ts`) holds in-app link clicks and
  asks the browser to confirm reload or tab close. The folio details and logo are the shared `FolioDetails`
  type for the printed folio (4.1).
  - **From the functional requirements PDF (sections 6.1 to 6.8; Figma wins on layout and labels):** the
    MPOS visibility and Close Settled Folios settings take 0 to 31 hours or days (6.2, 6.3); an automatic night
    audit reveals a daily run time (6.4; Figma draws no field, so it is added under the radios, 5-minute steps);
    alternative base rates run 2 to 99 nights and chain, so rate 2 must start after rate 1 (6.5); the folio
    header fields follow 6.8. Not contradicted by Figma, so kept.
  - **Built defaults (see Q-70-1 and Q-70-3):** "extend past the Late Checkout Time" is strict (the duration in
    minutes must be larger than the minutes between checkout and late checkout); all settings are system-wide
    (not per location).
  - **Not built here:** the Change Log button (7.10), the Print Registration Card setting (7.8, which owns its
    tab), consumers of the settings (3.11, 3.12, 7.3 still read their own defaults). Browser Back is not
    intercepted by Confirm Leaving (the app has no data router); the main menu's links are.
  - **House Account (owner request 2026-10-25):** a "House Account" section at the end of the Settings tab's right
    column: one optional type-ahead lookup (label "House Account", placeholder "House Account Name", green search icon,
    clear X, loading, no-results and failure states, shared `LookupField` in async mode; the whole Settings tab can be
    disabled through the page's `readOnly` prop for the View-only admin). Stored as `houseAccount {id, label} | null` with the other settings. What
    the folio does with it is open (Q-HA-1). See [entries/house-account.md](entries/house-account.md).
  - **SSO Admin (owner request 2026-10-25):** an "SSO Admin" section as the first section of the Settings tab's left
    column (above Time Zone): the shared `LookupField`, always disabled, showing the placeholder "Admin User" with the
    pale disabled search icon; always visible (also in View mode and Training Mode); display-only, so it is not in the
    settings data, the dirty check or the Save payload. What it will do is open (Q-SSO-1, Q-SSO-2). See
    [entries/sso-admin.md](entries/sso-admin.md).
  - **Backend:** `GET` and `PUT /settings/system`, `GET /settings/system/options` (see
    [api-contract.md](../api-contract.md)).
  - **Doc items with no Figma content or no ticket (candidate tickets):** 6.7 Default Rate Categories for Room
    Blocks, Members and Non-Members with "Add Member Type Override" rows (the Figma tab exists but is empty;
    depends on Rate Categories 7.2); 6.5.4 new alternative base rate columns inheriting the standard rates (Rate
    Categories 7.2); 6.4 the automatic Night Audit job itself (backend and Night Audit screens); the doc's admin
    heading with breadcrumbs, fixed Save CTA and 10-second success flag with progress bar (Figma shows a plain
    heading, a header Save button and the shared save toast, which are what is built).
- **Open questions:** Q-70-1 and Q-70-3 (Q-70-2 answered by the PDF).

## 7.2 Rate Categories

Excia/Guestrooms-Demo#71 and Legacy Port #184 (LP-A.3); entry [184-rate-categories.md](../entries/184-rate-categories.md).
Figma: no screen exists for managing rate categories; the "Default Rate Categories" tab label in System Settings
(11895:16081) has no content. Categories seen: Comp Rate, Member Rate, Non-Member Rate, Owner Rate. **D-016:**
rate categories are managed inside Guest Rooms (not synced from CMA). Rate Change Handling and Alternative Base
Rates (7.1) depend on them.

- **Requirements (ported from legacy, no design):** list with NEW RATE CATEGORY (inactive last); Rate Category Name
  (25), active start date and optional end date ("Configure active end date?"), Item / Combo and SKU lookup
  (required), Associations > Room Types, and the **rate table**: a default season plus named, dated seasons
  (no overlap), one row per associated room type with Standard Base, Alt Base 1 and 2 (while enabled in System
  Settings), Mon to Sun, Guest 2, Guest 3, Guest 4+ and Child; Add Season (starts from the default rates),
  duplicate and remove season; delete (blocked while in use) and duplicate through the shared Duplicate dialog;
  Save, Cancel on an unsaved one, Confirm Leaving, save toast, Change Log button.
- **Implemented (Legacy Port #184, in review):** `src/pages/RateCategories.tsx` at `/admin/rate-categories` in
  the Admin Setup shell, with `RateTable`, `AmountField` and `useRateCategoryData` in
  `src/components/admin/rateCategories/` and the generic `src/components/shared/DuplicateDialog.tsx`. Pure rules
  in `src/app/rateCategories.ts` (validation, inclusive season overlap, unique names, normalization, in-use
  check, `seasonFor`, money parsing), unit-tested. API `rateCategories` (`getOptions`, `list`, `save`,
  `duplicate`, `delete`) with a mock (seeded with the four categories, usage counts, idempotent create and
  duplicate) and an http client with response guards; see [api-contract.md](../api-contract.md). Quick Stats (mock)
  now reads the live category list.
- **Not built:** the "Default Rate Categories" tab in System Settings (separate ticket), pricing a night from the
  rates, rates for a new room type, per-room overrides (see the entry).
- **Open questions:** Q-71-1 (design), Q-184-1 to Q-184-7.

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
- **Implemented (Excia/Guestrooms-Demo#72, in review):** `src/pages/RoomTypes.tsx` at `/admin/room-types` and
  `src/pages/Rooms.tsx` at `/admin/rooms`, both inside the Admin Setup shell (`AdminShell` gained an optional
  `sidebar` for the item list, D-088). Left list (`SetupList`) with NEW ROOM TYPE / NEW ROOM, the selected item
  filled, inactive items last with "(Inactive)" (PDF 9.4.2.4); a new item shows the default title and a Cancel
  button; duplicate makes a new unsaved item named "Copy of ..."; delete asks Delete or Cancel (D-087). Form
  parts: Active Start/End Date with "Configure active end date?" (end must be after start), SKU lookup, switches,
  the shared `QuantityPicker` (`src/components/shared`, min 0 by default; occupancy 1 to 99, bedrooms 0 to 10,
  full bath 1 to 99, half bath and bed types 0 to 99), description with a counter (750), photos (ADD PHOTOS,
  remove, 50 max, at least one for a room type; D-089), Associations tabs with Select All / Select None and a
  count in each tab label. Rooms: Room Owner (only while the System Settings owner switch is on, always enabled,
  not inherited), Room Type lookup (changing it re-reads inherited details), Inherit Details (disables and fills
  occupancy, beds, description, photos, features, add-ons), Inherit Rates (the rates table waits for 7.2), Display
  in Online Booking, Linked Rooms tab (two-way, D-090). Saving a room type updates rooms that inherit from it (in
  the mock). Unsaved changes ask before picking another item, creating one or following a link
  (`useSetupEditor`, `useLeaveGuard`). Pure rules and tests: `src/app/roomSetup.ts`. API: `roomSetup` (see
  [api-contract.md](../api-contract.md)). `LookupField` (7.1) now keeps the input slots MUI wires up (it had
  dropped the input ref and its combobox role).
- **From the functional requirements PDF (sections 9 and 10; Figma wins on layout and labels):** name 50
  characters, description 750, photos 50 with one required, defaults 2 / 0 / 1 / 0 and bed types 0, active dates,
  inactive items to the bottom, linked rooms two-way, inherit rules 10.4.3 to 10.4.7.
- **Not built:** rates tables (7.2), room order editing, photo reorder and per-photo description, location
  association (Figma shows only "SKU", see [figma-deviations.md](../figma-deviations.md)), deactivation checks,
  visibility of the online booking toggles by Booking Rules (7.5), the schedule hiding inactive types and showing
  linked rooms as unavailable (ticket 1.x reads its own data today).
- **Status:** in review, 2026-10-21.

## 7.4 Add-On Items

Excia/Guestrooms-Demo#73. Figma: Add-Ons 13533:74182; reservation side is ticket 3.10.

- **Requirements:** left list with NEW ADD-ON; Add-On Name, Active Start Date, Active End Date with
  "Configure active end date?", **Item / Combo** radio, SKU lookup, Display in Online Booking toggle,
  **Track Nightly Countdown** toggle with **Nightly Qty** stepper (whole number, 0 or more, no maximum, D-LM-3; per reservation line,
  nightly pool configurable), Add-On Description (optional, 400 characters), Photos; Associations tabs
  Locations and Room Types; delete, duplicate, SAVE ADD-ON. Add-ons appear in the reservation dropdown
  (price shown is the SKU price); with tracking on, remaining nightly quantity drives availability limits
  (3.10) and the Add-On Countdown screen (menu item, no design). Active dates limit when the add-on can
  be selected.
- **Implemented (Excia/Guestrooms-Demo#73, in review):** `src/pages/AddOnItems.tsx` at `/admin/add-on-items` inside the
  Admin Setup shell, built from the Room Types parts (list with inactive add-ons last, active dates, Associations
  tabs, photos, delete/duplicate/save, Confirm Leaving, save toast). Fields as in Figma 13533:74182: name, active
  dates, **Item / Combo**, SKU lookup, Display in Online Booking, **Track Nightly Countdown** with the **Nightly Qty.**
  stepper (disabled while tracking is off), description (400 characters), photos (optional, at most 50),
  Associations **Locations** and **Room Types**. Pure rules in `src/app/addOns.ts` (validation, 0-or-more stepper
  with no maximum, normalization, `isSelectableOn` for ticket 3.10), unit-tested. API `addOns` (`getOptions`, `list`, `save`,
  `delete`) on the typed client with a mock; see [api-contract.md](../api-contract.md).
  - **Built defaults (open questions):** Combo is stored and flagged but behaves like an Item (one SKU, no bundle
    contents) until Q-73-1 is answered; Nightly Qty has no maximum (Q-73-2, matches legacy); an add-on with no location or room
    type selected is not offered anywhere, with a hint (Q-73-3). A SKU is required (the reservation shows its price).
  - **Not built:** the Add-On Countdown screen (no design), the reservation add-on dropdown (3.10), the two-way
    update of a room type's Add-Ons tab when an association changes here, and a delete check against reservations.
  - **Status:** in review, 2026-10-24.
- **Open questions:** Q-73-1 (Combo is also on the owner's list of answers still needed), Q-73-2, Q-73-3.

## 7.11 Locations

Excia/Guestrooms-Demo#123, built as Legacy Port #182. No Figma frame; behavior ported from the legacy Locations screen.

- **Requirements:** each location has a Location Name (50 characters) and a Location Area (type-ahead over areas; the area
  routes revenue to the right GL); one row by default, Add Location, Remove; with one location every location selector,
  dropdown, field and column is hidden; read-only mode; Save checks errors, success flag 10 s, Save/Discard prompt on leaving.
- **Implemented (in review):** `src/pages/Locations.tsx` at `/admin/locations` in the Admin Setup shell (nav item enabled,
  Change Log button). Pure rules in `src/app/locations.ts` (the single-location rule `showLocations`, validation, dirty check,
  removal check), unit-tested. The rule is used by the Schedule filter, Reservation List (select and column), New Reservation
  search, the New Reservation and Add Room panels, the online booking widget and Adjust Search, and Add-On Items. Typed API
  `locations` (`list`, `listAreas`, `save`) with a mock and http guards; read-only without `locations.edit`.
  - **Built defaults (open questions):** Q-182-1 to Q-182-7 in [entries/182-locations.md](entries/182-locations.md).
  - **Not built:** the online booking demo and the Room Types / Rooms mock data do not follow locations saved here (the schedule, add-ons, reservation list and dashboard search do); the "Location | Room type" captions
    still show the location name for a one-location club.
  - **Status:** in review, 2026-10-25.
- **Open questions:** Q-182-1 to Q-182-7.

## 7.5 Booking Rules

Excia/Guestrooms-Demo#74. Figma: Booking Rules 15957:84601.

- **Requirements:** a table with columns **Admin Booking** (always enabled; the stored id stays `employee`), **Member Online Booking**
  (enable toggle plus a "Unique Member Type Rules" checkbox) and **Non-Member Online Booking** (enable
  toggle), rows: Require Member Reserver (checkbox); Required Named Occupants (All occupants / Lead
  occupant only / None); Require Contact Information (Email only / Phone only / Email AND phone / Email OR
  phone); Booking Opens and Booking Closes (time prior to check in; Employee can be N/A for closes);
  **Cancellation Period** (time prior to check in; D-007); **Reservation Hold** (minutes, max 99; D-006);
  Payment Method at Booking (Optional / Payment on File Required / Deposit Required with a `$ / %` toggle and
  an amount or percentage / Prepayment Required); Room Selection (Room Optional / Room Only / Room Type Only); Excluded Room Types (multi-select
  chips); Max. Rooms per Reservation; Display Add-On Popup (online only). Second table **Unique Member Type
  Rules**: Member Type, Exclude from Online Booking, Excluded Room Types, Booking Opens, Booking Closes, row
  delete, ADD MEMBER TYPE; unique rules take precedence over the member default. SAVE BOOKING RULES.
  Toggle logic: Member Online off clears and disables both online columns and online booking is not an
  option (member rules are the default for all member types); Non-Member Online off clears and disables its
  column and online booking is for logged-in members only (non-member rules are the default for all
  non-members); with non-member online **enabled**, "Require Member Reserver" is disabled and N/A (gray).
  The label of the member-type checkbox anchors to its table. Validation: opens later than closes, hold 1 to
  99, deposit required when Deposit is selected (dollars above 0, or a percentage of the stay from 0.01 to 100 with at most 2 decimals). The rules are exposed as a typed object consumed by
  Epic 5 and the admin New Reservation search.
- **Existing groundwork:** `GET /settings/booking-hold` and `BookingHold { employee, member, nonMember }`
  (1 to 99 minutes) on `main` (PR Excia/Guestrooms-Demo#119); the New Reservation panel uses the employee value (placeholder 15 minutes).
- **Implemented (Excia/Guestrooms-Demo#74, in review):** `src/pages/BookingRules.tsx` at `/admin/booking-rules`
  (route `booking-rules`, an Admin Setup page that is not in the menu; the Admin Setup navigation links to it) in
  the Admin Setup shell. `src/components/admin/bookingRules/`: `RulesMatrix` (a real table; the rows are data in
  `ROWS`, so a rule is added in one place), `MemberTypeRulesTable`, `PeriodField`, `CellSelect`,
  `RoomTypesField`. Pure rules in `src/app/bookingRules.ts`: `toggleColumn` (member online off clears both
  online columns and the member type rules; non-member off clears its column; non-member online cannot be on
  while member online is off), `validateBookingRules`, `effectiveRules` (what Epic 5 and the admin New
  Reservation search call: the member type rule overrides the member default, an excluded member type or a
  switched-off column means no online booking) and `holdFromRules`. A cleared column is `null` in the data. An
  N/A cell is a gray cell (admin excluded room types and add-on popup; the non-member member reserver).
  Validation: booking opens earlier than it closes (compared in days, a month counts 30), hold 1 to 99, deposit
  value required for Deposit (dollars or percent), rooms per reservation 1 to 99, a member type chosen once per row. One Save
  button, enabled while dirty; Confirm Leaving; a refused save focuses the first invalid cell.
  The mock's `GET /settings/booking-hold` now reads the Reservation Hold row.
  - **Built defaults:** time units are days, weeks and months, amounts 1 to 99 (Q-74-1); Admin Booking has no
    Excluded Room Types (N/A, as drawn; Q-74-2); the "Maximum reservations / time" hint Figma shows under Room
    Selection looks pasted from another row and is not shown; the member-type label is a link to its table and
    the checkbox beside it toggles the rows; switching a column back on gives it default values.
  - **Not built:** consumers (Epic 5 online booking, the cancellation window, the New Reservation search) still use
    their own placeholders; they should call `effectiveRules`. Fee amounts for cancellation are out of scope
    (decision D-007).
  - **Backend:** `GET` and `PUT /settings/booking-rules`, `GET /settings/booking-rules/options` (see
    [api-contract.md](../api-contract.md)).
- **Polish (2026-10-25):** the audience is labelled Admin Booking; Payment Method at Booking gains Optional; a
  deposit is a dollar amount or a percentage of the stay (`depositType`, `depositValue`) with `depositDueCents` in
  `src/app/bookingRules.ts`. Details: [entries/booking-rules-polish.md](entries/booking-rules-polish.md).
- **Open questions:** Q-74-1, Q-74-2, Q-bkr-1 to Q-bkr-3.

## 7.6 Keycard Integration settings

Excia/Guestrooms-Demo#75. Figma: Keycard Integration 2829:6860.

- **Requirements:** **Encoder Key** list of rows ("Enter X digit Encoder Key or Retrieve from Visionline")
  with a delete icon; **RETRIEVE ENCODER** fetches from Visionline and fills rows; **ADD ENCODER** adds a
  blank row; **REMOVE ALL** (red, with confirmation) clears; **SAVE CHANGES**. Retrieve error dialog: "No
  encoders retrieved. Try doing something to troubleshoot and try again." (Cancel / Try Again); success
  toast "1 Encoder Successfully Retrieved". Retrieve goes through an integration interface with a mock;
  input validation (format and length, no duplicates); saved encoders feed the keycard flows (3.6).
- **Implemented (Excia/Guestrooms-Demo#75, in review):** `src/pages/KeycardIntegration.tsx` at
  `/admin/keycard-integration` inside the Admin Setup shell (navigation item enabled; not a menu link). Encoder Key
  rows with a delete icon, **Retrieve Encoder**, **Add Encoder**, **Remove All** (confirmation dialog), **Save Changes**,
  the retrieve error dialog (Cancel / Try Again) and the success toast, Confirm Leaving on unsaved edits. Pure rules in
  `src/app/keycards.ts` (key format and length, duplicates, blank rows dropped on save, merge of retrieved keys),
  unit-tested. API `keycards` (`listEncoders`, `saveEncoders`, `retrieveEncoders`) on the typed client with a mock whose
  Visionline retrieve always succeeds with one key; see [api-contract.md](../api-contract.md). The saved list is read
  with `api.keycards.listEncoders()`; ticket 3.6 uses it.
  - **Built defaults (open questions):** a key is 14 digits, hyphens and spaces ignored (Q-75-1); the error dialog
    keeps the Figma placeholder sentence (Q-75-2); no Visionline connection or authentication (Q-75-3).
  - **Not built:** a real Visionline connection, the keycard flows that consume the list (3.6).
  - **Status:** in review, 2026-10-24.
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
- **Implemented (Excia/Guestrooms-Demo#95, in review):** a "Registration Card" tab in `src/pages/SystemSettings.tsx`
  (`src/components/admin/systemSettings/RegistrationCardTab.tsx`); the values are `SystemSettings.registrationCard`,
  saved with the rest. Pure rules in `src/app/registrationCard.ts` (item dependencies, validation, `buildRegistrationCard`:
  what the card prints for a reservation, including the reserver-hidden case). Generate Preview opens a modal dialog that
  draws the card in the app (`src/components/registrationCard/`, from `buildRegistrationCard` and a sample reservation);
  its Print button calls the typed API `registrationCard.requestPreview` (mock: a printable HTML page laid out like the PDF
  frame) and opens the result in a new tab (settings polish 2026-10-25, D-settings-polish-4). Print Registration Card(s) leaves the reservation menus while the switch is off. Details in
  [entries/95-registration-card.md](entries/95-registration-card.md).
- **Open questions:** Q-95-1 to Q-95-5.
- **Settings polish (2026-10-25, branch `fix/settings-polish-registration-preview-modal`):** red Remove logo X; **Training Mode**
  switch at the top right of the Settings tab ("Training Mode Enabled" / "Training Mode Disabled", as legacy; on forces Night Audit
  to Run Manually and disables Run Automatically); smaller System Settings text (theme variants `settings_*`); Registration Card
  preview as a dialog. Details and values in [entries/settings-polish.md](entries/settings-polish.md).

## 7.9 Online Booking settings tab

Excia/Guestrooms-Demo#96 (added during refinement). Figma: Online Booking tab 15957:84617.

- **Requirements:** **Global Booking Message** (150 characters; e.g. contact group sales for more than 3
  rooms); **Cancellation Agreement** (300 characters) with **Include Link to Full Policy** and a URL field
  (URL validation); **Cancellation Fee** helper text and a **Charge a Cancellation Fee** switch;
  **Add-Ons Popup**: Display Add-Ons Popup after room selection and before the details screen (the per-user
  version is in Booking Rules). Values feed Epic 5 and save with the rest of System Settings. Fee amounts
  are out of scope (D-007).
- **Implemented (Excia/Guestrooms-Demo#96, in review):** an "Online Booking" tab in `src/pages/SystemSettings.tsx`
  (`src/components/admin/systemSettings/OnlineBookingTab.tsx`); the values are `SystemSettings.onlineBooking`, saved with
  the rest. Pure rules in `src/app/onlineBookingSettings.ts`: limits (150 and 300), URL check, and what Epic 5 reads
  (`globalBookingMessage`, `cancellationNotice`, `showAddOnsPopup`). Details in
  [entries/96-online-booking-settings.md](entries/96-online-booking-settings.md).
- **Open questions:** Q-96-1, Q-96-2.

## 7.10 Change Log overlay

Excia/Guestrooms-Demo#97 (added during refinement). Figma: Change Log overlay 16718:6217 (an Event Types
table sits next to it).

- **Requirements:** a reusable `<ChangeLogOverlay page=...>` modal dialog (not full screen, D-AP-3) titled "[Page] Change
  Log", listing only that page's changes; columns Date ("Day, MM/DD/YY"), Time ("HH:MM XM"), Change Type,
  Description, Action By; newest first; sort and filter by date, time, change type and action by;
  pagination; the X closes; **retention one year** on admin setup screens (enforced by the API contract);
  the event types table drives the Change Type filter.
- **Implemented (Excia/Guestrooms-Demo#97, in review):** `src/components/admin/changeLog/` (`ChangeLogOverlay`,
  `ColumnFilter`, `ChangeLogButton`, `useChangeLog`); `AdminShell` takes `changeLog="<page>"` and shows the button
  (System Settings, Booking Rules, Room Types, Rooms, Add-On Items wired). Pure rules in `src/app/changeLog.ts` (formats,
  retention, sort toggling, filters); typed API `changeLog` (`src/api/changeLogTypes.ts`) with a mock that filters,
  sorts, pages and drops entries older than a year. Details in [entries/97-change-log.md](entries/97-change-log.md).
- **Open questions:** Q-97-1, Q-97-2, Q-97-3.

## 7.12 Room Options (Features and Bed Sizes)

Excia/Guestrooms-Demo#124 (main board) and #183 (Legacy Port LP-A.2); one PR closes both. No Figma frame:
the legacy page is the reference (see [entries/183-room-options.md](entries/183-room-options.md)).

- **Requirements:** two lists, Features (offered as associations on Room Types and Rooms) and Bed Sizes
  (quantity-selectable on Room Type or Room setup). "Add Feature" / "Add Bed Size", "Remove" (later items move
  up), 50 characters per item, no duplicates in a list (case-insensitive). Removing an item in use is handled
  (rule below). The same list feeds Room Types, Rooms and the Schedule's Room Features filter.
- **Implemented:** `src/pages/RoomOptions.tsx` at `/admin/room-options` (Admin Setup navigation "Room Options"),
  two tabs Features and Bed Sizes over one draft and one **Save Room Options** button, Change Log button, save toast,
  Confirm Leaving while the draft differs from what is saved. Pure rules in `src/app/featureBedOptions.ts`
  (validation, dirty check, in-use check and its message), unit-tested. API `roomOptions.get` / `save` (replace both
  lists, idempotent on `requestId`). The mock keeps the one list (`src/api/roomOptionsData.ts`);
  `roomSetup.getOptions` and `schedule.get` read it, so the duplicated feature and bed lists are gone.
- **In-use rule:** the page and the API refuse to remove a Feature ticked, or a Bed Size with a quantity above 0,
  on any Room Type or Room (409 `in-use`, nothing saved). The page names what uses it. Legacy asks "Are you sure?"
  and leaves the check to its server (unknown); this follows the Room Types delete rule. Q-183-1.
- **Not built:** per-item usage counts in the list, drag reordering, renaming that propagates a notice to open
  Room Types tabs, a separate Bed Sizes / Features page per legacy route (one page with two tabs instead).
- **Status:** in review, 2026-10-25.
- **Open questions:** Q-183-1, Q-183-2, Q-183-3.
