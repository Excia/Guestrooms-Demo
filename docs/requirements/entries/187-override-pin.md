# LP-A.6 Permission override PIN prompt

Ticket Excia/Guestrooms-Demo#187 (Legacy Port; same scope as #127 on the main board). Figma: no frame; built from the legacy
`PermissionOverrideDialog` and the existing "Enter override code to check in after the check-in date" dialog of ticket 163.
**Status:** in review, 2026-10-26.

## Figma deviations

| ID      | Area | Figma | Built | Why | Choice (owner, ticket, agent, forced) |
| ------- | ---- | ----- | ----- | --- | ------------------------------------- |
| F-187-1 | PIN prompt | Ticket 163 frame 11653:10365 shows the override code dialog | Same dialog, now generic (title, optional message, confirm label); adds lockout and "could not be checked" messages | The ticket asks for a prompt reused by every override flow; lockout texts have no design | agent |

## Open questions

| ID      | Question | Blocks | Default used | Who answers | Status |
| ------- | -------- | ------ | ------------ | ----------- | ------ |
| Q-187-1 | PIN length and characters (digits only? 4 to 8?). Legacy called it a free "override code" | Field validation | Any text up to 32 characters, numeric keypad hint; the backend decides | Owner | open |
| Q-187-2 | Lockout numbers (attempts, duration) and whether the lock is per user, per club or both | Lockout | 5 wrong PINs in a row lock the caller for 5 minutes; mock is per client | Owner | open |
| Q-187-3 | The "PIN override row on the Permissions page" named in the ticket depends on the Permissions page design (#186) | Permissions page | Not built here; the page can list `OverridePermission` ids | Owner / #186 | open |

## Decisions

| ID      | Date | Decision | Why | Source | Status |
| ------- | ---- | -------- | --- | ------ | ------ |
| D-187-1 | 2026-10-26 | One shared `OverridePinDialog` (`src/components/shared`) checks the PIN itself through `overrides.verifyPin` and hands the accepted PIN to the caller; the action re-sends it and the backend tests it again | Every override flow gets the same behavior; verify is advisory (api-contract) | ticket | decided |
| D-187-2 | 2026-10-26 | A wrong PIN is cleared from the field and focus returns to it; lockout disables the submit button and shows a live wait | Do not leave a PIN on screen; keyboard users keep their place | agent | decided |
| D-187-3 | 2026-10-26 | The check in request keeps the field name `overrideCode` (it now carries the holder's PIN) | Avoids a contract rename across endpoints | agent | decided |

## Placeholders and invented values

- **P-187-1:** mock employees and their PINs, and the lockout numbers, in `src/api/overridePin.ts`. The old mock code `4321`
  (`MOCK_OVERRIDE_CODE`, P-163-1) is removed. Employees (#185) and Permissions (#186) replace the table.

## API, permissions, notes

- **API:** `POST /overrides/verify-pin` (replaces `POST /override-codes/verify`), check in error `429 override-locked`. See api-contract.md, "Override PINs".
- **Permissions:** `reservation.check-in.any-time` is the only override-able permission today (`OverridePermission`).
- **Notes:** UI: `src/components/shared/OverridePinDialog.tsx`, words in `src/app/overridePinCopy.ts`; the past-date check in flow uses it from `ReservationDetails.tsx`.
