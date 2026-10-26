# 7.1 System Settings: green clock picker and SSO Admin / Training Mode row

Owner feedback 2026-10-26 (no ticket number). Branch `fix/clock-green-sso-aligned`.

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                        | Why                              | Source         | Status      |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------- | ----------- |
| D-CLK-1 | 2026-10-26 | The clock dial has a 2px `primary.main` ring on a `primary.tint` face; the hand and selected bubble stay `primary.main`                                                                                                                                         | Owner: green outline and accents | owner feedback | provisional |
| D-CLK-2 | 2026-10-26 | The AM/PM and hour/minute toggles are green: selected is filled `primary.main` with `primary.contrastText` (white on #2e7d32, about 5.1:1), unselected is outlined with `primary.main` text (about 5.1:1 on white); visible focus is a primary outline          | Owner: green toggles, AA         | owner feedback | provisional |
| D-SSO-4 | 2026-10-26 | SSO Admin moves into a top row with the Training Mode switch: SSO Admin in the left cell, Training Mode in the right cell, the switch centred on the SSO field's line. The row is part of `SettingsTab`; below 1200px it stacks (SSO Admin, then Training Mode) | Owner: even, balanced top area   | owner feedback | provisional |

## API, permissions, notes

- No API or permission change. Supersedes the placement in D-SSO-1 (still first on the tab, now beside Training Mode instead of above Time Zone alone).
