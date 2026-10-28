# Admin Setup left menu cleanup

No ticket (owner feedback 2026-10-28); branch `feat/admin-menu-cleanup`. Legacy reference: `GuestRoomsMenu.vue` (Admin Setup menu) and `PrimarySetup.vue` (side tabs).
**Status:** in review, 2026-10-28.

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                                                                     | Why                                                                          | Source | Status      |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------ | ----------- |
| D-AN-1 | 2026-10-28 | Migration Tool is removed from the Admin Setup left navigation (legacy has none; ticket 7.7 is not built)                                                                                                                                                                                                                                                    | Owner: not needed                                                            | owner  | provisional |
| D-AN-2 | 2026-10-28 | "API Keys" is added after API Integrations (legacy tab "API KEYS"). It has no page yet (ticket #188), so it shows disabled like API Integrations                                                                                                                                                                                                             | Legacy parity                                                                | owner  | provisional |
| D-AN-3 | 2026-10-28 | Rate Categories, Room Types, Rooms and Add-On Items are links in the left navigation, in a second group (divider) below the Primary Setup tabs, in the legacy Admin Setup menu order. Notifications (legacy, last in that group): the route `/admin/notifications` exists in the route table but no page is built, so it is not listed until the page exists | Legacy lists them in the Admin Setup menu, apart from the Primary Setup tabs | owner  | provisional |

## Open questions

| ID     | Question                                                                                                                                                                                                                                                  | Blocks  | Default used                                | Who answers | Status |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------- | ----------- | ------ |
| Q-AN-1 | Label "Add-On Items" (Figma and page title) or legacy "Add On Items"?                                                                                                                                                                                     | Nothing | "Add-On Items"                              | Owner       | open   |
| Q-AN-3 | The four list pages (Rate Categories, Room Types, Rooms, Add-On Items) replace the left menu with their own item list (D-088, legacy parity), so from them there is no way back to the Admin Setup menu except the app menu. Keep it, or add a back link? | Nothing | Unchanged (legacy parity); known limitation | Owner       | open   |
| Q-AN-2 | Should Notifications (legacy menu entry; route `/admin/notifications` exists) be listed here?                                                                                                                                                             | Nothing | Not listed until its page is built          | Owner       | open   |

## API, permissions, notes

- **Permissions:** none new. A user without the page's `page.<id>` permission sees the entry as a disabled button (no link); a View-only user has the permission, so the entry is an enabled link and the page opens read-only. API Keys has no `page.<id>` yet (ticket #188, API Integrations, API Keys, PayCloud tokens).
- **Notes:** `src/app/adminNav.ts` (`groupStart` marks the second group); `docs/requirements/permissions.md` and `features/07-admin-setup.md` still mention Migration Tool in the nav and are superseded by D-AN-1.
