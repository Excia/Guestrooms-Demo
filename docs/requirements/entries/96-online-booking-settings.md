# 7.9 Online Booking settings tab

Ticket Excia/Guestrooms-Demo#96; PR not opened yet. Figma: Online Booking tab 15957:84617.
**Status:** in review (branch `feat/96-online-booking-settings`), 2026-10-24.

## Figma deviations

| ID     | Area                    | Figma                                                              | Built                                                                                  | Why                                                                                   | Choice |
| ------ | ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| F-96-1 | Counters                | "XX / 150" and "XX / 300" placeholders                             | Live counts ("70 / 150")                                                               | The ticket asks for counters                                                          | ticket |
| F-96-2 | Include Link to Full Policy | The URL field is always drawn                                  | The URL field shows only while the switch is on                                        | Same pattern as the other switches that reveal a field (7.1)                          | agent  |
| F-96-3 | Tab order               | Registration Card sits before Online Booking                       | Online Booking follows Folio Details until ticket 7.8 adds Registration Card           | Tickets land separately; the order is fixed when 7.8 merges                           | agent  |

## Open questions

| ID     | Question                                                                                               | Blocks               | Default used                                                                                                                                                                         | Who answers | Status |
| ------ | ------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ |
| Q-96-1 | How does Display Add-Ons Popup here relate to the "Display Add-On Popup" row of Booking Rules (7.5)?   | Online booking (5.x) | This switch is the club-wide master and the per-audience Booking Rules row narrows it: the popup shows only when both allow it (`showAddOnsPopup()` in `src/app/onlineBookingSettings.ts`) | Owner       | open   |
| Q-96-2 | Cancellation fee amount and rules (only a switch is drawn)                                             | Cancellation (2.5, 5.x) | The switch is stored and nothing is charged (D-007)                                                                                                                               | Owner       | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                         | Why                                         | Source        | Status      |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------- | ----------- |
| D-96-1 | 2026-10-24 | The Online Booking values are `SystemSettings.onlineBooking`, saved by the one System Settings Save button and read through `useSystemSettings()`                                | Ticket: "saving with the rest of System Settings" | ticket 7.9 | provisional |
| D-96-2 | 2026-10-24 | The policy link must be an absolute `http` or `https` address with a dotted host; it is checked only while "Include Link to Full Policy" is on, and the link is shown to guests only then | Prevents `javascript:` links                | agent         | provisional |
| D-96-3 | 2026-10-24 | Consumers call `globalBookingMessage()`, `cancellationNotice()` and `showAddOnsPopup()`; the online booking flow (Epic 5) is not built yet, so nothing renders them                | Pure rules ready for 5.x                    | ticket 7.9    | provisional |

## Placeholders and invented values

- **P-96-1:** the default message, agreement text and policy URL in `src/api/systemSettingsData.ts` (`mockOnlineBookingSettings`). The message and URL come from Figma; the agreement text is invented (Figma shows lorem ipsum).

## API, permissions, notes

- **API:** `GET` and `PUT /settings/system` carry a new `onlineBooking` object `{globalMessage (max 150), cancellationAgreement (max 300), includePolicyLink, policyUrl, chargeCancellationFee, showAddOnsPopup}`; the backend re-checks the limits and the URL (422 `validation`). Added to the row of `api-contract.md` by this note, not edited there.
- **Permissions:** none new (admin routes only, ticket 0.8).
