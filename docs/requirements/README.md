# Guest Rooms requirements log

The running record of what the Guest Rooms product must do, what is built, what was decided,
what the backend must provide and what is still unanswered. When the product is put together,
this folder is the one place that captures every system requirement, decision, API need and open
question.

**Snapshot:** 2026-10-21, `main` at commit 288dd56 (package version 1.3.0; PR #119 is merged but not
yet in a release). No PR is open for a ticket; ticket 2.3 (Excia/Guestrooms-Demo#20) is in progress on
branch `feat/20-change-room-during-stay`. Tickets are GitHub issues in
Excia/Guestrooms-Demo; each ticket body is the spec, and its acceptance criteria are the
definition of done. Figma file: CE Guest Rooms (key `WksR3zAy2S8cDsjrVvRklE`).

Sources are the project instructions (`CLAUDE.md`), the README API conventions, the typed API
contract and mock in `src/`, every merged and open PR body, every ticket body and the owner's
planning notes (`open-questions.md` and `guestrooms-epics-and-tickets-draft.md`, kept outside
the repo). Nothing here is invented: where a value is not known the text says **Unknown**.

## How to read it

| I want to know...                                                   | Read                                       |
| ------------------------------------------------------------------- | ------------------------------------------ |
| What the product is, who uses it, how it is built and configured    | [overview.md](overview.md)                 |
| Why something works the way it does, and when it was decided        | [decisions.md](decisions.md)               |
| What one screen or ticket must do, what exists, and what is stubbed | [features/](features/) (one file per epic) |
| What the backend has to provide (endpoints, errors, rules)          | [api-contract.md](api-contract.md)         |
| Who may do what                                                     | [permissions.md](permissions.md)           |
| What is still undecided, and the default built meanwhile            | [open-questions.md](open-questions.md)     |
| What invented sample data must be replaced, and where it lives      | [placeholders.md](placeholders.md)         |
| Where the build differs from Figma, and which frames are missing    | [figma-deviations.md](figma-deviations.md) |
| What a domain word means                                            | [glossary.md](glossary.md)                 |
| Accessibility, responsive, performance, security and test rules     | [nonfunctional.md](nonfunctional.md)       |
| A blank entry to copy when documenting a ticket                     | [TEMPLATE-ticket.md](TEMPLATE-ticket.md)   |

### Vocabulary

| Term                            | Meaning                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| done                            | merged to `main`                                                                                                                                           |
| in review                       | a PR is open and not merged                                                                                                                                |
| in progress                     | work is under way and not yet in a PR, or a PR is being changed (used inside entries)                                                                      |
| not started                     | nothing built beyond a route and a placeholder page                                                                                                        |
| needs design                    | the ticket cannot be built until a Figma design exists                                                                                                     |
| requested by owner, in progress | an owner decision that is being implemented now (none at this snapshot; the ones from PR #119 are "implemented (PR #119)" in [decisions.md](decisions.md)) |
| open / answered                 | state of a question in [open-questions.md](open-questions.md)                                                                                              |

Numbers: `Excia/Guestrooms-Demo#N` is an issue (ticket) or a pull request in this repository
(issues and PRs share one number space; issues 1 to 100, PRs 101 and up). Ticket labels such as
"2.2" are the numbers in the ticket titles; question ids look like `Q-18-1` (ticket 18, question 1)
or `Q-G-1` (global). Decision ids look like `D-023`.

## How it stays current

Every PR that changes behavior, the API, permissions or a decision, or that answers an open
question, updates the matching file here in the same PR. The mapping is in
[CONTRIBUTING.md](../../CONTRIBUTING.md#requirements-log); the PR template has a checkbox for it and
the Manager agent checks it before opening a PR. In short:

| Change                                                                      | File to update                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A ticket's behavior, status, PR link, stubs, deviations                     | the epic file in [features/](features/) (use [TEMPLATE-ticket.md](TEMPLATE-ticket.md)) and the status tables below |
| A decision, an owner message, a changed default                             | [decisions.md](decisions.md)                                                                                       |
| A new or changed endpoint, header, error code or backend rule               | [api-contract.md](api-contract.md)                                                                                 |
| A new permission or a changed mock user                                     | [permissions.md](permissions.md)                                                                                   |
| A new question, or an answer (set status to answered, with date and answer) | [open-questions.md](open-questions.md)                                                                             |
| New invented sample data, or a placeholder replaced by the real value       | [placeholders.md](placeholders.md)                                                                                 |
| A difference from Figma, or a missing frame                                 | [figma-deviations.md](figma-deviations.md)                                                                         |
| New env variable, route, build switch or architecture change                | [overview.md](overview.md)                                                                                         |
| A new domain word                                                           | [glossary.md](glossary.md)                                                                                         |
| A new accessibility, responsive, performance, security or test rule         | [nonfunctional.md](nonfunctional.md)                                                                               |

When a PR merges, change the ticket's status in the tables below. If the PR template box is
ticked "n/a", the PR description must say why.

## Status summary

| Status        | Tickets |
| ------------- | ------- |
| done          | 16      |
| in review     | 0       |
| in progress   | 1       |
| not started   | 71      |
| total tickets | 88      |

### Epic Foundation

Issue Excia/Guestrooms-Demo#1. Epic status: **done**. Details: [features/00-foundation.md](features/00-foundation.md).

| Ticket                   | Title                                                                                                                                                | Status | PR                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------- |
| Excia/Guestrooms-Demo#2  | [0.1] Scaffold Vite + React + TS + MUI app, ESLint, Prettier, Vitest                                                                                 | done   | initial foundation commit (no PR) |
| Excia/Guestrooms-Demo#3  | [0.2] GitHub setup: labels, issue and PR templates, CODEOWNERS                                                                                       | done   | initial foundation commit (no PR) |
| Excia/Guestrooms-Demo#4  | [0.3] CI: lint, typecheck, test, build on every PR                                                                                                   | done   | initial foundation commit (no PR) |
| Excia/Guestrooms-Demo#5  | [0.4] release-please: versioning, CHANGELOG, release notes                                                                                           | done   | initial foundation commit (no PR) |
| Excia/Guestrooms-Demo#6  | [0.5] MUI theme from Figma variables (colors, type, spacing); light only first                                                                       | done   | Excia/Guestrooms-Demo#102         |
| Excia/Guestrooms-Demo#7  | [0.6] App shell: GR Header (desktop, tablet, mobile) with breadcrumbs and Return to Site                                                             | done   | Excia/Guestrooms-Demo#104         |
| Excia/Guestrooms-Demo#8  | [0.7] Menu overlay with Admin and non-admin variants, routing for every menu item                                                                    | done   | Excia/Guestrooms-Demo#106         |
| Excia/Guestrooms-Demo#9  | [0.8] Role-based access (Admin vs non-admin menu and routes)                                                                                         | done   | Excia/Guestrooms-Demo#110         |
| Excia/Guestrooms-Demo#10 | [0.9] Shared components: Select, Pagination, Date Selection, Location Filter, Confirm Leaving dialog, Non-Actionable dialog, Save Confirmation toast | done   | Excia/Guestrooms-Demo#108         |
| Excia/Guestrooms-Demo#11 | [0.10] API client layer and mock data                                                                                                                | done   | Excia/Guestrooms-Demo#107         |

### Epic Dashboard

Issue Excia/Guestrooms-Demo#12. Epic status: **done**. Details: [features/01-dashboard.md](features/01-dashboard.md).

| Ticket                   | Title                                                                                                        | Status | PR                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| Excia/Guestrooms-Demo#13 | [1.1] Dashboard layout (3 columns)                                                                           | done   | Excia/Guestrooms-Demo#109, Excia/Guestrooms-Demo#115 |
| Excia/Guestrooms-Demo#14 | [1.2] Quick Stats panel with Day, Week, Month views (occupancy, revenue, avg rate, nights, by rate category) | done   | Excia/Guestrooms-Demo#113                            |
| Excia/Guestrooms-Demo#15 | [1.3] Reservation Management shortcut list with Unassigned Charges count badge                               | done   | Excia/Guestrooms-Demo#111                            |
| Excia/Guestrooms-Demo#16 | [1.4] New Reservation search (dates, location, multi-room guests, add/remove room)                           | done   | Excia/Guestrooms-Demo#112, Excia/Guestrooms-Demo#115 |

### Epic Schedule | Home

Issue Excia/Guestrooms-Demo#17. Epic status: **in progress**. Details: [features/02-schedule.md](features/02-schedule.md).

| Ticket                   | Title                                           | Status      | PR                                                  |
| ------------------------ | ----------------------------------------------- | ----------- | --------------------------------------------------- |
| Excia/Guestrooms-Demo#18 | [2.1] Schedule grid (rooms by dates)            | done        | Excia/Guestrooms-Demo#118 (merged 2026-10-20)       |
| Excia/Guestrooms-Demo#19 | [2.2] Reservation details panel with split CTA  | done        | Excia/Guestrooms-Demo#119 (merged 2026-10-21)       |
| Excia/Guestrooms-Demo#20 | [2.3] Change room during stay (menu and dialog) | in progress | none yet (branch `feat/20-change-room-during-stay`) |
| Excia/Guestrooms-Demo#21 | [2.4] Schedule blocks and linked room blocks    | not started |                                                     |
| Excia/Guestrooms-Demo#22 | [2.5] Reservation menus and multi-room selector | not started |                                                     |

### Epic Reservations

Issue Excia/Guestrooms-Demo#23. Epic status: **not started**. Details: [features/03-reservations.md](features/03-reservations.md).

| Ticket                   | Title                                                                                           | Status                                                  | PR  |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --- |
| Excia/Guestrooms-Demo#24 | [3.1] Reservation List with bulk actions                                                        | built on branch `feat/24-reservation-list` (PR pending) |     |
| Excia/Guestrooms-Demo#25 | [3.2] Bulk check-in: success dialog and mixed-result dialog                                     | not started                                             |     |
| Excia/Guestrooms-Demo#26 | [3.3] Reservation Hub layout (left column, guest column, notes column, header, CTAs)            | not started                                             |     |
| Excia/Guestrooms-Demo#27 | [3.4] Hub states: single room and multi room                                                    | not started                                             |     |
| Excia/Guestrooms-Demo#28 | [3.5] Check in, including check in after date and failure dialogs                               | not started                                             |     |
| Excia/Guestrooms-Demo#29 | [3.6] Keycards: encode, in progress, done, error/timeout, manage (0, 1, 3 active)               | not started                                             |     |
| Excia/Guestrooms-Demo#30 | [3.7] Update contact info dialog and guest edit state                                           | not started                                             |     |
| Excia/Guestrooms-Demo#31 | [3.8] Adjust rate dialog (hub only)                                                             | not started                                             |     |
| Excia/Guestrooms-Demo#32 | [3.9] Payment methods dialog, including penny auth processing and declined                      | not started                                             |     |
| Excia/Guestrooms-Demo#33 | [3.10] Add-on items on reservation                                                              | not started                                             |     |
| Excia/Guestrooms-Demo#34 | [3.11] Owner / Member / Guest treatment (system setting, room setup, reservation treatments)    | not started                                             |     |
| Excia/Guestrooms-Demo#35 | [3.12] Early check-in and late check-out (system setting, states and variations, details panel) | not started                                             |     |
| Excia/Guestrooms-Demo#36 | [3.13] Manual send (email to guest) and "no mail" state                                         | not started                                             |     |

### Epic Folios and Night Audit

Issue Excia/Guestrooms-Demo#37. Epic status: **not started**. Details: [features/04-folios-night-audit.md](features/04-folios-night-audit.md).

| Ticket                   | Title                                                                 | Status                     | PR  |
| ------------------------ | --------------------------------------------------------------------- | -------------------------- | --- |
| Excia/Guestrooms-Demo#38 | [4.1] Folio view: charges, payments, balance summary, occupant filter | in review                  |     |
| Excia/Guestrooms-Demo#39 | [4.2] Folio line type variations                                      | not started                |     |
| Excia/Guestrooms-Demo#40 | [4.3] Open Folios list                                                | not started (needs design) |     |
| Excia/Guestrooms-Demo#41 | [4.4] Unassigned Charges list                                         | not started                |     |
| Excia/Guestrooms-Demo#42 | [4.5] Item transfer dialog                                            | not started                |     |
| Excia/Guestrooms-Demo#43 | [4.6] Reverse check                                                   | not started                |     |
| Excia/Guestrooms-Demo#44 | [4.7] Remove / refund payments                                        | not started                |     |
| Excia/Guestrooms-Demo#45 | [4.8] Night Audit run                                                 | not started                |     |
| Excia/Guestrooms-Demo#46 | [4.9] Night Audit History                                             | not started                |     |
| Excia/Guestrooms-Demo#91 | [4.10] Manual Charge / Credit dialog                                  | not started                |     |
| Excia/Guestrooms-Demo#92 | [4.11] Add Deposit / Payment dialog                                   | not started                |     |
| Excia/Guestrooms-Demo#93 | [4.12] Quick Split and Settle                                         | not started                |     |
| Excia/Guestrooms-Demo#94 | [4.13] Split Item (split a charge into parts)                         | not started                |     |

### Epic Online Booking

Issue Excia/Guestrooms-Demo#47. Epic status: **not started**. Details: [features/05-online-booking.md](features/05-online-booking.md).

| Ticket                   | Title                                                                              | Status      | PR  |
| ------------------------ | ---------------------------------------------------------------------------------- | ----------- | --- |
| Excia/Guestrooms-Demo#48 | [5.1] Online booking header, account menu, return to site tooltip                  | in review   |     |
| Excia/Guestrooms-Demo#49 | [5.2] Reservation widget and adjust search                                         | not started |     |
| Excia/Guestrooms-Demo#50 | [5.3] Results cards: member vs non-member, single vs multi room, room vs room type | not started |     |
| Excia/Guestrooms-Demo#51 | [5.4] Guest selection, name guests, secondary occupant                             | not started |     |
| Excia/Guestrooms-Demo#52 | [5.5] Stay summary, fee line items, review details                                 | not started |     |
| Excia/Guestrooms-Demo#53 | [5.6] Payment: credit card fields, payment method menu, CTA bar                    | not started |     |
| Excia/Guestrooms-Demo#54 | [5.7] My Reservations and cancellation dialogs                                     | not started |     |
| Excia/Guestrooms-Demo#55 | [5.8] Mobile layout with stepper                                                   | not started |     |
| Excia/Guestrooms-Demo#98 | [5.9] Booking confirmation and online reservation hub                              | not started |     |
| Excia/Guestrooms-Demo#99 | [5.10] Sign-in prompt for guest and member                                         | not started |     |

### Epic Reporting

Issue Excia/Guestrooms-Demo#56. Epic status: **not started**. Details: [features/06-reporting.md](features/06-reporting.md).

| Ticket                   | Title                                                                                              | Status      | PR  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------- | --- |
| Excia/Guestrooms-Demo#57 | [6.1] Reporting landing page                                                                       | not started |     |
| Excia/Guestrooms-Demo#58 | [6.2] Standard report shell: filters, column filter, group-by, view and export options, pagination | not started |     |
| Excia/Guestrooms-Demo#59 | [6.3] Custom report builder: column list, group-by list, save split menu, save toast               | not started |     |
| Excia/Guestrooms-Demo#60 | [6.4] Report: Housekeeping (types and statuses logic from the Figma note)                          | not started |     |
| Excia/Guestrooms-Demo#61 | [6.5] Reports: Room Arrival, Room Departure, Room Cancellation lists                               | not started |     |
| Excia/Guestrooms-Demo#62 | [6.6] Reports: Daily Occupancy Compare, Occupancy Summary                                          | not started |     |
| Excia/Guestrooms-Demo#63 | [6.7] Reports: Rooms Sold and Rooms Sold Compare                                                   | not started |     |
| Excia/Guestrooms-Demo#64 | [6.8] Reports: Month End, Month End Compare, Month End by Location                                 | not started |     |
| Excia/Guestrooms-Demo#65 | [6.9] Reports: Room Guest List, Reservations by Room Type                                          | not started |     |
| Excia/Guestrooms-Demo#66 | [6.10] Reports: Sales Forecast and Compare, Outstanding Folio Balance                              | not started |     |
| Excia/Guestrooms-Demo#67 | [6.11] Reports: Owner Report (standard, counts only, grouped by owner)                             | not started |     |
| Excia/Guestrooms-Demo#68 | [6.12] Room Revenue Report and groupings                                                           | not started |     |

### Epic Admin Setup

Issue Excia/Guestrooms-Demo#69. Epic status: **not started**. Details: [features/07-admin-setup.md](features/07-admin-setup.md).

| Ticket                   | Title                                                                         | Status                     | PR  |
| ------------------------ | ----------------------------------------------------------------------------- | -------------------------- | --- |
| Excia/Guestrooms-Demo#70 | [7.1] Primary Setup / System Settings                                         | not started                |     |
| Excia/Guestrooms-Demo#71 | [7.2] Rate Categories                                                         | not started (needs design) |     |
| Excia/Guestrooms-Demo#72 | [7.3] Room Types and Rooms (associations, quantity picker, image placeholder) | not started                |     |
| Excia/Guestrooms-Demo#73 | [7.4] Add-On Items                                                            | not started                |     |
| Excia/Guestrooms-Demo#74 | [7.5] Booking Rules                                                           | not started                |     |
| Excia/Guestrooms-Demo#75 | [7.6] Keycard Integration settings                                            | not started                |     |
| Excia/Guestrooms-Demo#76 | [7.7] Migration Tool                                                          | not started                |     |
| Excia/Guestrooms-Demo#95 | [7.8] Registration Card setting and PDF                                       | not started                |     |
| Excia/Guestrooms-Demo#96 | [7.9] Online Booking settings tab                                             | not started                |     |
| Excia/Guestrooms-Demo#97 | [7.10] Change Log overlay (admin pages)                                       | not started                |     |

### Epic Notifications

Issue Excia/Guestrooms-Demo#77. Epic status: **not started**. Details: [features/08-notifications.md](features/08-notifications.md).

| Ticket                    | Title                                                            | Status      | PR  |
| ------------------------- | ---------------------------------------------------------------- | ----------- | --- |
| Excia/Guestrooms-Demo#78  | [8.1] Reservation-triggered notifications list and editor        | not started |     |
| Excia/Guestrooms-Demo#79  | [8.2] Scheduled notifications                                    | not started |     |
| Excia/Guestrooms-Demo#80  | [8.3] Recipients (attendee, admin) and attachments               | not started |     |
| Excia/Guestrooms-Demo#81  | [8.4] New notification options and prompt-before-sending tooltip | not started |     |
| Excia/Guestrooms-Demo#100 | [8.5] Notification content editor and snippets                   | not started |     |

### Epic Support Tickets

Issue Excia/Guestrooms-Demo#82. Epic status: **not started** (needs design). Details: [features/09-support-undesigned-design-qa.md](features/09-support-undesigned-design-qa.md).

| Ticket | Title                                   | Status      | PR  |
| ------ | --------------------------------------- | ----------- | --- |
| (none) | No tickets. Both Figma pages are empty. | not started |     |

### Epic Menu items with no design yet

Issue Excia/Guestrooms-Demo#83. Epic status: **not started** (needs design). Details: [features/09-support-undesigned-design-qa.md](features/09-support-undesigned-design-qa.md).

| Ticket                   | Title                                                        | Status                     | PR  |
| ------------------------ | ------------------------------------------------------------ | -------------------------- | --- |
| Excia/Guestrooms-Demo#84 | [10.1] Design and build Waitlist                             | not started (needs design) |     |
| Excia/Guestrooms-Demo#85 | [10.2] Design and build Add-On Countdown                     | not started (needs design) |     |
| Excia/Guestrooms-Demo#86 | [10.3] Design and build Member Directory                     | not started (needs design) |     |
| Excia/Guestrooms-Demo#87 | [10.4] Design and build Room Blocks (beyond Schedule blocks) | not started (needs design) |     |

### Epic Design QA

Issue Excia/Guestrooms-Demo#88. Epic status: **not started**. Details: [features/09-support-undesigned-design-qa.md](features/09-support-undesigned-design-qa.md).

| Ticket                   | Title                                                                                                | Status      | PR  |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ----------- | --- |
| Excia/Guestrooms-Demo#89 | [11.1] Standardize "Return to Site" capitalization (Figma has "Return to SITE" and "Return to Site") | not started |     |
| Excia/Guestrooms-Demo#90 | [11.2] Standardize button label casing across the product                                            | not started |     |

### Work without a ticket

| Item                              | What                                                                                                                                                                                                                                                                                     | Status | PR                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Manager agent                     | `/run-manager` command, six specialist agents, `scripts/board.py`, `docs/MANAGER.md`                                                                                                                                                                                                     | done   | Excia/Guestrooms-Demo#101                                                                                  |
| Owner UX feedback                 | Themed calendar, one range calendar for check-in/check-out, quantity picker divider, message colors, menu hover tint (follows 1.4, 0.9 and the theme)                                                                                                                                    | done   | Excia/Guestrooms-Demo#116                                                                                  |
| Release PRs                       | release-please releases 1.0.0 (#103), 1.1.0 (#105), 1.2.0 (#114), 1.3.0 (#117)                                                                                                                                                                                                           | done   | Excia/Guestrooms-Demo#103, Excia/Guestrooms-Demo#105, Excia/Guestrooms-Demo#114, Excia/Guestrooms-Demo#117 |
| Reservation panel owner decisions | Right side drawer (side is one setting), Booking Guest TBD with member picker, optional Lead Occupant, Unassigned cascading dropdowns, empty-cell click opens New Reservation, green close X, New Room Closure tab, and the other owner feedback (D-057, D-063 to D-069, D-079 to D-085) | done   | Excia/Guestrooms-Demo#119                                                                                  |
| Requirements log                  | this folder (first version, then updated for PR #119 and #118 on branch `docs/requirements-panel-update`)                                                                                                                                                                                | done   | Excia/Guestrooms-Demo#120 (update not merged yet)                                                          |

## Build order and epic status

Epic issues stay open on the board until the epic is closed by hand; "done" here means every
ticket under it is done. Suggested build order (owner's draft, 2026-10): 0 Foundation,
1 Dashboard, 3 Reservations, 4 Folios, 2 Schedule, 8 Notifications, 7 Admin Setup, 6 Reporting,
5 Online Booking. Admin Setup could move earlier if reservations depend on rooms and rates data.
