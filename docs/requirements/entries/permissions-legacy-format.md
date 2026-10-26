# Permissions page in the legacy format (follow-up to 186)

Branch `fix/permissions-legacy-format`; follow-up to Excia/Guestrooms-Demo#186 / PR #218. Owner feedback: the page "looks good" but must be in the
same format as the legacy screen with every option matching. Source: `GuestRoomsWebsite/src/views/Dashboard/Admin/Setup/PrimarySetup/PermissionsEdit.vue`
(`setPermissionsOrDefaults`, `reservationEventsCoreUpdated`, `save`), `types/constants.ts` (`PERMISSION_*_OPTIONS`), `types/enums.ts`, `types/api/GuestRooms/PermissionsAPI.ts`.
**Status:** in review, 2026-10-26.

## Legacy vs ours

| Area | Legacy | PR #218 (before) | Now |
| ---- | ------ | ---------------- | --- |
| Layout | Title "Permissions", button SAVED / SAVE PERMISSIONS, subtitle "All Admins are granted all permissions by default in the system.", one table: blank corner, **Management**, **Staff** columns, rows only | Same shell, plus three section heading rows and a "Permission" column header | Legacy structure: no sections; blank corner header; same title, subtitle and Saved / Save Permissions button (this build's shell and `SaveButton`) |
| Admin Setup | One row, **View** or **No Access** (View first) | One row per setup page with No Access / View (Edit for admins) | One **Admin Setup** row, View / No Access. It sets every setup page in the stored set (View: `page.<id>` for each; No Access: none) |
| Row order and wording | Admin Setup; Closure Events + Details; Reservation Events + Core Details; Change Reservation Room (hint "from unassigned or other room"), Location, Room Type; Change Rate Category; Adjust Room Rate; Check In Room; Undo Check In; Check Out Reservation (hint "manual check out prior to set check out time"); Reservation Full Details (hint "guests, add-ons, notes"); View Private Notes; Night Audit (hint "history and manual night audit run (create)"); Room Block; Reporting; Operation Reports; Financial Reports; Folio; Add Manual Charge / Credit; Add Positive Deposit / Payment; Add Negative Deposit / Payment; Split Folio; Settle Folio; Manually Reopen / Close Folio; Non-Members | Same order; "Operational Reports"; Night Audit hint "Edit: history and running the night audit" | Exactly the legacy order and wording ("Operation Reports"; the legacy Night Audit hint) |
| Access levels | Create + Edit / Edit / View / No Access for Closure, Reservation Events, Night Audit, Room Block, Non-Members; Edit / View / No Access for Full Details and Folio; **Edit / No Access** for Reporting | Same | Same |
| Check In Room | AnyTime / On Check-In Date Only / Never (label "AnyTime") | "Any Time" | "AnyTime" |
| Functions | Yes / No | Same | Same |
| Cascade | Changing Staff Reservation Events to Edit or Create + Edit (also Edit to Create + Edit) sets the eight reservation functions Yes and Check In AnyTime; to View sets them No and Never; No Access changes nothing. Management has no cascade | Cascade on both columns, also on No Access | Exactly legacy: Staff only. Management keeps hand-tuned values; the grant ignores check in and the functions while Reservation Events is View (`rowApplies`) |
| N/A cells | Staff column: every function under Reservation Events while it is No Access; Operation Reports and Financial Reports (Management only). Management shows all cells | N/A for any column whenever the area does not allow the row | Exactly the legacy N/A cells (`rowIsNotApplicable`); N/A saves as off |
| Defaults | Management: Admin Setup View, Closure and Reservation Create + Edit, all functions Yes except Reopen/Close Folio, Check In On Check-In Date Only, Full Details Edit, Night Audit and Room Block Create + Edit, Reporting Edit, Folio Edit, Non-Members Create + Edit. Staff: Admin Setup No Access, Closure View, Reservation View, functions No, Check In Never, Full Details Edit, Night Audit View, Room Block Edit, Reporting No Access, Folio Edit, Manual Charge and Positive Deposit Yes, Non-Members Edit | Own defaults (Staff Reservation Events Edit, Reporting Edit, no Permissions page for Management) | The legacy defaults (P-186-2) |
| PIN override | No row on this screen (the override dialog asks for an authorized employee's PIN) | A "PIN Override" section with "Authorize Overrides with PIN" | Removed from the page. `PermissionSet.pinOverride` stays in the model, defaults on for both sets, so whoever holds the permission may authorize (legacy behavior); the ticket text asked for a PIN row, see Q-PL-2 |
| Whole page read-only | Controls disabled and button disabled when the signed-in employee's Admin Setup is View | View-only mode | Same idea through the View-only mode (fields disabled, no Save, a note) |
| Save | Staff N/A values saved as No / Never; Management-only report values not sent for Staff | Normalized sets | Normalized sets: what the page shows as N/A is saved as off; other values kept as chosen |

## Dev and mock notes

- The override PIN is demoed with the dev user **View-only admin (Management set)**: it checks in on the arrival date, so a past date opens the PIN prompt; the Administrator's PIN is accepted.
  The dev "Non-admin" (Staff set) cannot check in under the legacy defaults, so it cannot demo it. No extra mock user was needed.
- Stored Admin Setup levels that differ per page show as "Mixed (per page)" (a disabled option); picking View or No Access rewrites every page.
- `localStorage['gr.mockPermissionSets']` is now versioned (`{ version: 2, sets }`); sets stored by the first version of the page are ignored and the legacy defaults load.
- A PIN holder with no permission set uses their explicit fixed grant (only the Administrator has `all`); an unknown set means no grant.

## Mapping onto our permissions model

- Legacy's model is one level per area for the whole of Admin Setup. Ours has `page.<id>` (View) and `<id>.edit` (Edit) per setup page. The page writes only View or No Access
  to all setup pages at once; the per-page `edit` level is still understood by `can()` and the route guard (Administrators, and a backend that grants it) but cannot be set here.
  Legacy has no "Edit" for Admin Setup at all, so non-admins are always view-only on setup pages.
- Reservation Events: View gives the reservation pages read-only. Edit or Create + Edit adds `reservation.edit` and the check-in grants. The grant ignores a function while its
  area does not allow it (Reservation Events needs Edit or Create + Edit; others need more than No Access), even if a stored value says Yes.
- Stored but not yet read by any screen: Closure Events, Reservation Full Details, Non-Members, and every `function.*` except check in (as before).

## Open questions

| ID | Question | Blocks | Default used | Who answers | Status |
| -- | -------- | ------ | ------------ | ----------- | ------ |
| Q-PL-1 | A View Management set can show Check In AnyTime / functions Yes (legacy has no Management cascade) although the grant ignores them. Show a hint or grey them? | Display | Nothing extra (legacy parity); the grant gates | Owner | open |
| Q-PL-4 | Legacy employee type (Admin / Management / Staff) IS the permission row. The Employees page lets a Manager or Staff employee pick either set. Should the type decide the set (manager -> Management, staff -> Staff)? | Employees (#222) | Free choice of the two sets, unchanged | Owner | open |
| Q-PL-2 | The Permissions ticket asked for a PIN override row; legacy has none. Keep it hidden (default on for both sets) or add it back? | PIN prompt | Hidden; the permission itself decides who may authorize | Owner | open |
| Q-PL-3 | Legacy "Admin Setup View" lets a Management user see every setup page, including Permissions and Employees (read-only). Is that intended, or should some pages stay hidden? | Setup access | All setup pages, as the single legacy row implies | Owner | open |

## Placeholders

- **P-186-2:** the default sets are the legacy defaults (`src/api/permissionSetsData.ts`); this replaces P-186-1's defaults.
