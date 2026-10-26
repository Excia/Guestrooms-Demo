# 7.13 Employees (Legacy Port LP-A.4)

Ticket Excia/Guestrooms-Demo#185 (same scope as #125 on the main board). Figma: no frame. The Admin Setup frames show the
"Employees" item in the left navigation only.
**Status:** in review (branch `feat/185-employees`), 2026-10-26.

Source of behavior: the legacy `EmployeesEdit.vue` (a person from the club directory, an Employee Type of Administrator,
Manager or Staff, Remove, Save, unsaved-changes prompt, view-only mode, the last administrator cannot be removed or changed).
The layout is this build's Admin Setup shell with the left list of Room Types and Rooms (59px rows, Inactive tag, three-dot
menu). The legacy screen has no PIN, contact fields or permission set: the PIN prompt is ticket #187 and the Permissions page is
ticket #186; this page only assigns one of their permission sets.

## Figma deviations

| ID      | Area       | Figma                                               | Built                                                                                                     | Why                                                                      | Choice (owner, ticket, agent, forced) |
| ------- | ---------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| F-185-1 | Whole page | No Employees frame                                  | A list of employees on the left and a form (Employee, Employee Type, Permission Set, Active) on the right | Owner rule: match the existing Admin Setup pages and the legacy behavior | owner                                 |
| F-185-2 | List       | Legacy: one table of rows with a Remove button each | A selectable list, Remove in the three-dot menu, no Copy item                                             | Same pattern as the other setup lists; copying a person makes no sense   | agent                                 |

## Open questions

| ID      | Question                                                                                                               | Blocks         | Default used                                                                                                                                        | Who answers     | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Q-185-1 | Is "deactivate" a state of its own, or the same as Remove (legacy only has Remove, which sets the type to Unassigned)? | Active switch  | Both: an Active switch keeps the assignment but blocks sign in (not enforced yet: there is no sign-in in this build); Remove deletes the assignment | Owner           | open   |
| Q-185-2 | Must a Manager or Staff employee always have a permission set? Does an Administrator ignore the set?                   | Validation     | Manager and Staff need one; an Administrator has full access and no set (the field shows "Full access")                                             | Owner           | open   |
| Q-185-3 | Where do the people come from (the club directory), and can this page create a person?                                 | Add            | A fixed list of directory people without access (`employees.listCandidates`); the page never creates a person                                       | Owner / backend | open   |
| Q-185-4 | Are the employee types fixed (Administrator, Manager, Staff, as legacy) once permission sets exist?                    | Employee Type  | Fixed, as legacy; the set carries the finer access                                                                                                  | Owner           | open   |
| Q-185-5 | May an inactive employee be removed? The three-dot menu is only on active rows (shared list rule)                      | Remove         | No, by design: inactive rows have no three-dot menu (owner confirmed this for all setup lists), so reactivate first, then remove                    | Owner           | open   |
| Q-185-6 | What are the real permission sets? (Answered by #186: Management and Staff, from `permissions.listPermissionSets`; owner to confirm)          | Permission Set | Placeholders (`P-185-1`); the list comes from `employees.listPermissionSets` until the Permissions page (#186) lands                                | Owner           | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                | Why                                                                         | Source | Status |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ | ------ |
| D-185-1 | 2026-10-26 | The club always keeps one active administrator: demoting, deactivating or removing the last one is refused (`lastAdministratorProblem`) | Legacy hides Remove and disables the type for the only administrator        | legacy | open   |
| D-185-2 | 2026-10-26 | Save is one employee at a time (`PUT /employees/{id}`); the id is the directory person's id, so a repeated save changes nothing         | The other setup lists save one item; idempotent without a request id        | agent  | open   |
| D-185-3 | 2026-10-26 | The list shows active employees by name, then inactive ones (Inactive tag)                                                              | Same rule as the other setup lists                                          | owner  | open   |
| D-185-4 | 2026-10-26 | Without `employees.edit` the page is view-only: no New, Save or menu, fields disabled                                                   | Legacy view-only mode; access levels No Access / View / Edit (owner, 10-25) | ticket | open   |

## Placeholders and invented values

- **P-185-1:** the four permission sets, the six employees and the five directory people to add (`src/api/employeesData.ts`).
  Names and ids are invented; the seeded administrator is the only one, so a tester can reach the last-administrator rule.
- **P-185-2:** the change log entries of the page `employees` (`src/api/changeLogData.ts`).

## API, permissions, notes

- **API:** `employees.list`, `employees.listCandidates`, `employees.listPermissionSets`, `employees.save`, `employees.remove`;
  section "Employees" in `api-contract.md`. The permission set list is a minimal read-only endpoint; ticket #186 owns the sets.
- **Permissions:** new route `employees` (`page.employees`, an Admin Setup page, not in the menu) and new action permission
  `employees.edit`; see `permissions.md`. Change Log page id `employees` added.
- **Shared list:** `SetupList` gained three optional props (`more.onCopy` may be omitted, `more.deleteLabel`, `canCreate`).

## Legacy match (branch `feat/employees-legacy-match`, 2026-10-26)

The owner liked the first build (tag `archive/employees-page-v1`) but wants to ask someone else, so for now **`/admin/employees`
matches the legacy `EmployeesEdit.vue` exactly** and the richer build is kept as a variant for a side-by-side comparison.

- **Real page:** `src/pages/Employees.tsx`, rules in `src/app/employeesLegacy.ts` (tests next to them).
- **Variant:** `src/pages/EmployeesExtended.tsx` (+ its test and `src/app/employees.ts`), reachable only in a development
  build at `/admin/employees-extended`. It is not in the route table, the nav or the menu, and is not built into production
  (lazy import behind `import.meta.env.DEV`). It uses the same `page.employees` access check, so View-only applies to it too.
- **API:** the extended fields (`permissionSetId`, `active`) are optional on `EmployeeSetup` and `EmployeeInput`, so a backend that
  has only the legacy shape works; the extended page still works against the mock. New `employees.saveRoles` (`PUT /employees`,
  the legacy "put the changed employees" call).

### Legacy vs extended

| Topic              | Legacy (`/admin/employees`, built now)                                                                       | Extended (`/admin/employees-extended`, archived)                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Layout             | One page: a row per employee, no left list                                                                   | Left list of employees (three-dot menu) and a form                   |
| Row / form fields  | Name (read-only), Employee Type (Administrator, Manager, Staff; no default)                                  | Employee, Employee Type, Permission Set, Active switch, summary line |
| Add                | "Add Employee" button, then a row with the "Add Employee" directory lookup, a type and a cancel button       | "New Employee" in the list; same directory lookup in the form        |
| Remove             | Trash button on the row; confirm "Are you sure you want to remove this Employee?" (Cancel, OK); acts at once | "Remove Employee" in the three-dot menu; own confirmation            |
| After remove       | The type becomes Unassigned: the row leaves the list, the person can be added again                          | Same                                                                 |
| Deactivate         | None                                                                                                         | Active switch; inactive rows sort last with an Inactive tag          |
| Permission set     | None: permissions are set per employee type (see Q-185-7)                                                    | A set per Manager or Staff, from the Permissions page                |
| Order              | As the server returns them                                                                                   | Active by name, inactive last                                        |
| Save               | One "Save Employees" / "Saved" for all changed types and the new row (`PUT /employees`)                      | One employee at a time (`PUT /employees/{id}`)                       |
| Validation         | New row needs an employee and a type: dialog "Validation Error(s)", "Please correct the following errors:"   | Inline messages under the fields                                     |
| Only administrator | Type select disabled and no Remove (live: promoting another administrator frees it)                          | Type and Active disabled with a helper text; server check kept       |
| While adding       | Remove is disabled on the other rows; the add button is hidden                                               | Not applicable                                                       |
| Remove with pending edits | Deliberate deviation: other rows keep their unsaved type changes (legacy reloads and drops them) | Same as the extended form (one item) |
| Leaving unsaved    | Asked, also for an empty add row                                                                             | Asked when the form is changed                                       |
| View-only          | Generic mechanism: fields disabled, no Add, Save or Remove                                                   | Same                                                                 |
| Breadcrumb / title | "Primary Setup / Employees" (this build: the Admin Setup shell, title "Employees")                           | Title is the selected employee                                       |

Not carried over from legacy on purpose: the legacy "Loading Employees" overlay (this build's progress indicator), the generic
dialog look (this build's dialogs), and writing each row to the server in separate calls (one all-or-nothing `saveRoles`).

### Open questions (legacy match)

| ID      | Question                                                                                                                                                                                                                                                     | Blocks         | Default used                                                                             | Who answers | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-185-7 | Legacy has no permission set on an employee: its permissions come from the employee type (Administrator, Manager, Staff) and the Permissions page. Is that still how sets are assigned, or should an employee get a set of their own (the extended variant)? | Permission Set | Legacy: no set on this page; the type decides. The extended variant stays for comparison | Owner       | open   |
| Q-185-8 | Should an employee be deactivatable without removing them (extended Active switch)? Legacy only has Remove                                                                                                                                                   | Active         | Not on the real page                                                                     | Owner       | open   |
