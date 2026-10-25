# 7.2 Rate Categories (Legacy Port LP-A.3)

Tickets Excia/Guestrooms-Demo#184 (Legacy Port board) and #71 (main board); one PR closes both. Figma: no frame
(confirmed: the file has only the empty "Default Rate Categories" tab label in System Settings, 11895:16081).
**Status:** in review (branch `feat/184-rate-categories`), 2026-10-25.

Owner rule: port the legacy behavior, keep this build's structure, theme and tokens. Legacy was read only
(`RateCategoriesEdit`, `RateCategoriesLookups`, `DuplicateRateCategoryDialog`, `RateCategoryTable`, the edit
store and the API types) and described here in our own words.

## What legacy does (kept)

- A category has a **name** (25 characters), an **item or combo SKU** (one is required) and a **rate table**.
- The rate table has a **default season** (no dates; "If no other seasons or special rates apply, this pricing
  will serve as default") and any number of **seasons / special rates**, each with a name (25 characters), a start
  and an end date. Per season there is one row per room type with: Standard Base, Alt Base (nights) 1 and 2
  (shown only while enabled in System Settings), Mon to Sun, Guest 2, Guest 3, Guest 4+, Child.
- **Add Season** starts from the default season's rates; seasons can be duplicated (name, dates and rates are
  copied) and removed after a confirmation. The default season cannot be removed.
- Save checks: name, SKU, every season named and dated, **seasons must not overlap** (inclusive: a shared day
  overlaps).
- **Duplicate** asks for a name (suggested "Name (Copy)"), refuses a name already in use, and copies the stored
  category with all seasons and rates.
- Delete asks for a confirmation. Legacy decides "in use" on the server; the rule is not visible in the UI code.

## Figma deviations

No frame exists, so there is nothing to deviate from. The layout follows Add-On Items (list on the left, form on
the right, Associations tab panel, save toast) with the legacy rate table below.

| ID      | Area         | Figma    | Built                                          | Why                                                 | Choice |
| ------- | ------------ | -------- | ---------------------------------------------- | --------------------------------------------------- | ------ |
| F-184-1 | Whole screen | no frame | Add-On Items layout plus the legacy rate table | Owner rule: legacy behavior, this build's structure | owner  |

## Open questions

| ID      | Question                                                                                                                                                | Blocks           | Default used                                                                                                                                                           | Who answers | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-184-1 | Do the Mon to Sun columns override the Standard Base on that weekday (and is 0 "no override")?                                                          | Rate pricing     | Stored and shown as in legacy, not interpreted; no consumer prices a night from them yet                                                                               | Owner       | open   |
| Q-184-2 | Legacy has no active dates on the category itself, only on seasons. The ticket asks for active start and end dates (end optional)                       | List, retiring   | Both: category active dates (same fields as Room Types and Add-Ons; inactive categories are listed last) and legacy seasons                                            | Owner       | open   |
| Q-184-3 | What exactly makes a category "in use" for deleting (legacy decides on the server)?                                                                     | Delete           | Blocked while any reservation uses it or a setting names it (reservation count and setting names come from the API); the dialog says to set an active end date instead | Owner       | open   |
| Q-184-4 | Legacy gives every room type a rate row in every category and adds rows when a room type is created. Should a category be limited to chosen room types? | Associations     | An "Associations > Room Types" list (all selected for a new category); the table has rows for the selected types; unchecking drops that type's rates                   | Owner       | open   |
| Q-184-5 | Legacy has a "rate categories for a new room type" step (set the rates of every category when a room type is added). Needed in the Room Types flow?     | Room Types (7.3) | Not built; a new room type is not added to existing categories (the backend or the owner adds it in the Associations list)                                             | Owner       | open   |
| Q-184-6 | The Admin Setup navigation item "Room Options" has no path yet (Room Options ticket); where does Rate Categories sit in it?                             | Navigation       | Reached from the main menu ("Rate Categories"); the page uses the "Room Options" active item like Room Types, Rooms and Add-On Items                                   | Designer    | open   |
| Q-184-7 | A duplicated season keeps its dates (legacy), so it overlaps its source until edited. Keep?                                                             | Seasons          | Kept as in legacy; Save reports the overlap on the copy                                                                                                                | Owner       | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                      | Why                                                                                                            | Source | Status      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| D-184-1 | 2026-10-25 | Names are unique across categories (case and surrounding spaces ignored), checked on save and in the Duplicate dialog                                                                                         | Legacy's Duplicate dialog refuses a used name; the same rule on save avoids two equal list entries             | agent  | open        |
| D-184-2 | 2026-10-25 | Money is typed in dollars, stored as integer cents (0 to 9,999,999.99), two decimals                                                                                                                          | The API uses cents everywhere; the upper bound is a placeholder                                                | agent  | open        |
| D-184-3 | 2026-10-25 | A season's end date may equal its start date; seasons overlap when they share any day                                                                                                                         | Legacy compares inclusively                                                                                    | legacy | open        |
| D-184-4 | 2026-10-25 | One generic Duplicate dialog (`src/components/shared/DuplicateDialog.tsx`) for setup pages; Rate Categories is its first user; Room Types, Rooms and Add-Ons keep creating an unsaved copy (not changed here) | Owner asked for one shared dialog; legacy has a separate dialog per page                                       | owner  | open        |
| D-184-5 | 2026-10-25 | Duplicating copies the stored category through `rateCategories.duplicate` (idempotent by `requestId`); with unsaved edits the usual "has not been saved" prompt comes first                                   | The server copy matches legacy; the prompt avoids silently losing edits                                        | agent  | open        |
| D-184-6 | 2026-10-25 | A create sends a `requestId` (the `Idempotency-Key`); a retry of the same body reuses it                                                                                                                      | A timeout must not create two categories                                                                       | agent  | open        |
| D-184-7 | 2026-10-25 | Alternative base rate columns appear only while enabled in System Settings; hidden columns keep their stored values                                                                                           | Legacy shows them from the same settings; hiding must not lose data                                            | legacy | open        |
| D-184-8 | 2026-10-25 | Quick Stats (mock) builds its revenue rows from the live category list; the seed dashboard stats and sample reservations use the four seeded ids                                                              | The mock then follows what the admin sets up                                                                   | agent  | open        |
| D-184-9 | 2026-10-25 | A non-default season may carry its own optional SKU (`season.sku`, with `skuKind`); empty means the category SKU. The default season has none                                                                 | Owner asked for a SKU per season; legacy has one SKU per category only (see rate-categories-polish.md D-RCP-4) | owner  | provisional |

## Placeholders and invented values

- **P-184-1:** the four seeded categories, their SKUs, seasons and amounts (`src/api/rateCategoryData.ts`). Names come from the designs; everything else is invented. "Members default rate category" on Member Rate stands in for the Default Rate Categories tab (a later ticket) so the in-use block can be shown.
- **P-184-2:** the sample reservations and dashboard/Quick Stats rows now use `rc-member`, `rc-non-member`, `rc-comp` and `rc-owner` (they previously had "Reciprocal Club", "Guest of Member" and "Event Package"; see placeholders.md).

## API, permissions, notes

- **API:** `rateCategories.getOptions/list/save/duplicate/delete`; section "Rate categories" in `api-contract.md`.
- **Permissions:** the existing admin page `rate-categories` (route id); no new permission. Delete and duplicate follow the page permission.
- **Consumers:** `seasonFor(seasons, date)` in `src/app/rateCategories.ts` resolves the season whose rates apply to a night (for the later pricing, folio and rate-change tickets). System Settings today has no category selects (alternative base rates are night counts, rate change handling an option), so the only existing dependency built is the alternative base rate columns; the Default Rate Categories tab and the rate-change handling behavior stay separate tickets and read `rateCategories.list`.
- **SKU kind (review fix):** the Item/Combo radio filters the SKU lookup and switching clears a SKU of the other kind; the mock and `validateRateCategory` refuse a mismatch. Add-On Items uses the same Item/Combo radio and SKU lookup without a kind per SKU (its options have none); not changed here, it needs `kind` on `AddOnOptions.skus` and is left for its own fix.
- **Layout polish (2026-10-25):** list, season cards, compact table and per-season SKU are in [rate-categories-polish.md](rate-categories-polish.md).
- **Not built:** the nightly price from these rates on the schedule and reservation (still the room type placeholder prices), the "rates for a new room type" step (Q-184-5), per-room rate overrides (legacy `rateRooms`, belongs to Rooms / Inherit Rates).
