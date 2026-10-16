# Contributing

## Workflow

1. Pick a ticket from the [Guestrooms board](https://github.com/users/Excia/projects/1) in **Ready** and move it to **In Progress**.
2. Branch from `main`: `feat/<issue-number>-short-name` (also `fix/`, `chore/`, `docs/`).
3. Build against the Figma link in the ticket. Use the MUI theme for all color, type and spacing.
4. Open a PR whose **title is a Conventional Commit** (`feat: add reservation list`) and whose body says `Closes #<issue>`. Move the ticket to **In Review**.
5. CI must pass (lint, typecheck, test, build). Squash-merge. The ticket moves to **Done**.

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
