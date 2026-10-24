# Guest Rooms: instructions for Claude

Product UI for a club guest-room system (schedule, reservations, folios, night audit,
reporting, admin setup, notifications, online booking). Built from the
"CE Guest Rooms" Figma file.

- **Figma (source of truth):** https://www.figma.com/design/WksR3zAy2S8cDsjrVvRklE/CE-Guest-Rooms
  Link a frame with `?node-id=1234-5678`. Ignore annotation links to file key
  `kfShjVI0o5MY5KpGEmsgpw`; that is an older copy.
- **Board:** https://github.com/users/Excia/projects/1 (columns Backlog, Ready, In Progress,
  In Review, Done). Epics are issues labeled `epic`; tickets are their sub-issues.
- **Stack:** React 19, TypeScript, Vite, MUI, Vitest, ESLint. No backend exists yet.

## Commands
`npm run dev` (serves http://localhost:5173) · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
All four checks must pass before a PR (CI runs the same).

## How work gets done
1. A ticket's body is the spec: Figma links, behavior, acceptance criteria, Decisions,
   and Open questions. Acceptance criteria are the definition of done.
2. One branch per ticket: `feat/<issue>-short-name` (or `fix/`, `chore/`, `docs/`).
3. One PR per ticket. **PR title is a Conventional Commit** (`feat: add dashboard layout`),
   body contains `Closes #<issue>`. release-please builds the changelog from PR titles.
4. **Requirements log.** A PR that changes behavior, the API, permissions or a decision, or answers an
   open question, updates the matching file in `docs/requirements/` in the same PR (see CONTRIBUTING.md).
   The Manager checks this before opening the PR.
5. **Who merges.** Only the CEO session (the owner's main orchestrating session) merges PRs, and
   only into `Excia/Guestrooms-Demo`, after CI is green and QA and review have passed. Workers and
   managers (every agent in `.claude/agents`) never merge. Nobody pushes to `main` directly, changes
   repo, branch-protection or Actions settings, or edits the Figma file. Nothing is ever pushed to a
   Clubessential repository. The owner is the human gate: each finished area ends with a
   `human-gate` ticket the owner tests before the area counts as accepted.
6. If a ticket needs an answer that is not in its body (an open question that blocks the
   work, a missing design), stop and mark it blocked rather than guessing:
   `python3 scripts/board.py block <n> "<what is needed>"`.

## Decisions already made (2026-10-16)
- **Backend:** none yet. Build against the typed API client with mock data (ticket 0.10);
  a real API replaces the mock later. Keep the mock behind an interface.
- **Payments:** mock payments interface with hosted-field placeholders; gateway decided later.
- **PDFs and exports:** the backend generates them; the UI requests a file and opens it in a new tab.
- **Revenue in reports:** excludes taxes and service charges. **Average rate:** weighted
  (total revenue divided by total nights).
- **Hold timer:** uses "Reservation Hold" minutes from Booking Rules (per audience).
- **Online cancellation window:** the "Cancellation Period" row in Booking Rules.
- **Check-in** requires a payment method; if none, open the Payment Methods dialog.
- **Permissions:** granular. Build a `can(permission)` API backed by the mock until the
  Permissions page design arrives (pending screenshot from the owner).
- **Responsive:** admin screens are desktop-first and stack below 1200px; online booking
  has real mobile designs.
- **Widget embedding:** a web component, themed per club through CSS variables.

## Code conventions
- Style and spacing come from the MUI theme (`src/theme.ts`, tokens from the Figma
  variables). Never hardcode colors, spacing or fonts in components.
- Accessible by default: labels, roles, keyboard operation, visible focus, WCAG AA contrast.
- Business rules live in pure, unit-tested functions, separate from components.
- Match the surrounding code's naming and comment density. Small, reviewable diffs.

## Plugins agents may use
- **Agent Skills** (plugin): skills such as `frontend-ui-engineering`, `test-driven-development`,
  `source-driven-development`, `security-and-hardening`, `code-review-and-quality`,
  `git-workflow-and-versioning`, `planning-and-task-breakdown`, plus the agents
  `agent-skills:code-reviewer`, `agent-skills:security-auditor`, `agent-skills:test-engineer`.
- **Context7** (MCP plugin): current library docs (MUI, React, Vite, Vitest). Requires the
  owner to authorize it once; if it is not connected, use the official docs and say so.
- **Figma** (MCP plugin): needed by `ui-engineer`. It and `data-engineer` inherit all tools
  on purpose so MCP tools are available; the other agents are read-only by design.

## The board helper
`scripts/board.py` reads and updates the board (retries on GitHub rate limits). Use
`ready`, `next`, `show`, `claim`, `status`, `block`, `comment`, `done`; add `--dry-run`
before a subcommand to preview. Prefer it over ad-hoc `gh project` calls, which are
rate-limited when used in bulk.
