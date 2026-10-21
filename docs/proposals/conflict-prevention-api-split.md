# Proposal: split the shared API and routing files per area

Status: proposal, not done. Written with the PR "chore: reduce merge conflicts in shared files".

## Problem (measured on the last 30 PRs)

Edited by 10+ of 30 PRs: `src/App.tsx` (13), `src/app/routes.ts`, `src/api/{mock,http,types,lazy,unavailable}.ts`
(11 to 12 each). Of these, `lazy.ts` and `unavailable.ts` are fixed in that PR (derived by name, no per-method
list). The rest are still single files that every endpoint touches.

## Proposed change

| File today | Lines | Split into | Effect |
| --- | --- | --- | --- |
| `src/api/types.ts` | ~790 | `src/api/types/<area>.ts` (dashboard, reservations, reservationList, schedule, folios, members, settings, systemSettings, permissions, reports) + `types/index.ts` re-exporting and composing `ApiClient` | a new area adds a file and one line in `index.ts`; existing imports of `./types` keep working |
| `src/api/http.ts` | ~860 | `src/api/http/<area>.ts` each exporting `createXHttp(request): XApi` plus its guards; `http.ts` keeps the transport, errors and `createHttpClient` composing areas | guards and parsers move with their area |
| `src/api/mock.ts` | ~370 | `src/api/mock/<area>.ts` each exporting `createXMock(ctx): XApi`; `mock.ts` composes | same |
| `src/App.tsx` | ~140 | route elements move into `src/app/routeElements.ts`-style per-area modules (`routes/<area>.tsx`) that `App.tsx` maps over | a page adds a file, not lines in `App.tsx` |
| `src/app/routes.ts` | ~115 | `src/app/routes/<area>.ts` arrays concatenated in `routes/index.ts` (order of the menu is the concatenation order, set once) | same |

Not shared problems: `package.json`, `package-lock.json`, `CHANGELOG.md`, `.release-please-manifest.json` conflicts
come from release PRs and dependency changes; the new rule "merge `origin/main` before opening" covers them.

## Effort and risk

About 1.5 to 2 days for one engineer, in two or three PRs (types; http+mock; routes+App). Behavior-neutral, but
the diffs are large moves (about 2,500 lines), so it must land when no other API PR is open, or every open
branch conflicts once. That is why it is a proposal: do it in a quiet window, with all branches merged first,
then announce it. Tests must stay green as the only acceptance check; `src/api/*.test.ts` already covers
every area.
