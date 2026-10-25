# Overview

## Product scope

Guest Rooms is the product UI for a club guest-room system. It covers:

| Area                   | What it does                                                                                                        | Epic                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Schedule (home screen) | Rooms-by-dates grid, drag-and-drop moves, reservation details panel                                                 | [Schedule](features/02-schedule.md)                         |
| Dashboard              | Reservation Management shortcuts, Quick Stats, New Reservation search                                               | [Dashboard](features/01-dashboard.md)                       |
| Reservations           | List with bulk actions, Reservation Hub, check in/out, keycards, payments, add-ons                                  | [Reservations](features/03-reservations.md)                 |
| Folios and Night Audit | Folio view, charges, payments, split and settle, transfer, refunds, night audit run and history                     | [Folios and Night Audit](features/04-folios-night-audit.md) |
| Online booking         | Member and non-member booking widget, results, payment, My Reservations; embedded in the club's Axis site           | [Online Booking](features/05-online-booking.md)             |
| Reporting              | Landing page, standard report shell, custom reports, about 20 standard reports                                      | [Reporting](features/06-reporting.md)                       |
| Admin setup            | System settings, rate categories, room types and rooms, add-ons, booking rules, keycard integration, migration tool | [Admin Setup](features/07-admin-setup.md)                   |
| Notifications          | Triggered and scheduled email/SMS notifications, recipients, attachments, snippets                                  | [Notifications](features/08-notifications.md)               |

It is built from the "CE Guest Rooms" Figma file (source of truth; an older copy with file key
`kfShjVI0o5MY5KpGEmsgpw` is to be ignored, D-012). **No backend exists yet** (D-001): the UI runs
on an in-memory mock behind a typed API client, and a real API replaces the mock later.

The product is **admin/staff UI plus an online-booking flow**. The online booking flow is
embedded in the club's main site ("Axis") as a widget and opens results in a new tab (D-011).

## Users and roles

| Role                           | Meaning                                                                                                  | Where defined                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Administrator ("Admin")        | May open every Admin Setup page; grant `permissions: 'all'`                                              | Excia/Guestrooms-Demo#9, `src/api/mockUsers.ts`    |
| Non-admin staff                | Reservation Management pages only; the menu shows one column and "Return to Site"                        | Excia/Guestrooms-Demo#8                            |
| Partial admin                  | Some Admin Setup pages only (mock: Rooms and Room Types)                                                 | Excia/Guestrooms-Demo#9                            |
| Employee                       | Staff who book in the admin UI; the "Admin Booking" column of Booking Rules; hold audience `employee` | Excia/Guestrooms-Demo#74                           |
| Employee roles (notifications) | Admin, Management, Staff; recipients can be chosen per role                                              | Excia/Guestrooms-Demo#80                           |
| Member                         | Club member; online booking with member rates and rules; owns a member number                            | Excia/Guestrooms-Demo#34, Excia/Guestrooms-Demo#74 |
| Non-member (guest)             | Booker without a member account; non-member rates and rules; signs in through "Core"                     | Excia/Guestrooms-Demo#99                           |
| Owner (room owner)             | A member who owns one or more rooms; shown with the owner treatment when the Owner system setting is on  | Excia/Guestrooms-Demo#34                           |

Reservation people: **Reserver** (books), **Lead Occupant**, **Named Occupant**, **TBD** guest,
**Booking Guest** (see [glossary.md](glossary.md)). Permissions are granular and checked only
through `can(permission)`; the full registry is in [permissions.md](permissions.md). The real
Permissions page design is pending (D-009).

## Architecture

| Concern              | How it is done                                                                                                                                                                                                                                                                                                                                                                                                                | Where                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Stack                | React 19, TypeScript, Vite, MUI 9, react-router 8, Vitest, ESLint, Prettier                                                                                                                                                                                                                                                                                                                                                   | `package.json`                                                             |
| API access           | One typed `ApiClient` interface (`dashboard`, `reservations`, `permissions`, `schedule`). Two implementations: the fetch client and the in-memory mock. Chosen by config only                                                                                                                                                                                                                                                 | `src/api/types.ts`, `http.ts`, `mock.ts`, `index.ts`                       |
| Mock first           | Mock data and the dev scenarios exist so UI tickets can be built before a backend. The mock is a separate lazy chunk                                                                                                                                                                                                                                                                                                          | `src/api/mock*.ts`, `lazy.ts`                                              |
| Demo mode            | A production build with `VITE_API_MODE=mock` and no `VITE_API_URL` runs on the mock, shows a "Demo data" chip and always signs in as the Administrator                                                                                                                                                                                                                                                                        | `src/api/config.ts`, `components/DemoDataChip.tsx`, `src/api/mockUsers.ts` |
| Misconfigured builds | A production build with neither a URL nor the mock flag rejects every call with code `misconfigured` and logs `console.error`                                                                                                                                                                                                                                                                                                 | `src/api/unavailable.ts`                                                   |
| Permission model     | Fail-closed `can(permission)` backed by the grant from `GET /permissions/me`; route guard `RequireAccess`; menu and dashboard read the same gate. UI hiding is not authorization                                                                                                                                                                                                                                              | `src/app/permissions.ts`, `access.ts`, `components/RequireAccess.tsx`      |
| Route table          | One table: id, path, title, section, menu label. `App.tsx` generates routes from it; the menu and the dashboard shortcut list derive from it                                                                                                                                                                                                                                                                                  | `src/app/routes.ts`                                                        |
| URL-driven state     | Schedule view (`start`, `view`, `locations`, `types`, `rooms`), New Reservation criteria (`/reservations/new/results?...`), and, since PR Excia/Guestrooms-Demo#119, the reservation panel (`res`, `rr`, `panel`, `room`, `arrival`), and the Reservation List (`from`, `to`, `unassigned`, `locations`, `types`, `status`, text filters, `q`, `sort`, `page`, `rows`) live in the URL so reload, links and Back/Forward work | `src/app/scheduleUrl.ts`, `panelUrl.ts`, `reservationSearch.ts`            |
| Theme tokens         | All color, type, spacing and shape come from `src/theme.ts` (Figma variables); ESLint blocks hex colors outside it                                                                                                                                                                                                                                                                                                            | `src/theme.ts`                                                             |
| Business rules       | Pure, unit-tested functions separate from components (drag rules, date rules, hold timer, quick stats math, access)                                                                                                                                                                                                                                                                                                           | `src/app/*.ts`, `src/lib/*.ts`                                             |
| Lazy loading         | The Schedule page and the dev component gallery are lazy chunks; an `ErrorBoundary` wraps every page                                                                                                                                                                                                                                                                                                                          | `src/App.tsx`                                                              |

Layering rule: `api/` must not import from `app/` (shared date helpers live in `src/lib/dates.ts`).

## Build, deploy and configuration switches

| Variable                   | Purpose                                                         | Notes                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_AXIS_URL`            | Absolute http(s) URL of the main Axis site for "Return to Site" | Missing or invalid falls back to `/`. Real value per environment is **Unknown** (Q-G-2)                                                      |
| `VITE_API_URL`             | Absolute http(s) URL of the backend API                         | Validated; query and hash dropped; credentials in the URL rejected; `http` outside localhost warns. Public configuration only, never secrets |
| `VITE_API_MODE=mock`       | Opt in to the mock in any build (hosted demo)                   | Ignored (with a warning) when `VITE_API_URL` is valid                                                                                        |
| `VITE_MOCK_SCENARIO`       | `normal` (default), `loading`, `empty`, `error`                 | Dev, and in a build only together with `VITE_API_MODE=mock`                                                                                  |
| `?mock=<scenario>`         | Dev-only URL override of the scenario                           | Survives the `/` redirect; wins over storage and env                                                                                         |
| `localStorage gr.mock`     | Dev-only scenario override                                      | Production builds ignore it                                                                                                                  |
| `localStorage gr.mockUser` | Dev-only mock user (admin, non-admin, partial)                  | Unknown or corrupt value falls back to the least-privileged user                                                                             |
| `?schedule=large`          | Dev-only: 200 rooms by 60+ days of stays in the mock            | For performance checks                                                                                                                       |
| `VITE_CMA_URL`             | Planned (ticket 4.9): CMA URL per environment for "OPEN CMA"    | **Not implemented**; named in the ticket, value Unknown (Q-46-2)                                                                             |

Client selection by build:

| Build      | `VITE_API_URL`   | `VITE_API_MODE`                       | Client                                                       |
| ---------- | ---------------- | ------------------------------------- | ------------------------------------------------------------ |
| dev        | unset or invalid | any                                   | mock (invalid logs a warning)                                |
| dev        | valid            | any                                   | real                                                         |
| production | valid            | any (`mock` logs a warning, URL wins) | real                                                         |
| production | unset            | `mock`                                | mock + "Demo data" chip                                      |
| production | unset            | unset                                 | unavailable: every call rejects with `misconfigured`         |
| production | invalid          | any                                   | same as above; an invalid URL is never replaced by mock data |

Commands: `npm run dev` (http://localhost:5173), `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, `npm run format`. CI (`.github/workflows/ci.yml`) runs install, lint, typecheck,
test and build on every PR and on pushes to `main`; it does not run Prettier, but the repo has a
Prettier config (`.prettierrc`: single quotes, trailing commas, print width 100) and these
requirements files are kept Prettier-clean. PR titles must be Conventional Commits (checked by
`pr-title.yml`); release-please builds the changelog and versions (D-071).

Unknown: hosting, environments list (staging, production) and deploy pipeline. Nothing in the
repo defines them.

## Process in one paragraph

One branch per ticket, one PR per ticket, `Closes #N` in the body, a Conventional Commit title,
only the CEO session merges (workers and managers never do, and only into the owner's repo), nobody pushes to `main` or edits repo settings or Figma. The
Manager agent (`docs/MANAGER.md`, `/run-manager`) coordinates specialist agents. If a ticket needs
an answer that is not in its body the work is marked blocked instead of guessed.
