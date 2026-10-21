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
- Schedule (`schedule.get`, `moveRoom`, `moveDates`; `GET /schedule`, `POST /schedule/move-room`,
  `POST /schedule/move-dates`): a stay occupies the nights `[startDate, endDate)`, so a departure
  on another stay's arrival day is not an overlap. `get` takes only `startDate` and `days` (7, 14
  or 30) and always answers every room; the answer must echo `startDate` and `days`, every block or
  closure must sit in a listed room and ids must be unique, else `invalid-response`. "Empty" means
  no rooms. **Filtering is client-side** (`applyScheduleFilters` in `src/app/schedule.ts`): the
  drag rules must see every room of a multi-room reservation, which a filtered answer would omit.
  Pure rules live in `src/app/schedule.ts` (range, headers, filters, layout) and
  `src/app/scheduleDrag.ts` (`canDrop`). The client rules only see the loaded window; the server
  stays authoritative (a long stay shifted past the window is guarded by the server's 409).
- Schedule moves are safe to retry and to race. **Concurrency:** every `ScheduleBlock` has an
  opaque `version`; a move sends it back with `fromRoomId` (and `fromStartDate` for `moveDates`).
  If the reservation room changed since (including by a sibling's move), the server answers 409
  `stale` and applies nothing. **Idempotency:** every move carries a client-generated `requestId`
  (UUID; `crypto.randomUUID` with a fallback), sent in the body and as the `Idempotency-Key` header.
  The same id with the same body replays the first result without applying again; the same id with
  another body is 409 `idempotency-conflict`. A timeout or network error (status 0) is an _unknown
  outcome_: the move may have been applied, so the client refetches instead of rolling back.
  CSRF protection and credentials are the auth layer's job (`getHeaders`, `credentials`).
  Backend requirements that follow from this: idempotency records need a TTL (long enough to cover
  client retries, e.g. 24 h); only a failure that applied nothing (a clear 4xx) may be retried with
  the same `requestId`, an unknown outcome is resolved by reloading, not by blind retry; the
  `Idempotency-Key` header is authoritative and a body `requestId` that differs from it is a 400;
  for `all-rooms` only the named block's `version` is checked (a reservation-level version would be
  safer and is the recommended follow-up); ids must be unique across blocks AND closures, because the
  grid looks items up by id. The client treats status 0, 408, 5xx and an unusable 2xx answer as an
  unknown outcome (no revert, reload, neutral message); only 4xx other than 408 means nothing applied.
- Schedule mutations return the changed blocks and apply nothing on error: 400 `invalid-id` /
  `invalid-query`, 404 unknown reservation room or room, 409 `conflict` (a target room is booked or
  closed on those nights; `details.roomId` lists the rooms), 409 `not-movable` (checked out, locked
  room type, arrival of any moving room in the past, dates of a checked-in room), 409 `stale`,
  409 `idempotency-conflict`. `moveDates` scope `all-rooms` shifts every room of the reservation
  (the answer must contain them all, with consistent `roomCount`), `this-room` splits the room off
  (its `roomCount` becomes 1); `toRoomId` changes the room in the same call; a `toStartDate` equal
  to `fromStartDate` is a room change (allowed for checked-in rooms). The mock keeps schedule state
  per client, honours `today` and `scheduleSize: 'large'` (200 rooms), bumps `version` on every
  change and its data is anchored on `MOCK_TODAY` unless `today` is passed.
- Reservation panel (`reservations.getDetail`, `setEarlyLate`, `create`, `settings.getBookingHold`;
  `GET /reservations/:id/detail`, `POST /reservations/:id/early-late`, `POST /reservations`,
  `GET /settings/booking-hold`): `getDetail` must not change anything. `setEarlyLate` carries the
  same `requestId`/`Idempotency-Key` and a reservation `version` as the schedule moves; check order:
  validate, 404, 409 `stale`, then 409 `not-editable` (checked out or canceled). `create` is
  idempotent on `requestId` and the panel keeps one id for an unchanged form, so a retry after an
  unknown outcome (status 0, 408, 5xx) replays; 409 `conflict` and other 4xx applied nothing. The
  New Reservation time limit is a UI countdown from the "Reservation Hold" minutes (employee
  audience for staff): nothing holds the room server-side yet. A real backend needs a hold/reserve
  call when the panel opens and a hold token sent with `create`. The mock never answers a
  `cancelled` reservation (no cancelled block exists), but the UI and the CTA rules handle it.
  Early/Late and the edge markers are reservation-level; the grid mirrors them on its blocks.
- Change room during a stay (`reservations.changeRoomDuringStay`, `settings.getRoomChangeRule`;
  `POST /reservation-rooms/:id/change-room`, `GET /settings/room-change-rule`): same safety as the schedule
  moves (`version`, `fromRoomId`, `requestId` / `Idempotency-Key`, 409 `stale` / `conflict` / `not-movable` /
  `idempotency-conflict`, unknown-outcome semantics) for a checked-in reservation room. The nights before
  `effectiveDate` stay in the old room as a `previous` segment (`ScheduleBlock.roomChange`), the rest move; the
  answer must match the request. Rates: integer cents excluding taxes, nights before today never repriced,
  `rateChoice` `retain|update|null`. Details in `docs/requirements/api-contract.md`.
- Server `message` and `details` are untrusted text: render them as text, never as HTML.
- Ids go into URL paths; empty ids, `.` and `..` are rejected client-side (`invalid-id`, 400).
- `permissionsFromGrant` keeps only permissions the app knows; unknown strings are dropped.
- Mutations and idempotency keys are deferred to the tickets that need them.
- The permissions grant `permissions: 'all'` sentinel has to be agreed with the backend. Consumers
  go through `permissionsFromGrant`, which denies anything that is not `'all'` or an array.
- Money is integer cents and dates are ISO strings; branded types for them are a possible
  follow-up.
