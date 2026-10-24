# 7.8 Registration Card setting and PDF

Ticket Excia/Guestrooms-Demo#95; PR not opened yet. Figma: Registration Card tab 13319:41951, PDF 15957:187196.
**Status:** in review (branch `feat/95-registration-card`), 2026-10-24.

## Figma deviations

| ID     | Area                | Figma                                              | Built                                                                                                                                   | Why                                                                                               | Choice |
| ------ | ------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| F-95-1 | Live preview        | No preview panel; only the Generate Preview button | Generate Preview asks the backend (mocked) to render a sample card from the unsaved settings and opens it in a new tab; no inline panel | Decision D-003 (PDFs come from the backend, opened in a new tab) over the ticket's "live preview" | agent  |
| F-95-2 | Custom Text counter | "XX /500" under the text box                       | Live count "N / 500" and the box shows only while Custom Text is checked                                                                | Figma shows the box only in the checked state                                                     | agent  |
| F-95-3 | Disabled card       | Not drawn                                          | With Enable Registration Card off, every item, the text and Generate Preview are disabled (values kept)                                 | Items have no meaning while the card is off                                                       | agent  |
| F-95-4 | Tab order           | Online Booking follows Registration Card           | Registration Card follows Folio Details until ticket 7.9 adds Online Booking                                                            | Tickets land separately                                                                           | agent  |
| F-95-5 | PDF layout          | The frame shows every item filled in               | Only the checked items print; a block with nothing in it is left out and the grid collapses (see `buildRegistrationCard`)               | The ticket says "Layout shows only the checked items for the reservation"                         | ticket |

## Open questions

| ID     | Question                                                                                                                       | Blocks         | Default used                                                                                                                     | Who answers | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| Q-95-1 | Registration card layout: fixed fields or checkbox-driven (the annotation lists both)                                          | PDF            | Checkbox-driven: only checked items print (existing row `Q-95-1` in `open-questions.md`, not edited)                             | Designer    | open   |
| Q-95-2 | Does a multi-room reservation print one card per room, or one card listing the rooms?                                          | PDF            | The menu says "Print Registration Card(s)"; the model describes one room per card, so the backend should print one card per room | Owner       | open   |
| Q-95-3 | What does the Early Check In / Late Check Out flag print when its date is unchecked?                                           | PDF            | Nothing: the flag sits under its date (Figma 15957:187205), so it needs Check In Date (or Check Out Date) checked                | Designer    | open   |
| Q-95-4 | Where does the card get the system name in the folio header (Figma "System Name"), which Folio Details does not hold?          | PDF            | The backend uses the club's name; the mock uses "Pine Ridge Club"                                                                | Backend     | open   |
| Q-95-5 | Should the card print automatically at check in while the setting is on ("a registration card will be printed upon check-in")? | Check in (3.5) | Not built: no printer integration exists. Only the Print Registration Card(s) menu action follows the setting                    | Owner       | open   |

## Decisions

| ID     | Date       | Decision                                                                                                                                                                                                              | Why                                                        | Source     | Status      |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ----------- |
| D-95-1 | 2026-10-24 | The settings are `SystemSettings.registrationCard` (`enabled`, `items` by id, `customText`), saved by the one System Settings Save button                                                                             | Ticket 7.1 pattern                                         | ticket 7.8 | provisional |
| D-95-2 | 2026-10-24 | A phone or address depends on its name: unchecking the name unchecks and disables them, and the card ignores them while the name is off (`setItem`, `effectiveItems`)                                                 | Figma annotation                                           | Figma      | provisional |
| D-95-3 | 2026-10-24 | "Reserver Name (if unique)" prints only when the reservation has a reserver who is not the lead occupant (same member number, else same name ignoring case); otherwise the Reserved By block is left out              | Ticket: "reserver-hidden case"                             | ticket 7.8 | provisional |
| D-95-4 | 2026-10-24 | Average Room Rate is total room revenue (no taxes or service charges) divided by total nights, rounded to the cent                                                                                                    | D-005 (weighted average, revenue excludes taxes)           | decisions  | provisional |
| D-95-5 | 2026-10-24 | Print Registration Card(s) is removed from the reservation menus while the switch is off; while the settings are unknown (not loaded, no provider) it stays (`registrationCardEnabled` in `reservationMenu`)          | Ticket; a flash of a missing item is worse than a stub PDF | ticket 7.8 | provisional |
| D-95-6 | 2026-10-24 | Generate Preview opens a blank tab inside the click and points it at the address the backend returns, so a popup blocker allows it; only http, https, blob or site-path addresses are opened (`isOpenablePreviewUrl`) | Popup rules; no `javascript:` addresses                    | agent      | provisional |

## Placeholders and invented values

- **P-95-1:** the default custom text in `src/api/systemSettingsData.ts` (`mockSystemSettings`), the sample reservation and "Pine Ridge Club" in `src/api/registrationCardData.ts`. The mock renders a printable HTML page instead of a PDF; the backend renders the real PDF.

## API, permissions, notes

- **API:** `GET` and `PUT /settings/system` carry `registrationCard`; new `POST /registration-card/preview` (see the section "Registration Card (ticket 7.8)" in `api-contract.md`). The card of a reservation keeps the stub path `/files/registration-cards/<reservationId>.pdf` from ticket 2.5 (P-22-1).
- **Permissions:** none new (admin routes only, ticket 0.8).
- **Notes:** the rules are in `src/app/registrationCard.ts` so the backend's generator can mirror them (`buildRegistrationCard` is the reference).
