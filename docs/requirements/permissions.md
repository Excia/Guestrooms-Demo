# Permissions

Granular permissions, checked only through `can(permission)` (`src/app/permissions.ts`). The Permissions
page design is **pending a screenshot from the owner** (D-009, Q-G-1); until it arrives the registry below
is the contract, backed by the mock. A follow-up epic "Employees and Permissions" will be created once the
screenshot arrives. Back to the [index](README.md).

**Rules (all in force, D-032 to D-035):**

- Fail closed: the default context denies; ids not in the registry are denied everywhere (a typo or a
  permission from a newer backend fails closed); loading, error and unconfigured states deny; a new API
  client starts as loading.
- UI hiding is **not** authorization. The backend must enforce page and action access on every request
  ([api-contract.md](api-contract.md#server-side-enforcement)).
- The grant comes from `GET /permissions/me`: `{ role, permissions: string[] | 'all' }`. The sentinel
  `'all'` marks an unrestricted user; it needs agreeing with the backend. `permissionsFromGrant` keeps only
  known permissions and denies anything malformed.
- The grant is fetched once; a revoked role takes effect on reload.

## Registry as implemented (`main`, after PR Excia/Guestrooms-Demo#119)

| Permission                     | Meaning                                                                                                                                                                                                                                                                                                                                                 | Source                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `admin`                        | Opens every Admin Setup page at once (Primary Setup, Rate Categories, Room Types, Rooms, Add-On Items, Notifications)                                                                                                                                                                                                                                   | `ADMIN_PERMISSION`            |
| `reservation.edit`             | Change a reservation in the Schedule details panel (Early/Late saves) and create one from the New Reservation panel. Without it the panel is read-only and says why. Fail-closed: a user holds it only by an explicit grant or `'all'`. The only action permission so far; the real name and granularity wait for the Permissions page (Q-G-1, Q-19-14) | `RESERVATION_EDIT_PERMISSION` |
| `page.dashboard`               | Dashboard button in the menu (the `/dashboard` route itself is unguarded, D-035)                                                                                                                                                                                                                                                                        | route table                   |
| `page.schedule`                | Schedule \| Home                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.reservations`            | Reservations list                                                                                                                                                                                                                                                                                                                                       | route table                   |
| `page.new-reservation-results` | New Reservation search results (stub); mapping to be decided (Q-G-16)                                                                                                                                                                                                                                                                                   | route table                   |
| `page.folio`                   | Folio of one reservation (`/reservations/:id/folio`, not in the menu)                                                 | route table        |
| `page.open-folios`             | Open Folios                                                                                                                                                                                                                                                                                                                                             | route table                   |
| `page.unassigned-charges`      | Unassigned Charges (dashboard list only, not in the menu)                                                                                                                                                                                                                                                                                               | route table                   |
| `page.waitlist`                | Waitlist                                                                                                                                                                                                                                                                                                                                                | route table                   |
| `page.night-audit-history`     | Night Audit History                                                                                                                                                                                                                                                                                                                                     | route table                   |
| `page.add-on-countdown`        | Add-On Countdown                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.room-blocks`             | Room Blocks                                                                                                                                                                                                                                                                                                                                             | route table                   |
| `page.member-directory`        | Member Directory                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.reporting`               | Reporting                                                                                                                                                                                                                                                                                                                                               | route table                   |
| `page.primary-setup`           | Admin Setup: Primary Setup                                                                                                                                                                                                                                                                                                                              | route table                   |
| `page.rate-categories`         | Admin Setup: Rate Categories                                                                                                                                                                                                                                                                                                                            | route table                   |
| `page.room-types`              | Admin Setup: Room Types                                                                                                                                                                                                                                                                                                                                 | route table                   |
| `page.rooms`                   | Admin Setup: Rooms                                                                                                                                                                                                                                                                                                                                      | route table                   |
| `page.add-on-items`            | Admin Setup: Add-On Items                                                                                                                                                                                                                                                                                                                               | route table                   |
| `page.notifications`           | Admin Setup: Notifications                                                                                                                                                                                                                                                                                                                              | route table                   |

That is 21 permissions (`admin`, `reservation.edit` and 19 `page.<id>`). `page.<id>` is derived from every route in
`src/app/routes.ts` except `admin`; adding a route adds its permission. `page.admin` is **not** a
permission: the `/admin` landing opens for anyone who can open any Admin Setup page.

**Access rule (`canAccessPage`):** an Admin Setup page opens for `admin` OR its own `page.<id>`; every
other page needs its own `page.<id>`; unknown ids are denied. Menu items, the dashboard shortcut list and
the route guard all use this one function. The menu has one column when the user can open no Admin Setup
page and two columns otherwise; "Return to Site" shows in the menu only in the one-column layout.

**`reservation.edit` (added by PR Excia/Guestrooms-Demo#119, D-060):** the panel reads it through
`can('reservation.edit')`. A read-only user cannot save Early/Late or create, but still sees the primary
CTA enabled (the CTAs are stubs; Q-19-12). The Check In / Check Out CTAs and the other menu actions have
no permission of their own yet.

## Mock users (`src/api/mockUsers.ts`)

| User id     | Label                       | Role string           | Grant                                                                                                                                                                                                                                     | Who gets it                                       |
| ----------- | --------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `admin`     | Administrator               | Administrator         | `'all'` (every known permission)                                                                                                                                                                                                          | Demo builds always (D-033); dev choice            |
| `non-admin` | Non-admin (no admin pages)  | Staff                 | the 13 non-admin `page.<id>` (dashboard, schedule, reservations, new-reservation-results, folio, open-folios, unassigned-charges, waitlist, night-audit-history, add-on-countdown, room-blocks, member-directory, reporting); `reservation.edit` | Dev fallback for a missing or corrupt stored user |
| `partial`   | Partial (Rooms, Room Types) | Staff with some setup | the 13 above plus `page.rooms` and `page.room-types`; `reservation.edit`                                                                                                                                                                  | Dev choice                                        |

Dev only: `localStorage gr.mockUser` selects the user, via the lazy-loaded dev user switcher (absent from
the production bundle). The mock's default grant for `permissions.getGrant` outside the switcher is
`{ role: 'Club Manager', permissions: 'all' }`; the `empty` scenario answers `{ role: 'No access',
permissions: [] }`.

## Granular permission needs found in tickets (not built)

These need names once the Permissions page design arrives. None is in the registry today.

| Need                                                                                                                                                       | Ticket                          | Note                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Manual charges and credits                                                                                                                                 | 4.10 (Excia/Guestrooms-Demo#91) | "Users with permission"; which permission is **Unknown** (Q-91-2)                                              |
| Add Deposit / Payment, including a negative amount to refund a payment method                                                                              | 4.11 (Excia/Guestrooms-Demo#92) | "With the right permission"                                                                                    |
| Refunds and removing member charges                                                                                                                        | 4.7 (Excia/Guestrooms-Demo#44)  | Refund permission model open (Q-44-3)                                                                          |
| Adjust rate                                                                                                                                                | 3.8 (Excia/Guestrooms-Demo#31)  | Permission required? open (Q-31-1)                                                                             |
| Private notes (visible and editable only to admins)                                                                                                        | 3.3 (Excia/Guestrooms-Demo#26)  | Admin only                                                                                                     |
| Who may change the Owner system setting                                                                                                                    | 3.11 (Excia/Guestrooms-Demo#34) | Q-34-1                                                                                                         |
| Create/edit/cancel reservations, check in/out, undo check in, assign room, print registration card                                                         | 2.2, 2.5, 3.x                   | `reservation.edit` is the first; split is **Unknown**                                                          |
| Keycards: encode, deactivate                                                                                                                               | 3.6 (Excia/Guestrooms-Demo#29)  | Who may deactivate keys (Q-29-1)                                                                               |
| Night audit run, reverse items                                                                                                                             | 4.8, 4.9                        | Not stated                                                                                                     |
| See or edit another user's custom report; delete/rename                                                                                                    | 6.3 (Excia/Guestrooms-Demo#59)  | Q-59-2                                                                                                         |
| Admin Setup pages beyond the six: Locations, Booking Rules, System Settings, Employees, Permissions, Keycard Integration, API Integrations, Migration Tool | 7.x                             | Shell navigation lists them; they have no route or `page.<id>` yet                                             |
| Employee roles: Admin, Management, Staff                                                                                                                   | 8.3 (Excia/Guestrooms-Demo#80)  | Used to group notification recipients; relation to permissions **Unknown**                                     |
| Which users see the prompt-before-sending dialog                                                                                                           | 8.4 (Excia/Guestrooms-Demo#81)  | Q-81-2                                                                                                         |
| Dashboard widgets that need a permission                                                                                                                   | 1.2, 1.3                        | A user without `page.dashboard` still reaches the dashboard; privileged widgets must use `useAccess()` (D-035) |

Unknown: whether permissions are per role, per user, or both (the Permissions page will say); how new
permissions are versioned between frontend and backend.
