# 186 Permissions (LP-A.5): Access sets, Function sets, View-only admin

Ticket Excia/Guestrooms-Demo#186 (same scope as #126); PR Excia/Guestrooms-Demo#<pr>. Figma: no frame; the owner's Permissions screenshots were **not
available** to the builder, so the layout follows the legacy `PermissionsEdit.vue`, the Booking Rules matrix and the Admin Setup shell.
**Status:** in review (branch `feat/186-permissions`), 2026-10-26. Owner has not tested it.

## Figma deviations

| ID      | Area       | Figma                          | Built                                                                                                                                                  | Why                                                    | Choice |
| ------- | ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------ |
| F-186-1 | Whole page | No frame; screenshots missing  | One table, a column per set (Management, Staff), sections Admin Setup / Access Sets and Function Sets / PIN Override, underlined selects like Booking Rules | Legacy layout in this build's shell; replace on arrival | agent  |

## Open questions (design and product, to check against the owner's screenshots)

| ID      | Question                                                                                                                                         | Blocks             | Default used                                                                                                      | Who answers | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-186-1 | Do the screenshots show one table (as legacy) or two (Access sets, Function sets)? Which rows, labels and order?                                  | Page layout        | One table with legacy rows and order; Function rows indented under their area                                       | Owner       | open   |
| Q-186-2 | Are Management and Staff the only editable sets, or can the club add named sets (the Employees page assigns "permission levels")?                | Sets, Employees    | Two fixed sets; `listPermissionSets` returns Administrator, Management, Staff                                       | Owner       | open   |
| Q-186-3 | Admin Setup rows: which pages (Employees and API Keys have no page yet), and are they labelled by menu name ("System Settings") or route name?   | Setup rows         | Every admin route gets a row, labelled by the Admin Setup navigation name; Employees/API Keys rows appear when their routes exist | Owner       | open   |
| Q-186-4 | Should the Permissions page be editable by a non-admin at all? (A Management user with Edit could grant themselves more.)                         | Safety             | Allowed per page level; Management defaults to No Access on Permissions                                              | Owner       | open   |
| Q-186-5 | In View-only mode, does the three-dot menu keep Change Log (read-only), and does Generate Preview (registration card) stay?                      | View-only          | Yes to both: neither changes data                                                                                   | Owner       | open   |
| Q-186-6 | What exactly does the PIN override row control: who may authorize (a Yes/No per set, as built), or which permissions an override may unlock?    | Ticket 187         | `pinOverride: boolean` per set: the set's holders may authorize overrides with their PIN                            | Owner       | open   |
| Q-186-7 | Which screens must read the stored-but-unused settings (Closure Events, Reservation Full Details, Non-Members, the `function.*` switches)?       | Later tickets      | Stored and granted as `function.<key>`; no screen asks yet except check in and reservation edit                    | Owner       | open   |
| Q-186-8 | Demo builds always run as Administrator, so a demo visitor never sees View-only. Should the user switcher be available in demo builds?          | Owner testing      | No (unchanged); test through the dev user switcher                                                                  | Owner       | open   |
| Q-186-9 | Is "Night Audit Edit" also needed to reverse items or only to run the audit? And should Create + Edit differ from Edit anywhere?                 | Night audit        | Edit and Create + Edit both give `night-audit.run`; nothing else                                                    | Owner       | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                       | Why                                                              | Source | Status |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ | ------ |
| D-186-1 | 2026-10-26 | Admin page levels are carried as `page.<id>` (View) and `<id>.edit` (Edit); `admin` is Edit everywhere; `locations.edit` is the first instance | One rule for every setup page, no second permission system       | ticket | open   |
| D-186-2 | 2026-10-26 | View-only is one flag from the route guard (`ReadOnlyProvider`), not a prop per page; a component outside an admin route stays editable      | One mechanism for every page; the backend is the real gate      | agent  | open   |
| D-186-3 | 2026-10-26 | `can()` reads the saved sets because the mock derives the signed-in user's grant from the saved set on every `getGrant`                        | Matches the real backend (grant from the user's set)             | ticket | open   |
| D-186-4 | 2026-10-26 | Saving replaces both sets (`PUT /permission-sets`); names cannot be edited; the Administrator set cannot be changed                            | Idempotent; matches the legacy two-set screen                    | agent  | open   |

## Placeholders and invented values

- **P-186-1:** the default Management and Staff sets (`src/api/permissionSetsData.ts`), the "View-only admin" mock user, the dev-only
  `localStorage['gr.mockPermissionSets']` persistence, and the note text "View only. You can look at these settings but not change them. Ask an
  administrator if you need Edit access." (`src/app/readOnlyText.ts`).

## API, permissions, notes

- **API:** `permissions.getPermissionSets`, `savePermissionSets`, `listPermissionSets`; section "Permission sets" in `api-contract.md`.
- **Permissions:** new route `permissions` (`page.permissions`, `permissions.edit`); `<id>.edit` for every admin page; `night-audit.run`;
  `function.<key>` for each function. See `permissions.md`.
- **For Employees (#185):** use `api.permissions.listPermissionSets()` (`PermissionSetSummary { id, name, editable }`, exported from
  `src/app/permissionSets.ts`). Keep it small; the id of a set is what an employee record stores.
- **For the PIN prompt (#187):** the row exists (`PermissionSet.pinOverride`, "Authorize Overrides with PIN"); wire the prompt to
  `getPermissionSets()` / the grant as the ticket needs. Night Audit: the schedule's Night Audit button does not yet check `night-audit.run`
  (the run screen does not exist); gate it with `can('night-audit.run')` when it lands.
