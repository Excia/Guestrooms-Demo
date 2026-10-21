# Per-ticket requirements entries

Why this folder exists: the shared tables (`figma-deviations.md`, `open-questions.md`,
`placeholders.md`, `decisions.md`, the status tables in `README.md`) were appended to by every PR, so
parallel PRs conflicted on the same lines. **New rows no longer go into those files.** Each ticket
writes one file here instead; two tickets never touch the same file, so they cannot conflict.

## Rules

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `entries/<ticket>-<short-name>.md` (e.g. `3-5-check-in.md`,
   `chore-conflict-prevention.md`). Delete the sections you do not need.
2. **IDs are ticket-scoped, so they never collide:** `F-<ticket>-<n>` (Figma deviation),
   `Q-<ticket>-<n>` (question), `D-<ticket>-<n>` (decision), `P-<ticket>-<n>` (placeholder), where
   `<ticket>` is the ticket's number with dots as dashes (`3-5`) or the issue number. Number from 1
   inside your own file. Never take "the next free number" from a shared file.
3. Answering or changing an **existing** row (`Q-83-1`, `D-025`, deviation 17...) is still an edit to
   the shared file, but only to that row. Edit that line only, no reflowing or re-padding the table.
4. Do not edit the status tables in `README.md`; put your `Status` line in your entry. The Manager syncs
   the README tables after merges, in one place.
5. Legacy IDs (`D-001`..`D-075`, `Q-*` as they are, deviations 1..N) stay valid and stay in their files.
6. Reference an entry from code or docs by its ID plus file, e.g. `Q-3-5-1` in `entries/3-5-check-in.md`.

## Reading everything at once

`python3 scripts/requirements_index.py` prints a combined index of all entries (ID, title, status,
file) and writes nothing. It is not committed, so it cannot conflict either.
