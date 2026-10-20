# Epic 0: Foundation

Epic issue: Excia/Guestrooms-Demo#1 (open on the board; all ten tickets are done). Figma pages:
Navigation + Dashboard, shared components. Back to the [index](../README.md).

Entry fields: **Requirements** (from the ticket), **Implemented** (and where), **Deviations**,
**Assumptions**, **Stubs / placeholders**, **Open questions**, **Status**.

## 0.1 to 0.4: repository, GitHub setup, CI, release-please

Tickets Excia/Guestrooms-Demo#2, Excia/Guestrooms-Demo#3, Excia/Guestrooms-Demo#4, Excia/Guestrooms-Demo#5.

- **Requirements:** scaffold Vite + React + TypeScript + MUI with ESLint, Prettier and Vitest (0.1);
  labels, issue and PR templates, CODEOWNERS (0.2); CI running lint, typecheck, test and build on
  every PR (0.3); release-please for versions, CHANGELOG and release notes (0.4). The ticket bodies
  carry only generic draft criteria.
- **Implemented:** all four, in the initial foundation commit (no PR). Files: `package.json`,
  `eslint.config.js`, `.prettierrc`, `.github/` (CODEOWNERS `* @Excia`, issue templates, PR
  template, `ci.yml`, `pr-title.yml`, `release-please.yml`), `release-please-config.json`.
- **Assumptions:** CI runs on Node 22. CI does not run Prettier.
- **Status:** done (no PR). Releases so far: 1.0.0 (Excia/Guestrooms-Demo#103), 1.1.0
  (Excia/Guestrooms-Demo#105), 1.2.0 (Excia/Guestrooms-Demo#114), 1.3.0 (Excia/Guestrooms-Demo#117).

## 0.5 MUI theme from Figma variables

Ticket Excia/Guestrooms-Demo#6; PR Excia/Guestrooms-Demo#102 (released in 1.0.0). Figma: Dashboard
frame 69:3712 and Header 12047:5668 (token source).

- **Requirements:** `src/theme.ts` defines the palette (primary `#2e7d32` with contrast `#fff`, tint
  `#eaf2ea`, outlined border `#2e7d3280`; text primary `#000000de`, secondary `#00000099`; action
  active `#0000008f`; warning `#c24e00`; error `#d32f2f`; page background `#f1f1f1`; paper `#fff`;
  input border `#0000003b`), `borderRadius: 4`, elevation 2 shadow, Roboto typography (subtitle1
  Medium 18, subtitle2 Medium 14, h4_fixed Bold 16, caption 12, buttons 13/14/15 Medium, input
  value 16, input label 12). Roboto self-hosted (`@fontsource/roboto`, 400/500/700). A Vitest check
  asserts the tokens; no hex values outside `theme.ts` (ESLint rule); light mode only.
- **Implemented:** all of the above. Tokens tested in `src/theme.test.tsx`; ESLint
  `no-restricted-syntax` blocks hex colors in `src/**` outside `theme.ts` and tests. Later tickets
  added theme entries: `palette.schedule` (grid block colors), typography variants `menu_item`,
  `menu_heading`, `list_link`, `button_small`, and hover/focus overrides (D-024, D-028).
- **Deviations:** the outlined input border is `rgba(0,0,0,0.23)` (the `#0000003b` token is 0.231).
  Figma's unnamed `Secondary #545454` is **not mapped** (D-021: the owner decided it is the
  secondary color; follow-up pending). `secondary`, `info`, `success`, `divider`, `text.disabled`
  stay at MUI defaults.
- **Known contrast issues (Figma-fixed values, flagged for design):** primary text on the tint is
  4.49:1 (AA needs 4.5:1); the default outlined border is about 1.74:1 on white (Q-G-17).
- **Reviewer suggestions not taken:** the second `createTheme` pass for the border is redundant
  with MUI's default; the unanchored hex regex can false-positive on strings like `href="#add-room"`.
- **Status:** done.

## 0.6 App shell: GR Header

Ticket Excia/Guestrooms-Demo#7; PR Excia/Guestrooms-Demo#104 (1.1.0). Figma: GR Header component
set 12047:5667 (Desktop 12047:5668, Tablet 12047:5713, Mobile 12047:5692, Menu Open 12047:5743 and
12047:5769).

- **Requirements:** Home logo (calendar icon plus "Guest Rooms") always goes to Schedule; menu icon
  opens the menu and becomes an X on a gray circle while open; Return to Site goes to the main Axis
  site; header 56px tall (mobile 389px wide in Figma); breadcrumbs up to two parents plus the current
  page; `aria-expanded`, `header` landmark, logical tab order; exact label "Return to Site".
- **Implemented:** `src/components/AppHeader.tsx`, `src/AppShell.tsx`, `src/app/axisUrl.ts`.
  Header measured 56px at 389, 768 and 1280px. The X and Escape close the menu and return focus to
  the menu button (Escape ignores events already handled by nested popovers). Skip-to-content link;
  2px focus-visible ring from the theme. Below 600px Return to Site is icon-only with the same
  accessible name. `/` redirects to `/schedule` (query string kept). Unknown paths render "Not found"
  inside the shell.
- **Deviations:** breadcrumbs removed by the owner (D-020), contrary to the ticket text. MUI icons
  stand in for the Figma SVGs (the calendar logo is the likeliest to differ). Return to Site is two
  elements in the DOM (button and icon button) toggled by CSS.
- **Assumptions:** `VITE_AXIS_URL` accepts only http(s) or a same-origin path; anything else falls
  back to `/` with a dev warning (D-049).
- **Stubs / placeholders:** `.env.example` uses `https://axis.example.com`; the real URL per
  environment is **Unknown** (Q-G-2). Figma tablet and Menu Open tablet/mobile frames were not read
  in full.
- **Status:** done.

## 0.7 Menu overlay

Ticket Excia/Guestrooms-Demo#8; PR Excia/Guestrooms-Demo#106 (1.1.0). Figma: Menu Overlay
1302:18036 (Admin 1302:18023, NoAdmin 1302:18030).

- **Requirements:** a distinct Dashboard button at the top; Reservation Management column (Schedule
  | Home, Reservations, Open Folios, Waitlist, Night Audit History, Add-On Countdown, Room Blocks,
  Member Directory, Reporting); Admin Setup column (Primary Setup, Rate Categories, Room Types, Rooms,
  Add-On Items, Notifications); non-admin variant adds Return to Site; zero Admin Setup access gives
  one column; every link routes; closes on close icon, Escape, route change, backdrop click; focus
  trapped while open and returned to the menu button.
- **Implemented:** `src/components/MenuOverlay.tsx`, `src/app/menu.ts` (`buildMenu`),
  `src/app/routes.ts`, `src/app/focusLoop.ts`. Inline overlay (not a MUI Modal; the first design hid
  the close button from keyboard users). Header stays in the accessibility tree; `<main>` and the
  skip link are inert while open. Two columns from 900px, one column below.
- **Deviations (owner decisions):** scale 0.7 (D-022), floating 24px inset panel (D-023), hover tint
  (D-024). The Dashboard button follows Figma (solid primary) rather than the ticket's
  "primary-tinted" (Q-G-10). The menu stacks below 900px while the project rule is 1200px (Q-G-9).
  "Return to Site" appears twice at 768px and wider in the non-admin layout, as Figma shows
  (Q-G-11). Mobile is one column (no mobile design).
- **Assumptions:** no body scroll lock while open; focus returns to the menu button after choosing a
  link, not to the new page.
- **Stubs:** every menu route renders a placeholder page except Dashboard and Schedule.
- **Status:** done.

## 0.8 Role-based access

Ticket Excia/Guestrooms-Demo#9; PR Excia/Guestrooms-Demo#110 (1.2.0). No Figma frame (behavior from
Menu Overlay annotations).

- **Requirements:** a `useAccess()` hook exposing per-area permissions; the six Admin Setup pages are
  the admin areas; menu and dashboard read from it; direct navigation to an Admin Setup URL without
  access redirects to the dashboard with a non-actionable message; dev mock user switcher; granular
  `can(permission)` backed by the mock with one registry (D-009).
- **Implemented:** `src/app/permissions.ts`, `access.ts`, `AccessProvider.tsx`, `useAccess.ts`,
  `components/RequireAccess.tsx`, `AccessDeniedNotice.tsx`, `DevUserSwitcher.tsx`, `src/api/grant.ts`,
  `src/api/mockUsers.ts`. States: "Checking access" (loading), "Access could not be checked"
  (error), "Site not configured" (unconfigured), and a dismissible "No access" dialog shown once that
  returns focus to `<main>`. See [permissions.md](../permissions.md).
- **Decisions:** D-032 to D-035, D-037. Hiding links is not authorization; the backend must enforce
  access on every request.
- **Deviations:** none from the ticket; it combines `admin` OR `page.<id>` (D-034).
- **Open questions:** the grant vocabulary with the backend (Q-G-4); the Permissions page design
  (Q-G-1); the grant is fetched once so a revoked role takes effect on reload; the permission
  mapping of the New Reservation results route (Q-G-16).
- **Known minor issue:** focus moves to `<main>` about 200 ms after the dialog closes even if the user
  already moved focus.
- **Status:** done.

## 0.9 Shared components

Ticket Excia/Guestrooms-Demo#10; PR Excia/Guestrooms-Demo#108 (1.2.0). Figma (Reporting page):
Select 79:8624, Pagination 20:2576, Date Selection 120:8668, Location Filter 120:6825, Confirm
Leaving 88:4839, Non-Actionable 441:13871, Save Toast 69:4219.

- **Requirements:** themed `Select`; `Pagination` (rows-per-page, page items, range text);
  `DateSelection` with eight states (Custom, This Week, Month, As Of, Single Day, Compare,
  Compare-Month, Compare-AsOf) returning a typed value; `LocationFilter` (CTA and field variants,
  "All Locations" default); `ConfirmDialog` and `NonActionableDialog` with focus management;
  `SaveToast` with a live region; a demo route listing every component and state.
- **Implemented:** `src/components/shared/*`, `src/app/dateSelection.ts`, `pagination.ts`,
  `locationSelection.ts`; demo route `/dev/components` (dev only, lazy, absent from production).
  Selecting every location is reported as `[]`. The primary action of a dialog is focused on mount;
  Enter right after opening fires only the primary action. The toast restarts on a new `saveId` and
  does not auto-dismiss while an Undo action shows.
- **Deviations / assumptions:** D-046 to D-048 (comparison defaults, Sunday week start, toast
  bottom-left, Pagination design, half-width native date fields). Location Filter error color is the
  theme's `#d32f2f` (Figma `#B3261E`); field 200px vs Figma about 192px; Select/date field height 57px
  vs Figma 56px.
- **Notes:** `thisWeek` and `asOf` store materialised dates, so persisted values go stale (decide
  before report tickets, Q-10-3). `onChange` may emit invalid values; consumers check
  `isValidValue`. Dates now use the themed calendar from Excia/Guestrooms-Demo#116 (D-026, D-027).
- **Out of scope:** report-specific Column Filter and Group By (Epic 6).
- **Status:** done.

## 0.10 API client layer and mock data

Ticket Excia/Guestrooms-Demo#11; PR Excia/Guestrooms-Demo#107 (1.1.0). No Figma.

- **Requirements:** typed client with one module per area; mock with realistic data (rate
  categories, room blocks, unassigned charges count); swapping to a real base URL is config only;
  loading, empty and error states exercised by mock scenarios.
- **Implemented:** `src/api/` (see [api-contract.md](../api-contract.md) and
  [overview.md](../overview.md) for the build matrix). Scenarios: `normal`, `loading` (never
  settles), `empty`, `error` (500). Mock latency 300 ms in the app, 0 in tests.
- **Decisions:** D-036 to D-039. **Not done:** branded `Cents`/`IsoDate` types; mutation
  conventions beyond the schedule and reservation panel (deferred to the tickets that write data).
- **Placeholders:** rate category names, room names and block reasons are invented
  (see [placeholders.md](../placeholders.md)).
- **Status:** done.

## Work outside the tickets

- Manager agent, specialist agents and board helper: Excia/Guestrooms-Demo#101 (D-071 to D-073).
- Owner UX feedback pass: Excia/Guestrooms-Demo#116 (D-026 to D-031).
- Requirements log (this folder): D-074.
