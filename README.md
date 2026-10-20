# Guest Rooms

Guest Rooms product UI, built with React, TypeScript, Vite and MUI from the
"CE Guest Rooms" Figma file.

## Develop

```bash
npm install
npm run dev
```

Scripts: `lint`, `typecheck`, `test`, `build`, `format`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the ticket, branch and release workflow.

## Environment variables

Copy `.env.example` to `.env.local` to override.

- `VITE_AXIS_URL`: absolute http(s) URL of the main Axis site, used by "Return to Site" in the header.
  A missing or invalid value falls back to `/` (and logs a warning in dev). The real value per
  environment is still to be supplied by the project owner.
- `VITE_API_URL`: absolute http(s) URL of the backend API (query and hash are dropped; `http` outside
  localhost logs a warning). Set it and every build uses the fetch client in `src/api/http.ts`, with
  no code changes. Public configuration only, never secrets.
- `VITE_API_MODE=mock`: opt in to the in-memory mock (`src/api/mock.ts`) in any build, for a hosted
  demo. It applies only when `VITE_API_URL` is unset; if both are set the URL wins and a console
  warning says so. Builds using the mock outside dev show a "Demo data" chip. The mock is a
  separate chunk, loaded only when used.
- `VITE_MOCK_SCENARIO`: `normal` (default), `loading`, `empty` or `error`; what the mock returns.
  Honoured in dev, and in a build only together with `VITE_API_MODE=mock`.
- Dev only: add `?mock=empty` to the URL (kept across the `/` redirect) or run
  `localStorage.setItem('gr.mock', 'error')` and reload. The query wins over storage, which wins
  over `VITE_MOCK_SCENARIO`. Production builds ignore both.

| Build      | `VITE_API_URL`   | `VITE_API_MODE`                       | Client                                                                 |
| ---------- | ---------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| dev        | unset or invalid | any                                   | mock (invalid URL logs a warning)                                      |
| dev        | valid            | any                                   | real                                                                   |
| production | valid            | any (`mock` logs a warning, URL wins) | real                                                                   |
| production | unset            | `mock`                                | mock + "Demo data" chip                                                |
| production | unset            | unset                                 | no data: `console.error`, every call rejects with code `misconfigured` |
| production | invalid          | any                                   | same as above; an invalid URL is never replaced by mock data           |

## API conventions

- Every client method takes `options?: { signal }` last; aborting rejects with an `AbortError`
  (not an `ApiError`). The fetch client times out after 15 s (`ApiError` status 0, code `timeout`).
- Errors are `ApiError` with `status`, optional `code` and field `details`. Status 0 means no
  response (`network` or `timeout`). Non-JSON or malformed bodies become `invalid-response` errors.
- Lists return `{ items, total, nextCursor? }`; cursors are opaque. Reservations support
  `status`, `search`, arrival/departure date ranges, `sort` and `limit`.
- `createHttpClient` sends `credentials: 'same-origin'` by default; pass `credentials: 'include'`
  for a cross-origin cookie API. That is a placeholder until auth is designed. `getHeaders` (a
  failure there is an `ApiError` with code `headers`) and `onUnauthorized` (called on any 401) are
  hooks; nothing uses them yet.
- Responses get light shape guards on the fields consumers rely on (ids, statuses, counts, list
  shapes), not full schema validation. A mismatch is an `invalid-response` error.
- Quick Stats (`dashboard.getQuickStats`): the answer's `view` and echoed period (`date`,
  `startDate`, `month`) must match the query, else `invalid-response`. Money is integer cents and
  excludes taxes and service charges; the average rate is weighted (revenue / nights), `null`
  without nights. Occupancy percent is rounded by the backend; a TOTAL row's percent is the mean of
  the row percents. "Empty" means no revenue rows and no room blocks (day, month) or days (week);
  a week with no data answers `days: []`.
- Server `message` and `details` are untrusted text: render them as text, never as HTML.
- Ids go into URL paths; empty ids, `.` and `..` are rejected client-side (`invalid-id`, 400).
- `permissionsFromGrant` keeps only permissions the app knows; unknown strings are dropped.
- Mutations and idempotency keys are deferred to the tickets that need them.
- The permissions grant `permissions: 'all'` sentinel has to be agreed with the backend. Consumers
  go through `permissionsFromGrant`, which denies anything that is not `'all'` or an array.
- Money is integer cents and dates are ISO strings; branded types for them are a possible
  follow-up.
