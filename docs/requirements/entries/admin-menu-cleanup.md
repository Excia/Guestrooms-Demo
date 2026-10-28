# Admin Setup left menu cleanup

No ticket (owner feedback 2026-10-28); branch `feat/admin-menu-cleanup`. Legacy reference: `GuestRoomsMenu.vue` (Admin Setup menu) and `PrimarySetup.vue` (side tabs).
**Status:** in review, 2026-10-28.

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                       | Why                                                                          | Source | Status      |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | ----------- |
| D-AN-1 | 2026-10-28 | Migration Tool is removed from the Admin Setup left navigation (legacy has none; ticket 7.7 is not built)                                                                                                                                                      | Owner: not needed                                                            | owner  | provisional |
| D-AN-2 | 2026-10-28 | "API Keys" is added after API Integrations (legacy tab "API KEYS"). It has no page yet (ticket 188), so it shows disabled like API Integrations                                                                                                                | Legacy parity                                                                | owner  | provisional |
| D-AN-3 | 2026-10-28 | Rate Categories, Room Types, Rooms and Add-On Items are links in the left navigation, in a second group (divider) below the Primary Setup tabs, in the legacy Admin Setup menu order. Notifications (legacy, last in that group) has no page and is not listed | Legacy lists them in the Admin Setup menu, apart from the Primary Setup tabs | owner  | provisional |

## Open questions

| ID     | Question                                                                                      | Blocks  | Default used                       | Who answers | Status |
| ------ | --------------------------------------------------------------------------------------------- | ------- | ---------------------------------- | ----------- | ------ |
| Q-AN-1 | Label "Add-On Items" (Figma and page title) or legacy "Add On Items"?                         | Nothing | "Add-On Items"                     | Owner       | open   |
| Q-AN-2 | Should Notifications (legacy menu entry; route `/admin/notifications` exists) be listed here? | Nothing | Not listed until its page is built | Owner       | open   |

## API, permissions, notes

- **Permissions:** none new; the links use the existing `page.<id>` checks, and the rows disappear into disabled state without access.
- **Notes:** `src/app/adminNav.ts` (`groupStart` marks the second group); `docs/requirements/permissions.md` and `features/07-admin-setup.md` still mention Migration Tool in the nav and are superseded by D-AN-1.
