# Ticket entry template

Copy the block below into the matching epic file under [features/](features/) when a ticket starts or
changes, fill every line (write "none" or "Unknown" rather than leaving a line out), and update the status
tables in [README.md](README.md). Keep wording faithful to the ticket body; do not invent requirements.

```markdown
## <ticket number and title, e.g. 3.5 Check in>

Ticket Excia/Guestrooms-Demo#<issue>; PR Excia/Guestrooms-Demo#<pr> (<release or "open">). Figma: <frame
names and node ids, or "no frame">.

- **Requirements:** <behavior and acceptance criteria, summarized faithfully from the ticket body>.
- **Implemented:** <what exists and where in the code (`src/...`); "nothing" if not started>.
- **Deviations from Figma or the ticket:** <what differs and why; link the row in figma-deviations.md>.
- **Assumptions and defaults chosen:** <defaults an agent or the owner chose; link decisions D-###>.
- **Stubs and placeholders:** <what is faked or temporary; link placeholders.md>.
- **API:** <endpoints touched or needed; link api-contract.md>.
- **Permissions:** <permission ids used or needed; link permissions.md>.
- **Open questions:** <Q-ids from open-questions.md; add new rows there>.
- **Status:** <done | in review | in progress | not started | needs design>, <PR link>, <date>.
```

## Checklist when you touch a ticket

1. Entry above written or updated in the epic file.
2. Status tables in the README updated (status, PR link).
3. New or changed decision added to [decisions.md](decisions.md) (id, date, why, source, status).
4. New or changed endpoint, error or backend rule in [api-contract.md](api-contract.md).
5. New permission in [permissions.md](permissions.md).
6. Questions added or answered (status, date, answer) in [open-questions.md](open-questions.md).
7. Invented values added or replaced in [placeholders.md](placeholders.md).
8. Differences from Figma or missing frames in [figma-deviations.md](figma-deviations.md).
9. New domain term in [glossary.md](glossary.md); new rule in [nonfunctional.md](nonfunctional.md); new
   build switch or architecture change in [overview.md](overview.md).
