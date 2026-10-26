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
