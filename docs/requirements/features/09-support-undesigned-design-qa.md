# Epics 9, 10 and 11: Support Tickets, undesigned menu items, Design QA

Back to the [index](../README.md). Entry fields are described in [00-foundation.md](00-foundation.md).
Nothing in these epics is built.

## Epic 9: Support Tickets (needs design)

Epic issue: Excia/Guestrooms-Demo#82. Both Figma pages (Open Tickets, Completed Tickets) are empty and no
menu item links to them. The epic has **no tickets**. Owner's draft: "Need your call: drop, or ask the
designer." Unresolved (Q-G-15, D-075). Status: not started.

## Epic 10: Menu items with no design yet (needs design)

Epic issue: Excia/Guestrooms-Demo#83. These menu items appear in the Figma navigation but have no screens.
Each ticket body only repeats the draft criteria (match Figma, use MUI theme tokens, responsive, tests)
and says "Add the exact frame link before moving to Ready." Each route exists today with a placeholder
page and is permission-gated by `page.<id>`.

| Ticket                        | Menu item and route                                  | What we know                                                                                                                                                                              | Status                     |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 10.1 Excia/Guestrooms-Demo#84 | Waitlist, `/waitlist`                                | Waitlist is also a notification trigger category (8.1) and hidden "for now" in online results (5.3)                                                                                       | not started (needs design) |
| 10.2 Excia/Guestrooms-Demo#85 | Add-On Countdown, `/add-on-countdown`                | Shows remaining nightly add-on quantity when "Track Nightly Countdown" is on (7.4, 3.10)                                                                                                  | not started (needs design) |
| 10.3 Excia/Guestrooms-Demo#86 | Member Directory, `/member-directory`                | Future: member and owner names open its listing in a modal (3.11)                                                                                                                         | not started (needs design) |
| 10.4 Excia/Guestrooms-Demo#87 | Room Blocks, `/room-blocks` (beyond Schedule blocks) | Partly designed under Schedule (2.4); the Quick Stats "ALL ROOM BLOCKS" link goes here; the "New Room Closure" tab of the New Reservation panel is selectable but not implemented (D-069) | not started (needs design) |

Open question for all four: a design is needed (Q-83-1).

## Epic 11: Design QA

Epic issue: Excia/Guestrooms-Demo#88. Figma page: Audit Results.

| Ticket                        | Requirement                                                                                        | Current state                                                                                                                                                                   | Status      |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 11.1 Excia/Guestrooms-Demo#89 | Standardize "Return to Site" capitalization (Figma has both "Return to SITE" and "Return to Site") | The header and menu already use exactly "Return to Site" (ticket 0.6 criterion, PR Excia/Guestrooms-Demo#104). Remaining work: check any future screens                         | not started |
| 11.2 Excia/Guestrooms-Demo#90 | Standardize button label casing across the product                                                 | Not started. Figma mixes uppercase CTAs ("SEARCH X NIGHT STAY", "ADD ANOTHER ROOM", "NEW REPORT") with Title Case labels ("Return to Site"); the build follows Figma per screen | not started |

Both ticket bodies carry only the generic draft criteria; the exact casing rule is **Unknown** until the
designer states it (Q-89-1).
