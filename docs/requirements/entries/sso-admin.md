# 7.1 System Settings: SSO Admin

Owner request 2026-10-25 (no ticket number yet), with a Figma screenshot of the top of the Settings tab left column. Figma frame
not found in file WksR3zAy2S8cDsjrVvRklE (System Settings-Main 11895:16081 predates it); built from the screenshot.
**Status:** in review (branch `feat/settings-sso-admin`), 2026-10-25.

## Figma deviations

| ID      | Area      | Figma                                                         | Built                                                     | Why                            | Choice |
| ------- | --------- | ------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------ | ------ |
| F-SSO-1 | Placement | First section of the left column, above the time zone section | Same; heading "SSO Admin", then the field                 | As in the owner's screenshot   | owner  |
| F-SSO-2 | Label     | Screenshot labels the next section "Timezone"                 | Unchanged: the section stays "Time Zone" (existing label) | Out of scope; not renamed here | agent  |

## Open questions

| ID      | Question                                                                                   | Blocks             | Default used              | Who answers | Status |
| ------- | ------------------------------------------------------------------------------------------ | ------------------ | ------------------------- | ----------- | ------ |
| Q-SSO-1 | What will the field do (choose which user is the SSO admin)? Who may change it?            | Making it editable | Display-only, greyed out  | Owner       | open   |
| Q-SSO-2 | Where does the list of selectable users come from (club staff accounts, the SSO provider)? | Lookup source, API | None; no lookup is called | Owner       | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                                              | Why                                  | Source        | Status      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------- | ----------- |
| D-SSO-1 | 2026-10-25 | The SSO Admin section is always rendered, first in the left column, for every user and mode (also View mode and Training Mode). The field is the shared `LookupField`, always disabled, showing "Admin User" with the pale disabled search icon (button "Search SSO Admin", disabled) | "No matter what"; greyed out for now | owner request | provisional |
| D-SSO-2 | 2026-10-25 | Display-only and not part of `SystemSettings`: the value is the constant `SSO_ADMIN` in `SettingsTab.tsx`, so it is never in the draft, the unsaved-changes check or the Save payload, and no API or mock change was needed                                                           | Smallest change; no guards touched   | agent         | provisional |
| D-SSO-3 | 2026-10-25 | Accessibility: a real disabled combobox named "SSO Admin"; visually hidden text "Managed by single sign-on. Not editable yet." is its description (`aria-describedby`); nothing in it is a tab stop that does anything. Field order and first-error focus are unchanged               | Keeps the Figma look                 | agent         | provisional |

## Placeholders and invented values

- **P-SSO-1:** the name "Admin User" is the placeholder from the screenshot. Replace with the real SSO admin (a `ssoAdmin {id, label} | null` field of the system settings, once Q-SSO-1 is answered).

## API, permissions, notes

- **API:** none yet. A later change may add an optional `ssoAdmin {id, label} | null` to `GET /settings/system`.
- **Permissions:** none; visible to every user who can open the page.
