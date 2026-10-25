# 7.1 System Settings: House Account

Owner request 2026-10-25 (no ticket number yet); PR to be linked. Figma: no frame with the House Account section found in
file WksR3zAy2S8cDsjrVvRklE (System Settings-Main 11895:16081 still shows the older Settings tab); built from the owner's
screenshot description.
**Status:** in review (branch `feat/system-settings-house-account`), 2026-10-25.

## Figma deviations

| ID     | Area      | Figma                                                                                 | Built                                                                                                | Why                                                 | Choice |
| ------ | --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| F-HA-1 | Placement | Frame not in the file; screenshot shows only the heading and the field, no neighbours | Last section of the right column of the Settings tab, after Guest Member (the other lookup sections) | Groups it with the lookups; the position is a guess | agent  |

## Open questions

| ID     | Question                                                                                                                   | Blocks              | Default used                                                              | Who answers | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- | ----------- | ------ |
| Q-HA-1 | What is the house account used for (default account for folio charges, receiver of comped or unassigned charges, other)?   | Folio code (Epic 4) | Only stored and exposed as `settings.houseAccount`; no screen uses it yet | Owner       | open   |
| Q-HA-2 | Is it required, or may it stay empty? Is a house account found by name only, or also by account number?                    | Validation, lookup  | Optional (empty allowed); searched by name (contains, any case)           | Owner       | open   |
| Q-HA-3 | Which records are house accounts (a flag on member accounts, a separate list)? Does the lookup show an account number too? | Backend lookup      | Plain `{id, label}` records, as the other lookups                         | Owner       | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                                                                                                                            | Why                                                     | Source        | Status      |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------- | ----------- |
| D-HA-1 | 2026-10-25 | `SystemSettings.houseAccount: LookupRef \| null` (`{id, label}`), saved with the one Save button, part of the unsaved-changes prompt; folio code reads it with `useSystemSettings().settings.houseAccount`                                                                                                          | Same shape as the other lookups; one draft, one Save    | owner request | provisional |
| D-HA-2 | 2026-10-25 | The field is a type-ahead (`SearchLookupField`): it asks `systemSettings.listHouseAccounts(query)` 250 ms after typing stops, shows "Searching..." and "No house accounts found" or "Search failed. Try again.", clears with the X, and is disabled in view mode (`SettingsTab readOnly`)                           | Account lists can be long, so no preloaded options list | owner request | provisional |
| D-HA-3 | 2026-10-25 | Legacy research: the legacy Guest Rooms web app and its knowledge base were searched for "house account" and nothing about it was found in the Guest Rooms setup; "house account" appears only in POS (MPOS) notes, where checks charged to a club house account are a known thing. So no legacy behavior is copied | Nothing to match                                        | agent         | provisional |
| D-HA-4 | 2026-10-25 | Validation: empty is valid; a chosen account must have an id and a name. The mock backend also refuses (422) an id it does not know                                                                                                                                                                                 | Optional field; keep the backend check explicit         | agent         | provisional |

## Placeholders and invented values

- **P-HA-1:** six invented house accounts (Club House Account, Banquet Comp Account, Events House Account, Golf Outings House Account, Guest Rooms Comp Account, Pro Shop Staff Account; ids `house-1` to `house-6`) and the sample selection "Club House Account" in `src/api/systemSettingsData.ts`. Replace with `GET /settings/system/house-accounts`.
- **P-HA-2:** the placeholder text "House Account Name" comes from the owner's screenshot description.

## API, permissions, notes

- **API:** `GET` and `PUT /settings/system` gain `houseAccount: {id, label} | null`; new `GET /settings/system/house-accounts?query=` (see `api-contract.md`, "House Account"). The client rejects a `GET /settings/system` response without the `houseAccount` key (breaking contract change).
- **Permissions:** none new (admin routes only).
- **Change Log:** the Change Log lists are generated per page by the mock; the backend writes "House Account changed" entries when it saves (Q-97-3). Nothing typed to add here.
