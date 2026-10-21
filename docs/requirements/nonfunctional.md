# Non-functional requirements

Accessibility, responsive, performance, security, testing and browser notes, as stated in `CLAUDE.md`,
the tickets and the PR evidence. Back to the [index](README.md).

## Accessibility

Rule (CLAUDE.md, every ticket): accessible by default: labels, roles, keyboard operation, visible focus,
WCAG AA contrast.

| Rule                        | Detail                                                                                                                                                                                                                                                                 | Source                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Visible focus               | 2px primary outline with 2px offset on every ButtonBase and link; inside the tab for Tabs; menu options use an inset outline. Re-check list items when new ones arrive                                                                                                 | `src/theme.ts`; Excia/Guestrooms-Demo#104         |
| Landmarks and skip link     | `<header>` banner, `<main>`, skip-to-content link; one visually hidden `<h1>` per page (dashboard)                                                                                                                                                                     | Excia/Guestrooms-Demo#104, #109                   |
| Menu overlay                | Header stays in the accessibility tree; `<main>` and the skip link are inert while open; Tab loops over header controls and panel; focus returns to the menu button on every close path; not a MUI Modal (a backdrop that hides the close button fails keyboard users) | Excia/Guestrooms-Demo#106                         |
| Dialogs                     | Primary action focused on mount; Enter right after opening fires only the primary action; Escape closes and returns focus; destructive button not the default focus (planned)                                                                                          | Excia/Guestrooms-Demo#108, #43                    |
| Live regions                | Toast has a persistent hidden `role="status"`; Quick Stats has one persistent live region; New Reservation announces "Room N added/removed" and invalid dates; schedule drags and keyboard moves announce; Early/Late save states announced politely                   | Excia/Guestrooms-Demo#108, #112, #113, #118, #119 |
| Tabs                        | `role="tablist"`, tabpanels, manual activation, arrows/Home/End                                                                                                                                                                                                        | Excia/Guestrooms-Demo#113                         |
| Grid                        | `role=grid` with column and row headers and named gridcells; one tab stop with `aria-activedescendant`; keyboard move: Enter/Space/M to pick up, arrows, Enter to drop, Escape to cancel                                                                               | Excia/Guestrooms-Demo#118, #119                   |
| Calendar                    | Grid with day names, `aria-selected` only on the real range ends, roving focus (arrows, PageUp/PageDown, Home/End), focus to a day on open and back to the field on close, 24px icon button, Alt+Down opens our calendar                                               | Excia/Guestrooms-Demo#116                         |
| Numbers                     | Right-aligned tabular figures; tables with row headers; percent icon carries the "%"                                                                                                                                                                                   | Excia/Guestrooms-Demo#113                         |
| Not by color alone          | Folio line states differ by color and icon (planned); disabled limit buttons use `aria-disabled` so focus stays                                                                                                                                                        | Excia/Guestrooms-Demo#39, #112                    |
| Unavailable actions say why | An action that is not available yet stays focusable with `aria-disabled` and its reason as the accessible description (and a tooltip): the Change Room action; disabled options of a listbox carry `aria-disabled` and the reason as text and `aria-describedby`       | Excia/Guestrooms-Demo#20                          |
| Names                       | Steppers are groups named "Adults, Room 2" with "Decrease/Increase Adults, Room 2"; badge name "Unassigned Charges, 10 unassigned charges" with the digit `aria-hidden`                                                                                                | Excia/Guestrooms-Demo#112, #111                   |
| Contrast                    | WCAG AA. Known Figma pairs below AA: primary text on the tint 4.49:1; default outlined border about 1.74:1 on white (Q-G-17)                                                                                                                                           | Excia/Guestrooms-Demo#102, #106                   |
| Motion / timers             | A toast with Undo never auto-dismisses; the hold timer warns under 1 minute and is announced                                                                                                                                                                           | Excia/Guestrooms-Demo#108, #119                   |

## Responsive

- Admin screens are **desktop-first**; below **1200px** columns stack and tables scroll; no tablet-specific
  designs are required (D-010). The dashboard stacks below 1200px; the details panel is full width below
  1200px; the menu overlay stacks below 900px (Q-G-9) and is one column on mobile.
- The header is 56px at 389, 768 and 1280px; below 600px Return to Site is icon only.
- Online booking has real mobile designs (ticket 5.8): collapsible Adjust Search, mobile stepper with the
  hold timer above it, fixed room selector and fixed CTA bar, full-screen details overlay, bottom-fixed
  Edit/Cancel split button; the Axis-embedded mobile app replaces the Guest Rooms mobile navigation.
- Verified widths so far: 389, 768, 1100, 1199, 1200, 1280, 1440, 1512, 2560 (dashboard QA).

## Performance targets

| Target                                                                        | Evidence                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule: 200 rooms x 30 days stays responsive (virtualized rows)             | `?schedule=large`: about 17 rows rendered; first rows about 1.1 s; median scroll frame 16.7 ms; 30-day vertical scroll p95 about 33 ms (headless Chrome, software rendering) (Excia/Guestrooms-Demo#118)                  |
| Room list in the panel handles all 200 rooms                                  | PR Excia/Guestrooms-Demo#119                                                                                                                                                                                              |
| Bundle: lazy pages and mock                                                   | Schedule is its own 63.5 kB chunk (main chunk +4.8 kB); main chunk about 421.58 kB when the shared components landed; the mock is a separate lazy chunk; the dev gallery and dev user switcher are absent from production |
| Reports (planned): virtualized results for large reports, sticky first column | Ticket 6.2 (Excia/Guestrooms-Demo#58)                                                                                                                                                                                     |
| Request budget                                                                | 15 s API timeout; stale responses aborted; no refetch on half-typed dates                                                                                                                                                 |
| Popover performance                                                           | Follow-up: memoise calendar day cells (Excia/Guestrooms-Demo#116)                                                                                                                                                         |

Targets for page load times, API latency and uptime are **Unknown** (none stated).

## Security

| Rule                           | Detail                                                                                                                                            | Source                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Fail-closed permissions        | Default deny; unknown ids deny; loading/error deny; malformed grants deny                                                                         | D-032                             |
| UI hiding is not authorization | The backend must enforce access on every request ([api-contract.md](api-contract.md#server-side-enforcement))                                     | Excia/Guestrooms-Demo#110         |
| No secrets in `VITE_*`         | Public configuration only; `.env.example` says so                                                                                                 | `.env.example`, README            |
| API URL validation             | Absolute http(s) only; credentials in the URL rejected; `http` outside localhost warns; an invalid URL is never replaced by mock data outside dev | `src/api/config.ts`               |
| Open redirect                  | `VITE_AXIS_URL` accepts only http(s) URLs or same-origin paths and rejects backslashes and control characters                                     | `src/app/axisUrl.ts`              |
| XSS-safe error text            | Server `message` and `details` are untrusted and rendered as text only; rich notification bodies must be sanitized (planned, 8.5)                 | README; Excia/Guestrooms-Demo#100 |
| Path safety                    | Ids go through `encodeURIComponent`; empty, `.` and `..` rejected                                                                                 | `src/api/validation.ts`           |
| Idempotent, guarded mutations  | `requestId` as `Idempotency-Key` plus version/expected state                                                                                      | D-054                             |
| URL inputs are untrusted       | Schedule and search URLs parse tolerantly; the results page must validate `location`                                                              | Excia/Guestrooms-Demo#112, #118   |
| Cards                          | No card data touches our servers; hosted fields; gateway undecided                                                                                | D-002                             |
| Credentials and CSRF           | Not designed; the auth layer owns them                                                                                                            | Q-G-4                             |
| Dev-only code                  | Dev user switcher, component gallery and mock URL overrides are absent from or ignored in production builds                                       | Excia/Guestrooms-Demo#108, #110   |
| Demo builds                    | Run as the Administrator with a visible "Demo data" chip                                                                                          | D-033                             |
| Agents                         | Never merge, push to `main`, change repo, branch-protection or Actions settings, or edit Figma                                                    | D-071                             |

## Testing strategy

- **Unit tests (Vitest)** for every business rule, as pure functions separate from components (drag
  rules `canDrop`, date states, hold timer, quick stats math, access rules, permissions, URL parsing,
  validation). Counts as PRs merged: 219 (API client), 399 (access), 416 (quick stats), 554 (calendar
  fix), 770 (schedule), 878 (PR 119).
- **React Testing Library** for components and flows (`@testing-library/react`, `user-event`, jsdom),
  including StrictMode runs for focus and once-only effects. jsdom cannot measure layout, so scrolling and
  sizes are verified in a browser.
- **Real-browser QA** by the `qa-engineer` agent for every UI ticket: real key events and mouse drags with
  intermediate moves, keyboard-only passes, touch emulation, headless Chrome at the widths above, production
  builds, race/409/timeout/double-submit scenarios, throwaway HTTP servers for the real client.
- **Definition of done:** the ticket's acceptance criteria, plus `npm run lint`, `typecheck`, `test` and
  `build` all passing (CI runs the same). Drift tests assert theme tokens. A new lint suppression, skipped or
  deleted test, or lowered threshold is a QA finding.
- **Review:** the `reviewer` agent (up to 3 rounds per ticket, then the ticket is released), optionally
  `agent-skills:code-reviewer` and `agent-skills:security-auditor`.
- **Mock scenarios** (`normal`, `loading`, `empty`, `error`) exercise the loading, empty and error states
  in dev.

## Browser support notes

- Target browsers: **Unknown** (no list in the repo). Verified so far: headless Chrome.
- Firefox and iOS Safari keep their native date affordance next to the themed calendar (Excia/Guestrooms-Demo#116).
- The themed calendar opens from the icon only (Q-G-18).
- Touch devices cannot drag on the Schedule (touch scrolls); the keyboard move is the alternative (D-055).
- Dates are local calendar dates; DST never shifts a day because arithmetic runs on UTC midnights (D-046).
- `crypto.randomUUID` is used for request ids with a fallback for old or non-secure contexts.
- Fonts: Roboto 400/500/700 self-hosted via `@fontsource/roboto`.
