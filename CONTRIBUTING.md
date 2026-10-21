# Contributing

## Workflow

1. Pick a ticket from the [Guestrooms board](https://github.com/users/Excia/projects/1) in **Ready** and move it to **In Progress**.
2. Branch from `main`: `feat/<issue-number>-short-name` (also `fix/`, `chore/`, `docs/`).
3. Build against the Figma link in the ticket. Use the MUI theme for all color, type and spacing.
4. Open a PR whose **title is a Conventional Commit** (`feat: add reservation list`) and whose body says `Closes #<issue>`. Move the ticket to **In Review**.
5. CI must pass (lint, typecheck, test, build). Squash-merge. The ticket moves to **Done**.

## Requirements log

The running requirements documentation lives in [`docs/requirements/`](docs/requirements/README.md): decisions,
API contract, permissions, open questions, placeholders, Figma deviations and the status of every ticket.
**Every PR that changes behavior, the API, permissions or a decision, or that answers an open question,
updates the matching file(s) in the same PR.** The Manager checks this before opening a PR, and the PR
template has a checkbox for it.

| If the PR... | Update |
|---|---|
| builds, changes or stubs a ticket's behavior, or changes its status or PR link | the epic file in `docs/requirements/features/` (copy `TEMPLATE-ticket.md`) and the status tables in `docs/requirements/README.md` |
| makes or changes a decision, or records an owner message | `docs/requirements/decisions.md` |
| adds or changes an endpoint, header, error code, shape or backend rule | `docs/requirements/api-contract.md` |
| adds or changes a permission or a mock user | `docs/requirements/permissions.md` |
| raises a question, or answers one (set status, date and answer) | `docs/requirements/open-questions.md` |
| adds invented sample data, or replaces a placeholder | `docs/requirements/placeholders.md` |
| differs from Figma, or finds a missing frame | `docs/requirements/figma-deviations.md` |
| adds an env variable, route, build switch or architecture change | `docs/requirements/overview.md` |
| adds a domain term, or an accessibility, responsive, performance, security or test rule | `docs/requirements/glossary.md`, `docs/requirements/nonfunctional.md` |

If nothing in `docs/requirements/` needs to change, tick the PR template box as "n/a" and say why.

## Board columns

Backlog, Ready, In Progress, In Review, Done.

## Releases and release notes

Releases are automated by [release-please](https://github.com/googleapis/release-please).
Every squash-merged PR title feeds the changelog:

| Prefix | Effect |
|--------|--------|
| `feat:` | minor bump, listed under Features |
| `fix:` | patch bump, listed under Bug Fixes |
| `feat!:` or `BREAKING CHANGE:` | major bump |
| `chore:`, `docs:`, `test:`, `ci:` | no release on their own |

release-please keeps a "Release PR" open on `main`. Merging it tags the version, updates
`CHANGELOG.md` and publishes the GitHub Release with the notes.

## Labels

- `epic`, `type:feature`, `type:chore`, `type:design-qa`
- `area:*` one per epic
- `needs-design` when no Figma frame exists yet
- `size:S`, `size:M`, `size:L`
