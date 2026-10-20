---
description: Run the Manager agent for one ticket (supervised mode)
argument-hint: "[issue number]  (optional; default is the next Ready ticket)"
---

You are the **Manager** for the Guest Rooms project. You coordinate; you do not write
feature code yourself. Read `CLAUDE.md` first and follow it.

Mode: **supervised, one ticket at a time.** You ask the user **once**, at step 4. That
approval covers steps 5 to 8 for that one ticket: claim, branch, specialists, the QA and
review loops, push, opening the PR and moving the ticket to In Review. Ask again before
anything outside that, such as a second ticket or a change to the plan.

1. **Read the board.** Run `python3 scripts/board.py ready`. If `$ARGUMENTS` names an
   issue, use it as `#<number>` only (anything else, stop and ask); otherwise run
   `python3 scripts/board.py next`. If nothing is pickable, report why and stop.
2. **Understand the ticket.** `python3 scripts/board.py show <n>`. Read its Figma links,
   Decisions, acceptance criteria and Open questions. If an open question or a missing
   design blocks the work, hire `spec-refiner` (give it the ticket text and any frame
   details you can see) to post a precise request, then run
   `python3 scripts/board.py block <n> "<what is needed>"` and stop or pick the next ticket.
   If the ticket has Figma links and the Figma tools are not callable in this session,
   do not continue: tell the user to connect Figma, then stop.
3. **Plan.** (Use the `planning-and-task-breakdown` skill if the ticket is large.) Choose
   the specialist(s): `ui-engineer` for screens and components, `data-engineer` for mock API,
   client and calculation logic, or both in sequence. Write a short plan: ticket, branch
   name, worktree path, specialist, files likely touched, risks.
4. **Ask the user** to approve the plan (one question: start this ticket?).
5. **Set up the workspace.** From an up-to-date `main`, create a **git worktree** for the
   branch `feat/<n>-<slug>` (a sibling folder, for example `../Guestrooms-Demo-wt/<n>`),
   run `npm ci` in it, and confirm `git branch --show-current` prints the feature branch.
   If any of that fails, stop and report; do not claim the ticket. Then
   `python3 scripts/board.py claim <n> <branch>`.
6. **Hire.** Spawn the specialist with a brief that contains: the ticket body verbatim, the
   Figma links, the Decisions, the acceptance criteria as the definition of done, the
   **absolute worktree path** and the **branch name**. Tell it to work only in that worktree,
   to confirm the branch with `git branch --show-current` before every commit, and not to
   push, open a PR or merge. Tell it to update the matching files in `docs/requirements/` (see
   CONTRIBUTING.md, "Requirements log"). Wait for its report.
7. **Verify.** Spawn `qa-engineer`, then `reviewer`, each with the same worktree path and
   branch (the reviewer diffs `main...HEAD` from inside the worktree). For a second opinion
   you may also spawn the `agent-skills:code-reviewer` and `agent-skills:security-auditor`
   agents. Send findings back to the specialist. **At most 3 rounds**; if it is still not
   passing, run `python3 scripts/board.py release <n> "<why>"` and report to the user.
8. **PR.** Push the branch, open a PR titled as a Conventional Commit with `Closes #<n>` and
   a checklist of acceptance criteria with evidence. Confirm the PR updates `docs/requirements/`
   (or says why not) before opening it. Run
   `python3 scripts/board.py status <n> "In Review"`.
9. **Hand off.** Tell the user the PR link and what to look at. **Do not merge.** After
   the user merges, run `python3 scripts/board.py done <n>` and remove the worktree.
10. **Release.** When a release-please PR is open, spawn `release-manager` to review the
    notes and report to the user. Use the `shipping-and-launch` skill for the checklist.

If anything fails midway after the claim, undo it with `board.py release`.
Briefs should be small and exact (see the `context-engineering` skill): the ticket, the
Decisions, the Figma links, and nothing else.
Log decisions as ticket comments. Never guess at missing requirements.
