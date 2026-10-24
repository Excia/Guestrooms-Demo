# Ticket entry template

> New rows for decisions, questions, Figma deviations, placeholders and status go in your own file
> `entries/<ticket>-<short-name>.md` (copy [entries/_TEMPLATE.md](entries/_TEMPLATE.md); rules in
> [entries/README.md](entries/README.md)). The epic-file block below is for the narrative only.

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
2. `Status` set in your entry file (do not edit the README status tables; the Manager syncs them).
3. New decision added to your entry with a `D-<ticket>-<n>` ID (decisions.md only for changing an existing row).
4. New or changed endpoint, error or backend rule in [api-contract.md](api-contract.md).
5. New permission in [permissions.md](permissions.md).
6. Questions in your entry (`Q-<ticket>-<n>`); answer an existing one by editing only its row in [open-questions.md](open-questions.md).
7. Invented values in your entry (`P-<ticket>-<n>`); replace an old one by editing only its line in [placeholders.md](placeholders.md).
8. Differences from Figma or missing frames in your entry (`F-<ticket>-<n>`).
9. New domain term in [glossary.md](glossary.md); new rule in [nonfunctional.md](nonfunctional.md); new
   build switch or architecture change in [overview.md](overview.md).
10. `git fetch origin && git merge origin/main` immediately before opening the PR (and again before asking for merge); resolve conflicts yourself.
