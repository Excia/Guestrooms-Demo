# Manager agent

A Claude Code session acts as the **Manager**: it reads the board, picks the next Ready
ticket, hires a specialist agent, verifies the result, opens a PR, and hands it to a human.
It coordinates; it does not write feature code itself.

## Team (`.claude/agents/`)

| Agent | Job |
|---|---|
| `ui-engineer` | MUI screens and components from Figma frames, with unit tests |
| `data-engineer` | Typed API client, mock data, rates/totals/report logic |
| `qa-engineer` | Verifies the branch against every acceptance criterion; verifies, does not fix |
| `reviewer` | Diff review for correctness, security, performance |
| `release-manager` | Reviews the release-please PR and notes before a human merges |
| `spec-refiner` | Turns blocked or undesigned tickets into a precise designer or owner request |

## How to run it

In Claude Code, inside this repo:

```
/run-manager          # next Ready ticket
/run-manager 6        # a specific ticket
```

Mode today is **supervised, one ticket at a time**: the Manager asks before spawning
specialists or touching the board, and a human merges every PR.

## Picking rules (`scripts/board.py next`)
- Only tickets in **Ready**, not labeled `epic`, `blocked` or `agent:working`.
- Epic order: 0 Foundation, 1 Dashboard, 3 Reservations, 4 Folios, 2 Schedule,
  8 Notifications, 7 Admin Setup, 6 Reporting, 5 Online Booking, then the rest; ticket
  number within an epic.
- The board's **Depends on** field lists issue numbers that must be **Done** first.
- A ticket whose Open questions block the work is sent back with `board.py block`.

## Guardrails
- Humans merge PRs and releases. Agents never push to `main` or change repo settings.
- Agents never edit Figma.
- Every decision is logged as a ticket comment; no guessing at missing requirements.

## Rollout
1. **Phase 0 (now):** supervised, one ticket at a time, starting with Foundation 0.5 (theme).
2. **Phase 1:** a few parallel tickets in different areas (separate worktrees).
3. **Phase 2:** scheduled runs that pick up Ready tickets on their own; humans review PRs.
