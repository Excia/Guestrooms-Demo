# 7.6 Keycard Integration settings

Ticket Excia/Guestrooms-Demo#75; PR Excia/Guestrooms-Demo#161. Figma: Keycard Integration 2829:6860 (frames 2784:24240 open field, 2784:53677 populated, dialog 2784:53648, toast 2784:53940).
**Status:** in review (branch `feat/75-keycard-integration`), 2026-10-24.

## Figma deviations

| ID     | Area           | Figma                                                   | Built                                                                              | Why                                                                              | Choice (owner, ticket, agent, forced) |
| ------ | -------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| F-75-1 | Save button    | SAVE CHANGES centered at the bottom of the panel        | "Save Changes" in the page header, disabled until something changes               | Same placement as every other Admin Setup page (System Settings, Add-On Items)   | agent                                 |
| F-75-2 | Left navigation | Seven items, no Migration Tool                          | The shared Admin Setup navigation (nine items); Keycard Integration is now enabled | The shell is shared; ticket 7.1 lists nine items                                 | ticket                                |
| F-75-3 | Empty list     | Not drawn                                               | A line "No Encoder Keys yet. Add one or retrieve them from Visionline."            | Loading, empty and error states are required                                     | agent                                 |
| F-75-4 | Retrieve toast | One message                                             | Same copy, pluralized ("N Encoders ..."); a warning toast when none is new          | Several keys can be retrieved; a repeat retrieve can bring nothing new           | agent                                 |

## Open questions

`Q-75-1` to `Q-75-3` already exist in `open-questions.md`; their "Default used" cells there hold the defaults (updated in this PR).

## Decisions

| ID     | Date       | Decision                                                                                   | Why                                                                      | Source | Status |
| ------ | ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------ | ------ |
| D-75-1 | 2026-10-24 | Blank rows are allowed while editing and dropped on save; errors show after a field is left or after a refused save | Figma shows an empty row with a placeholder; Add Encoder adds one | agent  | open   |
| D-75-2 | 2026-10-24 | Retrieve merges into the list: blank rows are filled first, keys already listed are skipped | Never create duplicates or overwrite typed keys                          | agent  | open   |
| D-75-3 | 2026-10-24 | Retrieve does not save; the admin saves with Save Changes                                  | Matches the ticket ("fills rows") and keeps Confirm Leaving consistent   | agent  | open   |
| D-75-4 | 2026-10-24 | Remove All asks first; Cancel has the initial focus                                        | Ticket says "with confirmation"                                          | ticket | open   |

## Placeholders and invented values

- **P-75-1:** sample Encoder Keys and the key Visionline "returns" (`src/api/keycardData.ts`), 14 digits.
- **P-75-2 (provisional, not from the owner or Figma text):** key length of 14 digits (`ENCODER_KEY_LENGTH`, Q-75-1), guessed from the Figma mask XXXX-XXXX-XXXXXX.
- **P-75-3:** the error dialog sentence "Try doing something to troubleshoot and try again." is the Figma placeholder (Q-75-2).

## API, permissions, notes

- **API:** `keycards.listEncoders/saveEncoders/retrieveEncoders`; section "Keycard integration" in `api-contract.md`.
- **Permissions:** new admin page id `keycard-integration` (`page.keycard-integration`, also covered by `admin`); no other permission.
- **Notes:** ticket 3.6 reads the saved keys with `api.keycards.listEncoders()` and can reuse `ENCODER_KEY_LENGTH` and `normalizeEncoderKey` from `src/app/keycards.ts`. Keys are stored without separators.
