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
| `locations.edit`               | Add, change and remove locations on the Locations page (ticket 182). Without it the page opens read-only (fields disabled, no Add Location, Remove or Save), for clubs where only Clubessential changes locations. Whether read-only is a permission or a system flag is Q-182-1. A user holds it only by an explicit grant or `'all'`                  | `LOCATIONS_EDIT_PERMISSION`   |
| `employees.edit`               | Add, change, deactivate and remove employees on the Employees page (ticket 185). Without it the page opens view-only (no New, Save or menu, fields disabled). A user holds it only by an explicit grant or `'all'`                                                                                                                                      | `EMPLOYEES_EDIT_PERMISSION`   |
| `reservation.edit`             | Change a reservation in the Schedule details panel (Early/Late saves, edit guests and notes since ticket 151) and create one from the New Reservation panel. Add Another Room does **not** need it (legacy, D-LM-5). Without it the panel is read-only and says why. Fail-closed: a user holds it only by an explicit grant or `'all'`. The only action permission so far; the real name and granularity wait for the Permissions page (Q-G-1, Q-19-14) | `RESERVATION_EDIT_PERMISSION` |
| `page.dashboard`               | Dashboard button in the menu (the `/dashboard` route itself is unguarded, D-035)                                                                                                                                                                                                                                                                        | route table                   |
| `page.schedule`                | Schedule \| Home                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.reservations`            | Reservations list                                                                                                                                                                                                                                                                                                                                       | route table                   |
| `page.new-reservation-results` | New Reservation search results (stub); mapping to be decided (Q-G-16)                                                                                                                                                                                                                                                                                   | route table                   |
| `page.folio`                   | Folio of one reservation (`/reservations/:id/folio`, not in the menu)                                                                                                                                                                                                                                                                                   | route table                   |
| `page.open-folios`             | Open Folios                                                                                                                                                                                                                                                                                                                                             | route table                   |
| `page.unassigned-charges`      | Unassigned Charges (dashboard list only, not in the menu)                                                                                                                                                                                                                                                                                               | route table                   |
| `page.waitlist`                | Waitlist                                                                                                                                                                                                                                                                                                                                                | route table                   |
| `page.night-audit-history`     | Night Audit History                                                                                                                                                                                                                                                                                                                                     | route table                   |
| `page.add-on-countdown`        | Add-On Countdown                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.room-blocks`             | Room Blocks                                                                                                                                                                                                                                                                                                                                             | route table                   |
| `page.member-directory`        | Member Directory                                                                                                                                                                                                                                                                                                                                        | route table                   |
| `page.reporting`               | Reporting                                                                                                                                                                                                                                                                                                                                               | route table                   |
| `page.primary-setup`           | Admin Setup: Primary Setup                                                                                                                                                                                                                                                                                                                              | route table                   |
| `page.booking-rules`           | Admin Setup: Booking Rules (not in the menu; linked from the Admin Setup navigation)                                                                                                                                                                                                                                                                    | route table                   |
| `page.rate-categories`         | Admin Setup: Rate Categories                                                                                                                                                                                                                                                                                                                            | route table                   |
| `page.room-types`              | Admin Setup: Room Types                                                                                                                                                                                                                                                                                                                                 | route table                   |
| `page.rooms`                   | Admin Setup: Rooms                                                                                                                                                                                                                                                                                                                                      | route table                   |
| `page.add-on-items`            | Admin Setup: Add-On Items                                                                                                                                                                                                                                                                                                                               | route table                   |
| `page.keycard-integration`    | Admin Setup: Keycard Integration (not in the menu; linked from the Admin Setup navigation)                                                                                                                                                                                                                                                              | route table                   
| `page.locations`               | Admin Setup: Locations (not in the menu; linked from the Admin Setup navigation)                                                                                                                                                                                                                                                                        | route table                   |
| `page.employees`               | Admin Setup: Employees (not in the menu; linked from the Admin Setup navigation)                                                                                                                                                                                                                                                                        | route table                   |
| `page.notifications`           | Admin Setup: Notifications                                                                                                                                                                                                                                                                                                                              | route table                   |

The table above is the registry: `admin`, the action permissions (`reservation.edit`, `locations.edit`, the two check-in
permissions) and one `page.<id>` for every route except `admin` (the total grows with the route table). `page.<id>` is derived from every route in
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

**Used by ticket 2.3:** the "Change Room" action needs `reservation.edit` as well (shown disabled with the reason
"You do not have permission to change this reservation."). No mock user lacks it, so that state is covered by
tests only.

## Permission sets and View-only admin (ticket 186)

The Permissions page (`/admin/permissions`, Admin Setup) edits two sets, **Management** and **Staff**; Administrators always hold everything.
Saved through `permissions.getPermissionSets` / `savePermissionSets` ([api-contract.md](api-contract.md#permission-sets-ticket-186-built-on-the-mock));
`permissions.listPermissionSets()` returns `{ id, name, editable }[]` for the Employees page. Pure rules: `src/app/permissionSets.ts`.

**Admin Setup levels (per page, owner decision 2026-10-25):** No Access (no permission), **View** (`page.<id>`), **Edit** (`page.<id>` and `<id>.edit`).
The Permissions page offers a non-admin set only **View or No Access** in its single Admin Setup row, as the legacy screen does (Edit belongs to Administrators), and
**only an administrator may save permission sets** (the mock refuses anyone else with 403): a set can never grant more than its editor holds, so there is no
escalation by editing a set. A stored `edit` (a backend decision) still displays and is kept.
`admin` still means Edit on every page. `adminPageLevel(can, id)` in `src/app/access.ts` gives the level; the route guard (`RequireAccess`)
renders a View page inside `ReadOnlyProvider`. `locations.edit` is the same rule (`<id>.edit` for `locations`). The Admin Setup pages are the
routes with `section: 'admin'`, so a new admin route gets a row on the Permissions page and a permission automatically.

**Access sets** (legacy rows; levels in brackets): Closure Events + Details (Create + Edit, Edit, View, No Access), Reservation Events + Core Details
(same), Reservation Full Details (Edit, View, No Access), Night Audit (same four as the first), Room Block (four), Reporting (Edit, No Access),
Folio (Edit, View, No Access), Non-Members (four). **Function sets** (Yes/No): Change Reservation Room, Location, Room Type, Rate Category, Adjust Room Rate,
Undo Check In, Check Out Reservation, View Private Notes, Operational Reports, Financial Reports, Add Manual Charge / Credit, Add Positive /
Negative Deposit / Payment, Split Folio, Settle Folio, Manually Reopen / Close Folio; plus Check In Room (Any Time, On Check-In Date Only, Never).
A function (or Check In Room) whose area does not allow it is N/A and off. As in the legacy screen, the Reservation Events functions (change room, location, room type,
rate category, adjust rate, check in, undo check in, check out) need **Edit or Create + Edit**: with **View** or No Access they are off and Check In Room is Never, so a View
reservation set cannot check in. Switching Reservation Events to Edit switches them on again (Check In Any Time), as legacy; other areas restore the values they had.

**What a set grants today (`grantFromSet`):** the dashboard for everyone; Admin Setup pages as above; Reservation Events View gives the schedule,
reservations, search results, waitlist, add-on countdown and member directory, Edit adds `reservation.edit`, and the check-in grants follow
Check In Room; Night Audit View gives `page.night-audit-history`, Edit adds `night-audit.run` ("Edit" = history plus running the audit);
Room Block, Reporting and Folio give their pages (Folio also Open Folios and Unassigned Charges); each function that is on gives
`function.<key>`. The Employees page reads the sets through `permissions.listPermissionSets` (its own placeholder sets and endpoint are gone); an employee's
`permissionSetId` is `management` or `staff`. **PIN override (ticket 187):** a PIN holder in a set counts only while the saved set has `pinOverride` on and grants the permission;
the Administrator's PIN always counts. **Stored but not read by any screen yet:** Closure Events, Reservation Full Details, Non-Members, and every `function.*`
except check in (the screens pick them up as their tickets land).

**View-only mode (`src/components/admin/ReadOnlyProvider.tsx`, `src/app/readOnlyContext.ts`):** one flag per page. Effects: every MUI field control below it is
disabled by default (nested theme, `readOnlyTheme`) and the shared field components also read `useReadOnly()`/`useDisabled()`; `AdminShell` shows
the note "View only. ..." and drops the page actions; `SaveButton`, `RemoveIconButton` and `PhotoRemoveBadge` render nothing; `SetupList` hides New,
reorder, Copy and Delete (the three-dot menu keeps Change Log); `EditOnly` hides Add Season, Add Encoder, Remove All, Retrieve Encoder, Add Member
Type, Add option and Duplicate season; Photos' Add and "Select all / none" are hidden. The Change Log overlay stays usable (`EditableIsland`).
Tabs, list selection, links and Generate Preview stay usable. `src/pages/viewOnly.test.tsx` checks all ten Admin Setup pages.
Pages also stop saving in code (no Save button, `dirty` false, `save()` returns early). Hiding is not authorization: the mock refuses the Admin Setup writes without `<page>.edit` (or `admin`) with 403
(`roomSetup`, `roomOptions`, `addOns`, `rateCategories`, `bookingRules`, `systemSettings`, `keycards`; Locations and Employees check themselves), and the backend must do the same.

**The page is the legacy screen** (see [entries/permissions-legacy-format.md](entries/permissions-legacy-format.md)): Management and Staff columns, one **Admin Setup** row
(View or No Access, which sets every setup page to View or No Access in the stored set), the legacy Access and Function rows in legacy order and wording, no sections,
no per-page rows, no PIN row. The per-page `<id>.edit` model stays underneath (Administrators, and a backend that grants it); the page never writes `edit` for a non-admin set.

**Mock:** default sets (P-186-2) in `src/api/permissionSetsData.ts` are the legacy defaults. Management: Admin Setup View (every setup page), Closure and Reservation Events
Create + Edit, Full Details Edit, Night Audit and Room Block Create + Edit, Reporting Edit, Folio Edit, Non-Members Create + Edit, every function Yes except Manually Reopen / Close Folio,
Check In On Check-In Date Only. Staff: Admin Setup No Access, Closure View, Reservation Events View, Full Details Edit, Night Audit View, Room Block Edit, Reporting No Access, Folio Edit,
Non-Members Edit, Manual Charge and Positive Deposit Yes, the rest No, Check In Never. (So the dev "Non-admin" user can no longer edit reservations by default.)
`pinOverride` is on for both sets and has no row (legacy has none). In dev the edited sets persist under
`localStorage['gr.mockPermissionSets']`; the mock users "Non-admin" (Staff set) and "View-only admin" (Management set) read the saved set, so
edit a set as Administrator, switch user, and the change is live. "Partial" keeps its fixed grant (Rooms and Room Types, now with Edit). Demo builds
always run as Administrator.

## Mock users (`src/api/mockUsers.ts`)

| User id     | Label                       | Role string           | Grant                                                                                                                                                                                                                                            | Who gets it                                       |
| ----------- | --------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `admin`     | Administrator               | Administrator         | `'all'` (every known permission)                                                                                                                                                                                                                 | Demo builds always (D-033); dev choice            |
| `view-only` | View-only admin (Management set) | Management | read from the saved Management set (legacy defaults): every setup page View, reservation edit, check in on the arrival date, Night Audit run. Use this user to demo the override PIN (the past-date check-in prompt; the Administrator's PIN is accepted) |
| `non-admin` | Non-admin (Staff set)  | Staff                 | read from the saved Staff set (legacy defaults, P-186-2): the reservation pages read-only (Reservation Events View), Room Block, Night Audit history and the folio pages, no Reporting, no `reservation.edit`, no check in, no setup page | Dev fallback for a missing or corrupt stored user |
| `partial`   | Partial (Rooms, Room Types) | Staff with some setup | the 13 above plus `page.rooms` and `page.room-types`; `reservation.edit`                                                                                                                                                                         | Dev choice                                        |

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

## Check-in levels (ticket 163, built on the mock)

Check in has three levels. Two grants express them (`checkInLevel(can)` in `src/app/permissions.ts` picks the strongest):

| Permission                        | Level                | Meaning                                                                                                                                      |
| --------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `reservation.check-in.any-time`   | any time             | Check in on the arrival date or after it. A past date still asks for confirmation first                                                      |
| `reservation.check-in.arrival-date` | arrival date only  | Check in on the arrival date. A past date needs an **override code** (the prompt reads "Override and check in"); validated by the backend      |
| neither                           | never                | Check in is disabled with a reason (also the automatic check out that follows a check in)                                                    |

Unrestricted users (`'all'`) hold the highest level. Mock users: Administrator = any time; Non-admin (Staff set, legacy default Never) cannot check in; View-only admin (Management set, legacy default On Check-In Date Only) =
arrival date only, so a past date shows the override PIN prompt; Partial = any time. The names are provisional until the Permissions page design (Q-G-1). The override
PIN is checked by the mock against a small employee table (ticket 187). Whether the automatic check out needs its own permission is an open question
(Q-163-1): until then it follows these levels.

**Override PINs (what the backend must do):** the code is a manager's PIN; the permission whose holder's PIN is accepted is
`reservation.check-in.any-time`. Rate limit and lock out wrong codes, audit every override (who, whose code, when, what), never log or store
the code (hash only), treat "verify" as advisory and re-validate on check in. Details in
[api-contract.md](api-contract.md) ("Override PINs"). The mock accepts the PIN of an employee who holds `reservation.check-in.any-time` (the mock Administrator and Partial users' PINs; the Staff employee's PIN is refused), locks out after 5 wrong PINs for 5 minutes, and answers verify only for a user holding a check-in grant. The PIN prompt is the shared `OverridePinDialog`; any flow that needs an override passes its permission.

**Change Reservation functions and the PIN lock (ticket 187 follow-up, owner decision "match legacy").** The functions
`function.changeReservationRoom`, `function.changeReservationLocation` and `function.changeReservationRoomType` (Permissions page) decide
whether the Location, Room Type and Room of a reservation room can be changed. A user who lacks one sees a lock icon next to that
field (Change Room During Stay; a user who holds it sees none); the field starts locked, and a click on the lock asks for "Enter
override code to unlock" (the shared `OverridePinDialog`, permission = that function). A valid PIN unlocks that one field for this
dialog and is sent with the save; Cancel does nothing. The backend re-checks (`override-required` / `override-invalid`). Administrators hold
everything and see no locks. Pure rule: `lockedFields`, `changedFields`, `missingFunctions` in `src/app/overrideUnlock.ts`.
