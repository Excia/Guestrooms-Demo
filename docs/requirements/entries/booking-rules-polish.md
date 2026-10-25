# 7.5 Booking Rules polish (Admin Booking, Optional payment, deposit type)

Follow-up to Excia/Guestrooms-Demo#74; owner feedback of 2026-10-25. PR: see the branch
`feat/booking-rules-admin-optional-deposit`. Figma: Booking Rules 15957:84601 (no frame for the new controls).
**Status:** in review, 2026-10-25.

Legacy was read only (`BookingRulesEdit.vue` and its option lists) and is described here in our own words.

## What legacy does

- **Payment Method at Booking** offers *Optional*, *Payment on File Required*, *Deposit Required* and
  *Prepayment Required* (and a "Select a value" placeholder that must not be saved) for each of the admin, member
  and non-member rules.
- A deposit is a **percentage** only (`depositPercentage`, 1 to 100). There is no dollar deposit in legacy.
- The admin rule is called "admin" in legacy; this build labelled it "Employee Booking" until now.

## Figma deviations

| ID       | Area            | Figma                         | Built                                                        | Why                                       | Choice |
| -------- | --------------- | ----------------------------- | ------------------------------------------------------------ | ----------------------------------------- | ------ |
| F-bkr-1  | Deposit control | Select plus an Amount field   | Select, then a `$ / %` toggle and the amount or percent field | Owner asked for dollars or percent; guess | agent  |

## Open questions

| ID       | Question                                                                                                  | Blocks         | Default used                                  | Who answers | Status |
| -------- | --------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------- | ----------- | ------ |
| Q-bkr-1  | Where does the `$ / %` toggle sit in the owner's mockup (beside the amount, or inside the field)?          | deposit layout | Beside the amount field, under the select     | owner       | open   |
| Q-bkr-2  | Is a percentage deposit taken of the room total only, or of the total with add-ons, taxes and service charges? | deposit math   | "total stay" is whatever total the caller passes to `depositDueCents` | owner | open   |
| Q-bkr-3  | May a booker with "Optional" skip the payment method for every flow (online and admin New Reservation), and does check-in still require one (D-check-in)? | consumers | Yes for booking; check-in still requires one | owner | open   |

## Decisions

| ID       | Date       | Decision                                                                                                                                                                                                                                    | Why                                                                 | Source | Status |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ | ------ |
| D-bkr-1  | 2026-10-25 | The audience is labelled **Admin Booking** everywhere (column header, accessible names such as "Reservation Hold, Admin Booking", docs). The stored id stays `employee` (`BookingRules.employee`, `BookingHold.employee`, `Audience`).   | The id is part of the API, the hold endpoint and many tests; only the word changed | owner  | done   |
| D-bkr-2  | 2026-10-25 | Payment Method at Booking gains **Optional** (`payment: 'optional'`), listed first. Optional: the booker may skip adding a payment method. Payment on File Required: one must be added. Deposit and Prepayment as before. Check-in still needs a payment method (D-check-in). | Owner request; legacy has the same four choices                     | owner  | done   |
| D-bkr-3  | 2026-10-25 | A deposit is `{depositType: 'amount' \| 'percent', depositValue}`, set only while `payment` is `deposit` (both null otherwise). `amount`: cents, an integer above 0. `percent`: 0.01 to 100, at most 2 decimals. Changing the type clears the value because the units differ. A new deposit starts as dollars. | Owner request                                                       | owner  | done   |
| D-bkr-4  | 2026-10-25 | Backward compatibility: the former `depositCents` is read as `{depositType: 'amount', depositValue: depositCents}` by `normalizeAudienceRules` (applied by the HTTP client when it parses); the mock data was migrated the same way (member: amount 9900). The client never sends `depositCents`. | Existing stored values must keep working                            | agent  | done   |
| D-bkr-5  | 2026-10-25 | `depositDueCents(rule, totalCents)` computes the deposit for a stay total: a dollar amount is capped at the total, a percentage is rounded to the nearest cent (halves up), no deposit rule or a total of 0 gives 0. The "Deposit due at booking: $X for a $Y stay" helper line is not built (no total exists on this page). | Keeps the rule pure and ready for the booking flows                  | agent  | done   |
| D-bkr-6  | 2026-10-25 | The HTTP parser coerces an unknown `payment` value to `on-file` (and clears the deposit) instead of blocking the page; an unknown `depositType` is still rejected. A `deposit` with no type is read as dollars. A dollar deposit is $0.01 to $9,999,999.99 (the largest money value used elsewhere). `depositDueCents` clamps to 0..total and returns 0 for non-finite values. The deposit box keeps what is typed and commits the parsed value. | Review of the PR | agent | done |

## Placeholders and invented values

- **P-bkr-1:** the mock member column keeps its 9900 deposit, now `{amount, 9900}`; no percent deposit is in the sample data.

## API, permissions, notes

- **API:** `AudienceRules.payment` adds `optional`; `depositCents` is replaced by `depositType` and `depositValue` (see
  `api-contract.md`, row 17). The 422 `validation` rules match `validateBookingRules`.
- **Permissions:** unchanged.
- **Consumers:** nothing reads the payment rule yet (Epic 5 and the New Reservation panel will use `effectiveRules`
  and `depositDueCents`). When they do: `optional` shows the payment step as skippable, `on-file` requires a payment
  method before the booking is confirmed, `deposit` collects `depositDueCents(rule, total)`, `prepayment` collects the total.
