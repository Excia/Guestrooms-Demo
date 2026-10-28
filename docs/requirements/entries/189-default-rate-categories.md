# 189 Default Rate Categories tab (LP-A.8)

Ticket Excia/Guestrooms-Demo#189 (epic #181); PR: see the branch `feat/189-default-rate-categories`. Figma: no frame (the tab label exists in System Settings; its content was never designed, Q-71-1).
Legacy read only (`DefaultRateCategoriesEdit.vue`, `systemSettingsEdit` store) and described in our own words; nothing was copied.
**Status:** in review, 2026-10-28.

## What legacy does

- A two-column table headed "Default Rate Category". Rows, in order: **Room Block Rate Category** (hint "default selection on creation of room block"), **Members**, **Non-Members**, **Owners** (hint "applied when the occupant owns the room"). Each has a dense outlined select listing the Rate Categories lookup.
- Below them, one row per **member type override**: a member type select and a rate category select, and a remove button outside the table.
- "Add Member Type Override" adds an empty row (member type 0, rate category 0). Removing a row asks "Are you sure you want to delete member type override?" and removes it only on OK.
- Every change marks the System Settings page as changed; the tab saves with the page's one Save button. All controls are disabled for View access on Admin Setup.
- Legacy validates nothing here: an empty row saves with id 0, and a member type can be listed twice.

## Figma deviations

| ID      | Area                                         | Figma                      | Built                                                                   | Why                                               | Choice       |
| ------- | -------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| F-DRC-1 | System Settings: Default Rate Categories tab | Tab label only, no content | The tab is enabled and shows the legacy table (see above), in our theme | Ticket #189 asks for the legacy fields; no design | forced, #189 |

## Open questions

| ID      | Question                                                                                                                                             | Blocks                 | Default used                                                                                                              | Who answers | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-DRC-1 | Are the four defaults (Room Block, Members, Non-Members, Owners) required? Legacy allows none (id 0) but does not say what then happens              | Pricing, room blocks   | Optional: a select may stay on "Choose a rate category"; no validation                                                    | Owner       | open   |
| Q-DRC-2 | Which rate categories are offered: all, or only active ones (a category has start and end dates)?                                                    | The select lists       | All categories of the Rate Categories list                                                                                | Owner       | open   |
| Q-DRC-3 | An override replaces the Members default for its member type; does it also replace the Owners default for an owner of that type?                     | Pricing                | Not decided; the tab only stores the setting. Nothing reads it yet                                                        | Owner       | open   |
| Q-DRC-4 | What happens to a default when its rate category is deleted? The Rate Categories list blocks deleting a category named by a setting (`settingNames`) | Rate Categories delete | The mock still lists "Members default rate category" as the invented link for Member Rate; the real link is the backend's | Owner       | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                               | Why                                                                                | Source | Status      |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ----------- |
| D-DRC-1 | 2026-10-28 | The settings live in `SystemSettings.defaultRateCategories` and ride on the page's one draft, one Save button and unsaved-changes prompt. They are not a separate resource                                                             | Ticket: "saved with the one Save button and the unsaved-changes prompt"            | ticket | provisional |
| D-DRC-2 | 2026-10-28 | An override row needs both selects, and a member type may appear once (taken types are listed but cannot be picked; a repeat is refused with an inline message). A refused save moves to this tab and focuses the first invalid select | Legacy would save an empty row as id 0; that is never useful. Added, not in legacy | agent  | provisional |
| D-DRC-3 | 2026-10-28 | "Add Member Type Override" is always offered (legacy hides it after any edit through a flag quirk). The new row takes focus; after a removal focus returns to the Add button                                                           | The hiding was a side effect of a shared flag, not a rule                          | agent  | provisional |
| D-DRC-4 | 2026-10-28 | Removing an override keeps the legacy confirmation (title "Confirm", Cancel focused, OK) via the shared `LegacyRemoveDialog` with its own question                                                                                     | Legacy behavior                                                                    | legacy | provisional |

## Placeholders and invented values

- **P-DRC-1:** the saved choices (`roomBlock` and `member`: Member Rate, `nonMember`: Non-Member Rate, `owner`: Owner Rate) and the sample override (Honorary Member to Comp Rate) in `mockSystemSettings()` (`src/api/systemSettingsData.ts`). The member types are the Booking Rules placeholders (`src/api/bookingRulesData.ts`).

## API, permissions, notes

- **API:** `GET` and `PUT /settings/system` gain `defaultRateCategories: {roomBlock, member, nonMember, owner: <rate category id> | null, memberTypeOverrides: [{id, memberTypeId, rateCategoryId}]}`. `GET /settings/system/options` gains `rateCategories` and `memberTypes` (lists of `{id, label}`). The client tolerates responses that omit them for one release (no defaults chosen, empty lists). `PUT` answers 422 `validation` for an incomplete or repeated override or an unknown rate category. Documented in `api-contract.md` under "Default Rate Categories (ticket 189)".
- **Permissions:** the page's `page.primary-setup`: View access shows the tab with disabled selects and no Add or Remove.
- **Code:** `src/app/defaultRateCategories.ts` (pure rules, tests in `defaultRateCategories.test.ts`), `src/components/admin/systemSettings/DefaultRateCategoriesTab.tsx`, page tests in `src/pages/SystemSettings.defaultRates.test.tsx`.
- **Notes:** nothing reads the defaults yet (room block creation, pricing a reservation); those tickets own that behavior.

- **Review fixes (2026-10-28):** new override rows get an id derived from the existing rows (`nextOverrideId`), so ids stay unique across tab switches, saves and backend-made ids. A saved choice naming a deleted rate category or member type is an error on its select (announced, `aria-invalid`) and blocks the save until another is chosen (D-DRC-5). The "Choose a ..." messages of an empty row appear only after a refused save; repeats and deleted choices show at once (D-DRC-6).
