# Epic 4: Folios and Night Audit

Epic issue: Excia/Guestrooms-Demo#37. Figma pages: Folio / Night Audit, Unassigned Charges, Remove /
Refund Payments, Audit Results. Back to the [index](../README.md). Entry fields are described in
[00-foundation.md](00-foundation.md).

**Current code for the whole epic:** the routes `/open-folios`, `/unassigned-charges` and
`/night-audit-history` exist and show placeholder pages. The dashboard badge reads
`dashboard.getStats().unassignedChargesCount` (mock 3). There is no folio, charge, payment or night
audit API yet; the needs are listed in [api-contract.md](../api-contract.md#planned-endpoints).
All tickets are **not started** unless stated. Shared decisions: D-002 (mock payments interface), D-003
(PDFs by the backend). "CMA" is the external accounting/point-of-sale system that receives night-audit
posts (full name Unknown; see [glossary.md](../glossary.md)).

## 4.1 Folio view

Excia/Guestrooms-Demo#38. Figma: Folio 12054:62479, Exploration 16477:82054, Balance Summary
16575:25666, Occupant Filter 16252:5285, Additional Charges 11666:29817, Payments 11666:29831.

- **Requirements:** route `/reservations/:id/folio`. Title "RESERVATION #XXXXXX FOLIO" with chips (Not
  Checked In, POS, Folio Open) and a Back to Reservation link. Left panel: **Posted Balance** and
  **Unposted Balance**; buttons Quick Settle, Quick Split, Print, Email, Manual Charge / Credit, Add
  Deposit / Payment, Jump to Night Audit History. **Charges** table (Type, Date, Description, Charge,
  Status) with an action bar: Split, Transfer, "Settle $X" (selection total). **Payments** table (Type,
  Date, Reference #, Ticket, Description, Amount, Status). **Balance Summary color** (pure function,
  one test per rule): grey when not yet checked in and when the folio is closed ($0 balance); yellow
  when checked in, or checked out with unposted charges not equal to $0; green when checked out, folio
  open and settled ($0); red when checked out, folio open, posted balance greater than $0.
  **Occupant Filter:** single select for now (multi recommended later); grey when "All", green when
  applied; a row shows "N of M charges" with a "view all" link that resets. **Settle status:** one
  reference number for a single line or full folio; a quick-split line shows several, truncated after
  3 with the rest on hover; the printed folio wraps all. MPOS card present adds a **Surcharge**; card on
  file in Guest Rooms adds a **Service Fee**. A settled MPOS charge can transfer only to Unassigned.
  Closed folio disables the action CTAs (Manual Charge / Credit, Add Deposit / Payment, Save in charge
  dialogs, buttons marked in the Exploration). Unposted lines have a Post action: "Post [Description]
  via Night Audit?" (Go Back / Post Charge) with a link to the wizard; only that charge posts. Print
  and Email are stubs; PDFs by the backend (D-003).
- **Open questions:** Q-38-1, Q-38-2.

## 4.2 Folio line type variations

Excia/Guestrooms-Demo#39. Figma: All Folio Line Types 16480:83130.

- **Requirements:** types and states: Payment (posted, settled); Split Item Parent (posted, not
  settled); Split Item Child (posted settled; posted not settled); Manual Charge (posted settled; posted
  not settled; unposted not settled); MPOS Charge (posted settled; posted not settled); Room Rate
  (posted settled; unposted before post date; unposted; posted not settled); Add-On (posted settled;
  posted not settled; unposted not settled). Rules: a Split Child, not settled, shows a transfer error
  on transfer and a split error on split; the Split control on a split row opens the split window to
  edit or undo; settled MPOS charges transfer only to Unassigned; daily room rates, add-ons and split
  items cannot be transferred. One `<FolioLine>` renders every type and state with a distinct label,
  status text and actions; pure `lineActions(line)` returns allowed actions (select, split, transfer,
  settle, delete, edit), unit tested across combinations; visual states differ by color and icon, not
  by color alone.
- **Open questions:** Q-39-1.

## 4.3 Open Folios list

Excia/Guestrooms-Demo#40 (**needs design**). No Figma frame exists. Known: it is in the menu and on the
dashboard list; the Balance Summary states suggest balance state per reservation. Blocked until a
design exists (Q-40-1).

## 4.4 Unassigned Charges list

Excia/Guestrooms-Demo#41. Figma: Unassigned Charges 14945:44837, transfer dialog 14946:64302, delete
confirmation 14948:64897.

- **Requirements:** MPOS charges not on any folio. Title, explanatory warning message, table: select
  checkbox, Charge Date, MPOS Ticket Number, Description, Amount, Original Reservation (link that opens
  the reservation), row transfer and delete icons; search button; bottom **TRANSFER N ITEMS** button
  and a **SEND TO POS** link. The row transfer icon opens the transfer dialog for one item to an open
  folio (4.5); the row trash opens a delete confirmation; search covers date, MPOS ticket number,
  description, amount and original reservation number; the bulk button opens the transfer modal for
  selected items; **intentionally no bulk delete**; sort, selection and pagination; the count drives
  the dashboard badge via a shared query; the warning message component's copy is configurable until
  final copy exists.
- **Open questions:** Q-41-1, Q-41-2.

## 4.5 Item transfer dialog

Excia/Guestrooms-Demo#42. Figma: 14946:64302 (and folio transfer variants and result toasts 12054:62479).

- **Requirements:** table of target rooms (Room #, Res #, Lead Occupant, Folio Status, Folio Settle
  State) with room search; only rooms with an **open** folio. An **Unassigned** row ("Use caution")
  appears when transferring from a folio and is hidden when opened from the Unassigned Charges screen;
  transferring to Unassigned needs an acknowledgement checkbox before **Transfer to Unassigned** is
  enabled (otherwise the button reads **Transfer to Selected Room**). Results: success ("N items
  successfully transferred to Room #123" with ticket numbers and a link to the folio or Unassigned
  list) and failures with reasons ("Item cannot be transferred": daily room rates, add-ons, split
  items); a mixed selection transfers the allowed ones and reports the rest. A settled MPOS charge can
  only go to Unassigned. Message when rates are selected: "Daily room rates cannot be transferred.
  Please deselect these rates to continue." Opens from the folio action bar, the Unassigned list row
  and the bulk button; disallowed types are detected via `lineActions` (4.2).
- **Open questions:** Q-42-1.

## 4.6 Reverse check

Excia/Guestrooms-Demo#43. Figma: Reverse Check (confirmation dialog) 14948:64897 (444 x 208).

- **Requirements:** `<ConfirmDestructiveDialog>` (title, body, secondary Go Back, destructive
  primary), opened from the row trash on Unassigned Charges; the body is marked "Need warning copy" and
  the title "Reverse Check" may not match the delete action. Confirm calls delete and shows a success
  message (failure: error with retry); focus trapped, Escape cancels, the destructive button is not the
  default focus. Marked "blocks Ready" on the ticket.
- **Open questions:** Q-43-1.

## 4.7 Remove / refund payments

Excia/Guestrooms-Demo#44. Figma: Refund Payments 17917:13628.

- **Requirements:** Payments-table row actions by type: Member Charge shows a red remove icon (tooltip
  "Remove"); Credit Card shows a refund icon (tooltip "Refund"); MPOS Payment shows an external-link
  icon; a refunded payment appears as an additional muted row "Refunded (Successful)" with a positive
  amount. **Remove member charge #123:** confirm ("This will adjust the balance on the folio"; Go Back
  / Remove Member Charge); success "Member charge #123 has been successfully removed."; failure "...
  cannot be removed" with a reason. **Refund credit card payment #456:** Refund Type toggle FULL /
  PARTIAL; full shows Total Refund; partial shows an amount input "of $267.50", Total Refund, Cancel
  and "Refund $X"; success "Credit card payment #456 has been successfully refunded $267.50."; after a
  partial refund a new refund is limited to the remaining value (e.g. "of $42.50"). Validation: greater
  than 0 and not above remaining; creates the offsetting row and refreshes balances; disabled when the
  folio is closed; requires a refund permission.
- **Open questions:** Q-44-1 to Q-44-3.

## 4.8 Night Audit run

Excia/Guestrooms-Demo#45. Figma: Night Audit (wizard and history) 12054:62480.

- **Requirements:** "Night Audit Wizard" dialog: **Post Date** field with a **RUN** button and a link
  "Night Audit History >". **Pending Room Charges** table with select-all: Night, Description,
  Occupant, Rate; earlier nights highlighted (orange date) as overdue. Expandable **Additional
  Charges** ("All additional charges will be sent to CMA on post") and **Payments** ("All payments will
  be sent to CMA on post"). Buttons Cancel and **Post Selected Rates**. RUN loads pending charges for
  the date; the selected charges post to CMA on confirm; only checked rows post, with progress, a
  result summary and failures listed per row. Opens from the Schedule Night Audit button (today goes
  to Night Audit History, D-056), the Reservation List and the folio post dialog link. Additional
  Charges and Payments accept entries like 4.10 and 4.11. Cancel discards; Confirm Leaving when entries
  exist. After a run, Undo Check In disappears for affected reservations (2.5) and charges leave the
  unposted state on folios (4.2). System Settings has a Night Audit mode (Run Manually / Run
  Automatically, ticket 7.1).
- **Open questions:** Q-45-1, Q-45-2.

## 4.9 Night Audit History

Excia/Guestrooms-Demo#46. Figma: 12054:62480.

- **Requirements:** title "NIGHT AUDIT HISTORY". Left panel: Back, **Post Date** with **UPDATE**, and
  a **Recent Posts** list of dates. Main: "Posted on MM/DD/YY" table grouped by **batch** ("[Batch ID]
  X Posts", expandable) with Date, Reservation ID, Room, Occupant, Description, Amount; payment rows
  have no checkbox; a batch checkbox selects its reversible rows. Button **REVERSE SELECTED**: a
  dialog warns that after reversing in Guest Rooms the user must still open the batch in **CMA** and
  remove the items there (Go Back / Reverse X Selected); success dialog "X items successfully
  reversed" with the same reminder and an **OPEN CMA** link (new tab, `VITE_CMA_URL`); per-item
  errors; reversed rows disappear or show a reversed status and folios update; empty state for a date
  with no posts. Route exists today as a placeholder (`/night-audit-history`).
- **Open questions:** Q-46-1, Q-46-2.

## 4.10 Manual Charge / Credit dialog

Excia/Guestrooms-Demo#91 (added during refinement). Figma: CTA and dialog 2608:7238.

- **Requirements:** charges and credits added manually by users **with permission**; every item has a
  **SKU** (lookup via the API client; at implementation only certain items sync). **Price** is
  pre-filled from the SKU and disabled, except SKUs configured "Ask for Price", where it is editable
  and accepts positive or negative values. **Quantity** stepper. **Charge / Credit To**: single-select
  autocomplete of each room and named occupant ("Room 1", "Room 1 - Occupant 1"). **Post Date**
  defaults to today, may be earlier but not before the reservation was booked, may be later but not
  after check out; after check out it must be between reservation creation and check out (unit tests
  for before-booked, after-checkout, post-checkout). **Add Item** reveals another line; the trash
  removes a line (not shown for settled lines). Cancel closes with no change; Save adds one
  transaction per line ("Item Name x 2" for quantity above 1); Save disabled when the folio is closed;
  hidden or disabled without permission.
- **Open questions:** Q-91-1, Q-91-2.

## 4.11 Add Deposit / Payment dialog

Excia/Guestrooms-Demo#92 (added during refinement). Figma: CTA and dialog 2610:3540.

- **Requirements:** manual deposits and payments by users with permission, each with a **single
  payment method**. A guest from the reservation must be selected first; methods shown depend on that
  guest; none on file: "Please add a payment method." **Payment amount** defaults to $0.00 and accepts
  any positive value; a negative amount (refund) needs the right permission. **Add Method** starts a
  new method; only credit cards can be added in the system (member charge is attached automatically);
  other methods route to MPOS ("Looking for a different payment method? PROCESS VIA MOBILE POS").
  Cancel closes; **Charge** closes, adds a payment line (with a checkbox like other transactions),
  charges the selected method and updates balances; the payment can be split or selected with other
  transactions to settle. Disabled when the folio is closed. D-002 applies.
- **Open questions:** Q-92-1.

## 4.12 Quick Split and Settle

Excia/Guestrooms-Demo#93 (added during refinement). Figma: Quick Split 16477:82055, Confirmation
17688:27900.

- **Requirements:** **Split by** stepper, full folio balance, split total and a **Difference**; per
  split a **Guest** select (more splits than named occupants allowed), a **Split Amount** and the
  available payment methods with **Add Method**. A Difference not $0.00 shows in red and **Settle is
  disabled**. Fixed browser-based height with scrolling split content (same as 3.9); no option to send
  the split to MPOS. **Confirm Quick Split** lists each guest, amount and payment method (Go Back /
  Confirm & Settle). Settling selected charges uses the action bar "Settle $X"; **Quick Settle**
  settles the whole balance; a card on file adds a Service Fee; MPOS card present adds a Surcharge
  (4.1). State machine: equal split by default, editable amounts, difference to the cent; after settle
  lines show Settled with reference numbers. Shares the dialog component with 3.9; D-002 applies.
- **Open questions:** Q-93-1, Q-93-2.

## 4.13 Split Item

Excia/Guestrooms-Demo#94 (added during refinement). Figma: Split Item After Set 16062:192551, Split
failure single 16492:83658, multi 16492:83703, Line types 16480:83130.

- **Requirements:** the Split action bar button (and the row Split control on split lines) opens the
  dialog: **Split by** stepper, per-split amounts, item total, **difference** (red and Split disabled
  when values do not equal the selection total); **Undo Split** until a child is settled. Several
  unsplit lines create a custom-selection split ("Split Custom Selection (N)"). Once any child is
  settled, split values can no longer be edited (the dialog still opens for reference). A split item
  cannot be split again: only split items selected shows "Item cannot be split" and returns with the
  selection intact; a mixed selection shows the message with **Continue with N selections**. Split
  children cannot be transferred (4.5). Rounding to the cent; tests for custom selection totals.
- **Open questions:** Q-94-1.
