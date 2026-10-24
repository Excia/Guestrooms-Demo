# API contract (what the backend must provide)

Derived from `src/api/types.ts` (the typed contract), `src/api/http.ts` (the real client: paths,
headers, guards), `src/api/validation.ts`, the mock in `src/api/mock.ts`, the README "API
conventions" and the tickets. **No backend exists yet** (D-001); all paths below are the client's
choice and the backend must confirm them (D-038, Q-G-3). Back to the [index](README.md).

Sections: [Conventions](#conventions) · [Implemented endpoints](#implemented-endpoints) ·
[Reservation panel endpoints (PR 119)](#reservation-panel-endpoints-pr-119) ·
[Error codes](#error-codes) · [Concurrency and idempotency](#concurrency-and-idempotency) ·
[Shape guards](#shape-guards-and-their-limits) · [Server-side enforcement](#server-side-enforcement) ·
[Planned endpoints](#planned-endpoints).

## Conventions

| Topic        | Rule                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base URL     | `VITE_API_URL` (absolute http(s); query and hash dropped; trailing slashes trimmed). Paths below are appended to it                                                                                                                                                                                                                                    |
| Format       | JSON in and out. Requests send `Accept: application/json`; bodies send `Content-Type: application/json`. A 204 or empty body parses as `undefined` and each endpoint decides whether that is valid (all current ones require a body)                                                                                                                   |
| Auth         | Not designed. The client sends `credentials: 'same-origin'` by default (`'include'` is an option for a cross-origin cookie API). Hooks `getHeaders` (extra headers; a failure is `ApiError` code `headers`) and `onUnauthorized` (called on any 401) exist and nothing uses them yet. CSRF protection and credentials are the auth layer's job (Q-G-4) |
| Timeout      | 15 s per request; the client then rejects with status 0, code `timeout`                                                                                                                                                                                                                                                                                |
| Abort        | Every method takes `{ signal }` last; aborting rejects with an `AbortError` (not an `ApiError`)                                                                                                                                                                                                                                                        |
| Ids in paths | Encoded with `encodeURIComponent`; empty ids, `.` and `..` are rejected client-side (`invalid-id`, 400)                                                                                                                                                                                                                                                |
| Money        | **Integer cents** (`Cents`). Revenue excludes taxes and service charges (D-004). Average rate is weighted: total revenue divided by total nights, rounded to whole cents; `null` when there are no nights (D-005)                                                                                                                                      |
| Dates        | ISO `YYYY-MM-DD` strings (`IsoDate`); months `YYYY-MM`. A stay occupies the nights `[startDate, endDate)`: `endDate` is the departure day and is not occupied, so a departure on another stay's arrival day is a same-day turnover, not an overlap                                                                                                     |
| Lists        | `{ items, total, nextCursor? }`; `total` counts all matches; cursors are opaque; `nextCursor` is absent on the last page                                                                                                                                                                                                                               |
| Errors       | Non-2xx: JSON body `{ message?, error?, code?, details? }`; `details` is `Record<string, string[]>` (field errors). Non-JSON bodies keep the status text. `message` and `details` are **untrusted text** and are rendered as text, never HTML                                                                                                          |
| Status 0     | Not an HTTP status: the client got no response (`network` or `timeout`)                                                                                                                                                                                                                                                                                |

## Implemented endpoints

All present in `createHttpClient` (`src/api/http.ts`) and in the mock.

| #   | Method and path              | Query / body                                                                                                                  | Response                                                                                                                                                                           | Errors                                                                     |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `GET /permissions/me`        | none                                                                                                                          | `PermissionGrant { role: string, permissions: string[] \| 'all' }`                                                                                                                 | 401, 5xx                                                                   |
| 2   | `GET /dashboard/stats`       | none                                                                                                                          | `DashboardStats` (date, arrivalsToday, departuresToday, inHouse, occupancyPercent, rateCategories[], roomBlocks[], unassignedChargesCount, totalRevenue, totalNights, averageRate) | 5xx                                                                        |
| 3   | `GET /dashboard/quick-stats` | `view=day\|week\|month` plus `date` (day), `startDate` (week) or `month` (`YYYY-MM`)                                          | `QuickStats` (see below)                                                                                                                                                           | 400 `invalid-query`, 5xx                                                   |
| 4   | `GET /reservations`          | `status`, `search`, `arrivalFrom`, `arrivalTo`, `departureFrom`, `departureTo`, `sort=<field>:<asc\|desc>`, `cursor`, `limit` | `Page<Reservation>`                                                                                                                                                                | 5xx                                                                        |
| 5   | `GET /reservations/{id}`     | none                                                                                                                          | `Reservation`                                                                                                                                                                      | 400 `invalid-id`, 404                                                      |
| 6   | `GET /schedule`              | `startDate`, `days` (7, 14 or 30)                                                                                             | `ScheduleData`                                                                                                                                                                     | 400 `invalid-query`                                                        |
| 7   | `POST /schedule/move-room`   | `MoveRoomRequest`; header `Idempotency-Key`                                                                                   | `{ blocks: ScheduleBlock[] }`                                                                                                                                                      | 400, 404, 409 (`conflict`, `not-movable`, `stale`, `idempotency-conflict`) |
| 8   | `POST /schedule/move-dates`  | `MoveDatesRequest`; header `Idempotency-Key`                                                                                  | `{ blocks: ScheduleBlock[] }`                                                                                                                                                      | same as 7                                                                  |

Notes on `Reservation` (list/get): `id`, `confirmationNumber`, `guestName`, `roomType`, `roomNumber`
(null until a room is assigned), `arrival`, `departure`, `adults`, `children`, `status`
(`pending`, `confirmed`, `checked-in`, `checked-out`, `cancelled`), `rateCategoryId`,
`hasUnassignedCharges`. `search` matches guest name or confirmation number, case-insensitively; bounds are
inclusive; default sort is arrival ascending, ties broken by id so paging is stable; the server applies its
own default and maximum `limit`. Sort fields: `arrival`, `departure`, `guestName`, `confirmationNumber`.

### Quick Stats (`GET /dashboard/quick-stats`)

- The answer's `view` and echoed period (`date`, `startDate` or `month`) **must equal the query**, else
  the client raises `invalid-response`. "(to date)" in the UI is a label only; the query carries the month.
- Every answer has `occupancy {booked, available, percent}` and `revenue {rows[], totalRevenue,
totalNights, averageRate}`; rows are one per rate category in the data (not a fixed list), each
  `{id, name, nights, revenue}`.
- Day and month add `roomBlocks[] {id, name, nights, startDate, counts}` and `roomBlocksTotal`; week adds
  `days[] {date, counts}` and `daysTotal`.
- Percent is 0 to 100 with at most one decimal. **The backend owns rounding; the UI never recomputes a
  percent.** In every TOTAL row (`roomBlocksTotal`, `daysTotal`, the summary bar) the percent is the mean of
  the row percents, not total booked over total rooms (D-043). Totals sum booked and available.
- **Empty** means no revenue rows and no `roomBlocks` (day, month) or `days` (week). A week with no data
  must answer `days: []`, not seven zero days; a period with rows but all zeros is not empty (D-045).

### Schedule (`GET /schedule`)

- Takes **only** `startDate` and `days`; it always answers **every room** (filtering is client-side, D-053).
  The answer must echo `startDate` and `days`; `locations` and `roomTypes` are the full option lists;
  `rooms` are in display order; `blocks` and `closures` overlap `[startDate, startDate + days)`.
- `ScheduleBlock`: `kind: 'reservation'`, `id` (the reservation-room id), `reservationId`,
  `confirmationNumber`, `guestName`, `guestType` (`guest|member|owner|none`), `roomId`, `startDate`,
  `endDate` (exclusive), `status` (`confirmed`, `nyci` = Not Yet Checked In with arrival reached,
  `checked-in`, `checked-out`; a "due out" block is a checked-in one ending today), `roomCount`
  (rooms on the reservation; blocks with the same `reservationId` move together), `roomTypeLocked`,
  `version` (opaque, never parsed or compared by the client), optional `earlyCheckIn` / `lateCheckOut`, and
  optional `roomChange {part: 'previous'|'current'|'next', index, count, stayId}` when the stay changed room
  during the stay (ticket 2.3);
  `ScheduleRoom.housekeeping` (`clean|dirty`) is optional and a placeholder.
- `ScheduleClosure`: `kind: 'closure'`, `id`, `roomId`, `startDate`, `endDate`, `reason`, `endMarker`.
- Every block and closure must sit in a listed room; **ids must be unique across blocks and closures**
  (the grid looks items up by id); rooms unique. "Empty" means no rooms.
- The client's drag rules only see the loaded window; the server's 409 stays authoritative (a long stay
  shifted past the window, or a booking outside it).

### Schedule moves

- `MoveRoomRequest`: `reservationRoomId`, `toRoomId`, `fromRoomId`, `version`, `requestId`.
- `MoveDatesRequest`: `reservationRoomId`, `fromStartDate`, `toStartDate`, `scope` (`all-rooms` shifts
  every room of the reservation by the same number of days; `this-room` splits the room off and its
  `roomCount` becomes 1), optional `toRoomId` (room and dates in one atomic call), `fromRoomId`, `version`,
  `requestId`. A `toStartDate` equal to `fromStartDate` is a room change only (allowed for checked-in rooms).
- Answer: the changed blocks only. For `all-rooms` with new dates the answer must contain **all** rooms of
  the reservation with a consistent `roomCount`; for `this-room` with new dates the moved block must have
  `roomCount` 1; a room-only move may answer with just the moved block.
- Rules the server enforces (409 `not-movable` unless noted): checked-out rooms cannot move; a locked room
  type cannot leave its room type; **no room's new arrival may be in the past** (every moving room, not
  only the dragged one); a checked-in or checked-out room cannot change dates (a sibling in either state
  blocks an `all-rooms` shift); a target room booked or closed on any of the nights is 409 `conflict` with
  `details.roomId` listing the rooms (including two rooms of one reservation landing in one room).
  Unknown reservation room or room: 404. Nothing is applied on any error.
- `fromRoomId` and, for dates, `fromStartDate`, plus `version`, must still match, else 409 `stale`.

## Reservation panel endpoints (PR 119)

Added by Excia/Guestrooms-Demo#119 (merged 2026-10-21; paths and shapes are the client's choice until the
backend confirms them, D-038; see also
[02-schedule.md](features/02-schedule.md#22-reservation-details-panel-with-split-cta)). Paths are the
ones in `createHttpClient` (`src/api/http.ts`).

| #   | Method and path                      | Request                                                                                                                                                                                                                                                                                                            | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Errors                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `GET /reservations/{id}/detail`      | none (must not change anything)                                                                                                                                                                                                                                                                                    | `ReservationDetail` (id, confirmationNumber, status, arrival, departure, nights, adults, children, leadOccupant {name, memberNumber, guestType}, rooms[] {id, roomId, roomNumber, locationName, roomTypeName, status `nyci\|checked-in\|checked-out`, arrival, departure}, earlyCheckIn, lateCheckOut, addOns[] {id, name, quantity, priceCents per unit excluding taxes and service charges}, publicNotes, privateNotes, stay {lines[] {roomType, date, amountCents}, folioTotalCents excluding taxes and service charges}, version) | 400, 404                                                                                                                                     |
| 10  | `POST /reservations/{id}/early-late` | `EarlyLateRequest {requestId, reservationId, version, earlyCheckIn?, lateCheckOut?}` (send only the changed flags); `Idempotency-Key`                                                                                                                                                                              | `{ earlyCheckIn, lateCheckOut, version }` (the flags must match what was asked, else the client treats it as a failed save)                                                                                                                                                                                                                                                                                                                                                                                                           | 400, 404, 409 `stale`, 409 `not-editable` (checked out or cancelled), 409 `idempotency-conflict`                                             |
| 11  | `POST /reservations`                 | `CreateReservationRequest {requestId, roomId? (null or absent = Unassigned), arrival, departure, adults, children, guestName (the booking guest, "TBD" when not chosen), bookingGuestId?, bookingGuestRole `occupant\|reserver`, leadOccupant? {name, memberId?}, publicNotes?, privateNotes?}`; `Idempotency-Key` | `ReservationDetail` of the new one-room reservation (must echo adults, children, one room, `roomId` (null when Unassigned), arrival, departure and the lead occupant: for `occupant` the booking guest, for `reserver` the `leadOccupant` name or "TBD")                                                                                                                                                                                                                                                                              | 400 `invalid-query`, 404 unknown room, 409 `conflict` (room booked or closed; only checked when a room is given), 409 `idempotency-conflict` |
| 12  | `GET /settings/booking-hold`         | none                                                                                                                                                                                                                                                                                                               | `BookingHold { employee, member, nonMember }`, each an integer 1 to 99 (minutes; "Reservation Hold" of Booking Rules)                                                                                                                                                                                                                                                                                                                                                                                                                 | 5xx                                                                                                                                          |
| 13  | `GET /members`                       | `q` (matches name, member number or email, case-insensitive; at most 200 characters), `limit`                                                                                                                                                                                                                      | `Page<Member>` (`Member {id, memberNumber, name, email, phone}`); the mock answers 8 by default, at most 50                                                                                                                                                                                                                                                                                                                                                                                                                           | 400 `invalid-query`, 5xx                                                                                                                     |
| 14  | `POST /members`                      | `CreateMemberRequest {requestId, name, email?, phone?}`; `Idempotency-Key`                                                                                                                                                                                                                                         | the new `Member` (idempotent on `requestId`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 400 `invalid-query`, 409 `idempotency-conflict`                                                                                              |
| 15  | `GET /settings/system`, `PUT /settings/system`, `GET /settings/system/options` | `PUT`: the whole `SystemSettings` object (times as 24-hour `HH:mm` on a 5-minute step, MPOS and close settled values as `{amount 0-31, unit hours                                      | days}`, `nightAuditRunTime`, folio details with `logo` as a data URL or null)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `SystemSettings`; options `{timeZones, cardReaders, items, areas, members}` each a list of `{id, label}`  | 422 `validation` when a rule fails (the UI checks the same rules, `src/app/systemSettings.ts`); 5xx |
| 16  | `GET /reports/custom` | none | `CustomReportSummary[] { id, name, creatorName, updatedAt }` (`updatedAt` an ISO 8601 instant). Unsorted: the UI sorts newest first and filters client-side (Reporting landing, Excia/Guestrooms-Demo#57; Q-58-1 covers the large-list question) | 5xx |
| 17  | `GET /settings/booking-rules`, `PUT /settings/booking-rules`, `GET /settings/booking-rules/options` | `PUT`: the whole `BookingRules` (`employee`, `member` or null, `nonMember` or null, `uniqueMemberTypeRules`, `memberTypeRules[]`; periods as `{amount, unit days\|weeks\|months}`, money in cents)                                                                                                                 | `BookingRules`; options `{roomTypes, memberTypes}` as `{id, label}` lists                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 422 `validation` when a rule fails (same rules as `src/app/bookingRules.ts`); 5xx                                                            |
| 18  | `GET /room-setup/options`; `GET/POST /room-types`, `PUT/DELETE /room-types/{id}`; `GET/POST /rooms`, `PUT/DELETE /rooms/{id}` (ticket 7.3) | `RoomTypeInput` / `RoomInput` (see `src/api/types.ts`; `id` absent on create) | `RoomSetupOptions {skus, features, addOns, bedSizes, members}`, `RoomTypeSetup`, `RoomSetup`. Errors: 422 `validation` (rules in `src/app/roomSetup.ts`: name 1 to 50, start before end, description 750, a room type needs a photo, a room needs a room type), 404 `not-found`, 409 `in-use` (deleting a room type that rooms use). Backend rules: a room that inherits details stores its room type's (and follows later edits); `linkedRoomIds` is two-way and deleting a room unlinks it; add-on associations on a room type or room must show on the add-on (7.4). |

- `ReservationDetail.version` is separate from schedule block versions. Early/late check order: validate,
  404, 409 `stale`, then 409 `not-editable`.
- A create retried after an unknown outcome (status 0, 408, 5xx) reuses its `requestId`; the backend must
  replay instead of duplicating. 409 `conflict` and other 4xx applied nothing.
- **Unassigned room:** `roomId` null or absent creates a reservation with no room. It has no lane on the
  schedule until a room is assigned (D-079), and no assign-room endpoint exists yet. A `guestName` of "TBD" and no `leadOccupant` are valid
  (D-080): the backend must accept "TBD" as a guest name.
- **Members** (`members.search`, `members.create`) are a placeholder directory (25 mock people,
  `MEM-0001` ...) until the Member Directory ticket (10.3); the Booking Guest and Lead Occupant pickers
  use them. Where real member data comes from is open (Q-51-1).
- **`ScheduleBlock` flags:** `earlyCheckIn?` and `lateCheckOut?` (optional booleans) tell the grid to
  draw the early check-in sliver and the late check-out marker (D-084). They are read-only on the
  block; they change through `POST /reservations/{id}/early-late`, so the backend should return the
  new flags on the next `GET /schedule`.
- **Permission:** `reservation.edit` ([permissions.md](permissions.md)) gates the panel's edits and
  create in the UI; the backend must enforce it (fail-closed).
- **Backend need:** nothing holds the room while the New Reservation timer runs. A real backend needs a
  hold/reserve call when the panel opens and a hold token sent with create (Q-19-3). What the timer's
  expiry means once a server hold exists is open (Q-19-10).

## Folio endpoints (ticket 4.1)

Added by the Folio view (Excia/Guestrooms-Demo#38). Both are in `createHttpClient` and the mock.

| #   | Method and path                      | Request                                                                     | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Errors                                                                       |
| --- | ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 13  | `GET /reservations/{id}/folio`       | none (must not change anything)                                             | `Folio` (reservationId, confirmationNumber, checkInStatus `not-checked-in\|checked-in\|checked-out`, open, mposVisible, nights, guests, rooms[] {id, number}, occupants[] {id, name, roomId}, charges[] {id, type `room-rate\|mpos\|manual\|add-on\|surcharge\|service-fee`, date, description, amountCents (total incl. taxes and service charges), status `posted\|unposted\|settled\|split`, references[], roomId, occupantId}, payments[] {id, typeLabel, date, reference, ticket, description, amountCents, status}) | 400, 404                                                                     |
| 14  | `POST /reservations/{id}/folio/post` | `PostChargeRequest {requestId, reservationId, chargeId}`; `Idempotency-Key` | the updated `Folio`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 400, 404, 409 `folio-closed`, 409 `not-unposted`, 409 `idempotency-conflict` |

- Balances are not sent: the client derives Posted Balance (posted lines) and Unposted Balance
  (unposted lines) from `charges` (D-077). A backend that wants to own the numbers should add them to
  `Folio` and the client will prefer them.
- Surcharge (MPOS card present) and service fee (card on file) arrive as `charges` of those types with
  the settle reference; `references` holds every payment reference of a split settlement.
- Posting is idempotent by `requestId`. Print and Email are not endpoints yet (D-003, Q-38-2).

## Reservation List endpoints (ticket 3.1, built on the mock)

Separate from `GET /reservations` so the details panel and dashboard shapes stay as they are. Client:
`api.reservationList.list(query)` and `getOptions()`; shapes in `src/api/reservationListTypes.ts`. The path is
the client's choice (Q-G-3).

| #   | Endpoint                        | Request                                                                                                                                                                                                                                                            | Answer                                                                                                                                                                                                                                                                                                      | Errors                   |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 12  | `GET /reservation-list`         | `checkInFrom`, `checkInTo` (inclusive, on arrival), `unassignedOnly=true`, `locationIds`, `roomTypeIds`, `statuses` (comma lists), text filters `guest`, `reserver`, `resNumber`, `block`, `room`, `search`, `sort=<field>:<asc\|desc>`, `page` (1-based), `limit` | `Page<ReservationListRow>`: `items`, `total` of all matches (`nextCursor` unused). Row: id, confirmationNumber, arrival, departure (exclusive), guestName (lead occupant), reserverName, blockName, locationId/Name and roomTypeId/Name of the first room, rooms[] {id, roomNumber or null, status}, status | 400 `invalid-query`, 5xx |
| 13  | `GET /reservation-list/options` | none                                                                                                                                                                                                                                                               | `{ locations[], roomTypes[] }` (id, name), never narrowed by a query                                                                                                                                                                                                                                        | 5xx                      |
| 14  | `POST /reservation-rooms/{id}/check-in` | none (idempotency key header) | `{ reservationRoomId, status: "checked-in" }` | 404, 409 `unassigned`, 409 `no-payment-method`, 409 `not-checkable` |

Rules the backend must apply: sort fields `arrival` (default, ascending), `departure`, `confirmationNumber`,
`guestName`, `reserverName`, `blockName`, `locationName`, `roomTypeName`, `roomNumber`, `status`; ties broken by
id so paging is stable; text filters are case-insensitive substrings; `search` matches guest, reserver, Res #
or block; `unassignedOnly` keeps reservations with at least one room without a number. Row `status` is one of
`not-checked-in`, `checked-in`, `checked-out`, `canceled`, the lowest common denominator of its rooms (see
3.1 in [features/03-reservations.md](features/03-reservations.md)).

## Change room during stay (ticket 2.3, branch `feat/20-change-room-during-stay`)

Per-night model (D-087 to D-096); see also [02-schedule.md](features/02-schedule.md#23-change-room-during-stay-menu-and-dialog).

| #   | Method and path                            | Request                                                                                                                                                 | Response                                                                                                                                                  | Errors                                                                                                                                                                                                                                          |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | `POST /reservation-rooms/{id}/change-room` | `ChangeRoomRequest {requestId, reservationRoomId, fromRoomId, version, nights: [{date, roomId}], rateChoice `retain\|update\|null`}`; `Idempotency-Key` | `{ blocks[], removedBlockIds[], folio {deltaCents, repricedNights, roomChargesCents}, vacatedRoom {roomId, housekeeping `clean\|dirty`, since} or null }` | 400 `invalid-id`/`invalid-query` (`details.nights`, `details.rateChoice`), 403, 404, 409 `stale` (also `details.reason` `effective-date` and `details.today`), 409 `not-movable`, 409 `conflict` (`details.roomId`), 409 `idempotency-conflict` |
| 19  | `GET /settings/room-change-rule`           | none                                                                                                                                                    | `RoomChangeRule { askRateOnRoomChange: boolean }` (PLACEHOLDER: name, default true and home are undecided, Q-20-2)                                        | 5xx                                                                                                                                                                                                                                             |

- **The plan:** `nights` is the **whole remaining stay**: one entry per night from the first night not yet
  stayed to the night before the departure, in date order, each with the room it should be spent in
  (unchanged nights repeat their current room). **The server owns the effective date** (the first night not
  yet stayed is the club's today, from the club's time zone, which comes from system settings; Q-G-5, Q-20-14);
  the client's first night is advisory. A plan whose first night differs from the server's is **409 `stale`
  with `details.reason` `["effective-date"]` and `details.today`** (the client reloads its dialog data, adopts
  that date and reopens on step 1). A plan that lists a night twice, misses a night or changes no night is 400
  `invalid-query` (`details.nights`). Nights before the effective date are stayed and cannot change. The
  reservation room is the one holding the first remaining night (the block whose id is the stay id; the
  server checks `fromRoomId` and `version` against that block, i.e. against the room of the first remaining
  night); the id of a `previous` or `next` part is 404.
- **Permission:** 403 (`forbidden`) without `reservation.edit`; nothing is applied. The mock enforces it from
  the grant it was created with.
- **Rooms per night (requirements 27.9.1.2.2):** a night may use any room that is free **that night**
  (half-open nights: a stay that ends on the night, or starts the day after, does not block). A changed night
  in a room booked or closed that night is 409 `conflict` (`details.roomId` lists the rooms); unchanged nights
  are not rechecked; the stay's own parts never block. Only a **checked-in** reservation room can change (409
  `not-movable` otherwise, and also for a locked room type with a night in another type). Check order: 404,
  409 `stale` (version or room), 409 `not-movable`, 409 `stale` (effective date), 400 nights, 409 `conflict`,
  400 missing rate choice.
- **Answer = the whole stay after the change:** `blocks` has one block per run of consecutive nights in one
  room, oldest first, with the stay's `reservationId` and confirmation number. **Consecutive runs in the same
  room are always one block, whatever their status:** a stayed night in the same room as the first remaining
  night belongs to the block that holds it (status `checked-in`), so `previous` blocks exist only where the
  room really differs. When the result is **one block, it carries no `roomChange`** (the stay is "unsplit"
  again, also after reverting every night to its room) and can be dragged like any stay. With several
  blocks each has `roomChange {part, index, count, stayId}` (`previous`: stayed nights in another room,
  `checked-out`, never movable; `current`: the block with the request's `reservationRoomId`, which may also
  hold earlier nights in its room; `next`: later runs, `checked-in`). `roomCount` counts rooms, not segments.
  `removedBlockIds` are blocks of the stay that no longer exist. Early Check In stays on the first block and
  Late Check Out on the last. **Ids of new blocks are opaque** (the mock's `<id>~n` carries no meaning; the
  client never parses ids, it links blocks by `stayId`). The client rejects (`invalid-response`) an answer whose
  blocks are not exactly the normalized plan (the first block may start earlier), whose numbering, stay link
  or part order is inconsistent, with a link on a single block, a stayed part in the room of the current one,
  a block of another reservation or duplicate ids, a vacated room or date that differs, or non-integer money.
- **Rates (D-015, D-090):** money is integer cents excluding taxes and service charges (Q-20-6). Nights before
  the effective date are never repriced; a night that keeps its room keeps its price; a changed night is
  repriced per its new room: `retain` keeps its current price, `update` or `null` uses its new room's rate.
  When the setting asks (`askRateOnRoomChange`) and a changed night's rate differs, `null` is refused (400,
  `details.rateChoice`); a setting or rate that changed between the dialog opening and the request is handled
  the same way (the client reopens on step 1). `folio.deltaCents` is the change of this reservation room's
  room charges (negative: cheaper); the weighted average rate is untouched.
- **Housekeeping (D-091):** when the room the guest sleeps in tonight changes, it becomes `dirty` from that
  night (`vacatedRoom`, `ScheduleRoom.housekeeping`; PLACEHOLDER until ticket 6.4); otherwise `vacatedRoom` is
  null (rooms of later nights were never occupied).
- **Concurrency and idempotency:** exactly like the schedule moves: `version` and `fromRoomId` guard against a
  stale view (409 `stale`, nothing applied; the mock bumps the version of every block it rewrites),
  `requestId` is also the `Idempotency-Key`; the same id with the same body **replays the original answer,
  including the original versions and `removedBlockIds`**; another body is 409 `idempotency-conflict`. The
  client treats status 0, 408, 5xx and an unusable 2xx as an unknown outcome (reload, neutral message, no
  revert).
- **Moves of a stay with several parts (D-093):** `POST /schedule/move-room` and `/move-dates` answer 409
  `not-movable` for any block of such a stay; the client refuses the drop first.
- **Reporting rule:** the blocks of one stay share the reservation id and confirmation number. Nights and
  revenue are summed **per night**, never per block, and the segments of a stay are **not** extra
  reservations, arrivals or departures in the dashboard, Quick Stats, the reservation list or reports (a stay
  that changed room is still one reservation with one arrival and one departure); the average rate stays
  weighted (revenue / nights).
- **Related fields:** `ReservationDetail.rooms[]` lists the current room only: `roomId` is the room of the
  first night not yet stayed, `arrival` where its block starts, `departure` the departure of the **whole**
  stay, with optional `previousStays[]` and `upcomingStays[] {roomId, roomNumber, arrival, departure}` (absent
  whenever the stay is a single block); the order of `rooms[]` does not change when a room is split.
  `stay.lines[]` has one line per night over all blocks with a **required** `reservationRoomId` (the stay id).
  The reservation `version` is **not** changed by a room change (the mock's choice; the client reloads the
  detail afterwards either way).
- The client loads the inventory for the remaining nights with `schedule.get`: only the remaining nights, in
  windows of at most 30 days, **13 windows at most** (a stay has at most 365 nights); the version that guards
  the request is the one from the window that starts at the effective date.

## Error codes

| Status | Code                   | Meaning                                                                                                                                                       | Client behavior                                                       |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 0      | `network`              | no response (connection failure)                                                                                                                              | Schedule move: unknown outcome, refetch, neutral message              |
| 0      | `timeout`              | no response within 15 s                                                                                                                                       | same                                                                  |
| 0      | `headers`              | `getHeaders` threw                                                                                                                                            | failure                                                               |
| 0      | `misconfigured`        | production build with no API URL and no mock flag                                                                                                             | every call rejects; "Site not configured"                             |
| any    | `invalid-response`     | non-JSON body, or a body that fails the shape guard or does not match the query                                                                               | treated as unusable; a 2xx unusable move answer is an unknown outcome |
| 400    | `invalid-id`           | empty id, `.` or `..` (also raised client-side)                                                                                                               |                                                                       |
| 400    | `invalid-query`        | malformed query or body (date, month, view, `days` not 7/14/30, request id not 8 to 128 URL-safe characters, version empty or over 128 characters, bad scope) |                                                                       |
| 401    | (any)                  | not signed in                                                                                                                                                 | `onUnauthorized` hook, then error                                     |
| 403    | `forbidden`            | (ticket 2.3) no `reservation.edit` for a room change                                                                                                          | revert; "You do not have permission to change this reservation."      |
| 404    | (none)                 | unknown reservation, reservation room or room                                                                                                                 | Schedule: revert and refetch                                          |
| 408    | (none)                 | request timeout                                                                                                                                               | unknown outcome                                                       |
| 409    | `conflict`             | target room booked or closed on those nights; `details.roomId` lists rooms                                                                                    | revert and refetch                                                    |
| 409    | `not-movable`          | checked out, locked room type, arrival in the past, dates of a checked-in room                                                                                | revert and refetch                                                    |
| 409    | `stale`                | `version` or `from*` no longer matches                                                                                                                        | revert and refetch                                                    |
| 409    | `idempotency-conflict` | `requestId` reused with a different request                                                                                                                   |                                                                       |
| 409    | `folio-closed`         | (ticket 4.1) posting to a closed folio                                                                                                                        |                                                                       |
| 409    | `not-unposted`         | (ticket 4.1) the charge is not waiting for Night Audit                                                                                                        |                                                                       |
| 409    | `not-editable`         | (PR 119) reservation checked out or cancelled                                                                                                                 | Early/Late save fails with the error and Retry                        |
| 5xx    | (any)                  | server error                                                                                                                                                  | Schedule move: unknown outcome (reload, no revert)                    |

## Concurrency and idempotency

- **Optimistic concurrency:** every `ScheduleBlock` has an opaque `version` that changes whenever its room
  or dates change, **also when a sibling's move changes it**. A move sends it back with `fromRoomId` (and
  `fromStartDate` for dates). If the reservation room changed since, answer 409 `stale` and apply nothing.
- **Idempotency:** each move carries a client-generated `requestId` (UUID via `crypto.randomUUID`, with a
  fallback), sent in the body **and** as the `Idempotency-Key` header. The same id with the same body
  replays the first result without applying again; the same id with another body is 409
  `idempotency-conflict`.
- **Backend requirements that follow:** idempotency records need a TTL long enough to cover client
  retries (e.g. 24 h); only a failure that applied nothing (a clear 4xx) may be retried with the same
  `requestId`, an unknown outcome is resolved by reloading, not by blind retry; the `Idempotency-Key`
  header is authoritative and a body `requestId` that differs from it is a 400; for `all-rooms` only the
  named block's `version` is checked (a reservation-level version would be safer and is the recommended
  follow-up); ids must be unique across blocks AND closures.
- **Unknown-outcome semantics:** the client treats status 0, 408, 5xx and an unusable 2xx answer as an
  unknown outcome: the move may have been applied, so it refetches instead of rolling back and shows a
  neutral message. Only a 4xx other than 408 means nothing applied (revert, refetch).
- Mutations elsewhere ("deferred to the tickets that need them") should follow the same pattern:
  `requestId` + `Idempotency-Key` + a version/expected-state guard.

## Shape guards and their limits

- Responses get **light shape guards** on the fields consumers rely on (ids, statuses, counts, list
  shapes), not full schema validation; a mismatch is an `invalid-response` error. A backend that adds
  fields is fine; one that changes or omits a guarded field breaks the UI.
- Extra checks that go beyond shape: Quick Stats view/period echo; schedule `startDate`/`days` echo, unique
  ids, blocks and closures inside listed rooms, `startDate < endDate`; move answer contains the moved block
  at the requested place and consistent `roomCount`; early/late echo; created reservation echoes the request.
- `permissionsFromGrant` keeps only permissions the app knows; unknown strings are dropped; anything that
  is not `'all'` or an array denies everything.

## Server-side enforcement

UI hiding is **not** authorization (Excia/Guestrooms-Demo#110). The backend must enforce, on every
request:

1. Page and action access from the user's grant (`admin`, `page.<id>`, `reservation.edit`, later action
   permissions): list and detail reads, schedule reads, every mutation.
2. All schedule-move rules above (past arrivals, locked room types, checked-in/out dates, conflicts with
   reservations and closures) because the client sees only the loaded window.
3. Concurrency (`stale`) and idempotency (`requestId`) on every mutation, plus the idempotency TTL.
4. Private notes visible and editable only to admins (3.3).
5. Permission checks for money actions: manual charges and credits, refunds, negative payments, rate
   adjustments (the permission names are **Unknown**, Q-91-2, Q-44-3, Q-31-1).
6. Booking Rules (hold length, cancellation period, booking opens/closes, excluded room types, max rooms)
   for employee, member and non-member audiences; online cancellation window (D-007).
7. Unique notification names, unique custom report names per owner, unique encoder keys, and similar
   uniqueness rules stated in tickets.
8. Revenue and rate rules (excluding taxes and service charges; weighted average) wherever aggregates are
   computed (D-004, D-005).
9. File uploads (type, size) and generated documents (PDFs) (D-003).

## Planned endpoints

Implied by the tickets that are not built. Method, path and shapes are **Unknown** unless stated; this
list records only what each ticket needs. Mutations should follow the concurrency/idempotency pattern.

| Area (ticket)                   | Backend need                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reservations list (3.1)         | Server-side sort, filter and pagination with filters for check-in range, unassigned only, location; default range today + 7 days, sort check-in ascending (D-013); status of a multi-room reservation is the lowest common denominator of its rooms. Existing `GET /reservations` needs more fields (reserver, block, location, room type, +N rooms)                                                                                                           |
| Check in / out (3.2, 3.5)       | Per-room check-in with reasons for failure (`unassigned`, no payment method, a reservation still checked in to the assigned room); check in after the arrival date (rules Unknown); undo check in (rejected after night audit)                                                                                                                                                                                                                                 |
| Reservation Hub (3.3, 3.4)      | Reservation read/update (guests, notes public/private, Lead Occupant/Reserver rules), assign room, cancel, add another room, print registration card (PDF)                                                                                                                                                                                                                                                                                                     |
| Keycards (3.6, 7.6)             | Encode, deactivate, list active keys behind an encoder interface; retrieve encoders from Visionline; save encoder keys                                                                                                                                                                                                                                                                                                                                         |
| Contact info (3.7)              | Update reservation-only email/phone (up to 3 emails per guest) and the non-member record name                                                                                                                                                                                                                                                                                                                                                                  |
| Rate adjust (3.8)               | Adjust a night or charge line ($ or %), result never below 0                                                                                                                                                                                                                                                                                                                                                                                                   |
| Payments (3.9, 4.11, 4.12, 5.6) | Payments interface (hosted-field placeholders): list methods per guest, add a credit card, penny auth ($0.01) with processing/declined results, charge, quick split settle; gateway **Unknown** (D-002)                                                                                                                                                                                                                                                        |
| Add-ons (3.10, 7.4)             | List add-ons with single price and remaining nightly quantity per night; add/edit/remove on a reservation until check out; folio fee posting                                                                                                                                                                                                                                                                                                                   |
| Owner/Member (3.11)             | Room owner per room; reserver-is-owner flag per reservation                                                                                                                                                                                                                                                                                                                                                                                                    |
| Early/Late (3.12)               | System setting (late checkout time), checkboxes saved per reservation (`POST /reservations/{id}/early-late`, PR 119), a job that auto-checks-out at the Late Checkout Time for flagged reservations and keeps flagged ones checked in at the system checkout time                                                                                                                                                                                              |
| Manual send (3.13, 8.x)         | Send a confirmation or guest-card notification for a reservation to a guest's emails; sending logged (Q-36-1)                                                                                                                                                                                                                                                                                                                                                  |
| Folios (4.1 to 4.13)            | Folio read (posted/unposted balances, charges, payments, status, closed flag), settle lines (reference numbers, surcharge for MPOS card present, service fee for card on file), split/undo split, transfer to a folio or Unassigned (with reasons per item), delete unassigned charge, remove member charge, refund (full/partial, remaining value), manual charge/credit (SKU lookup, Ask for Price), deposit/payment, print/email folio (PDF by the backend) |
| Unassigned charges (4.4)        | List/search/count (the dashboard badge reads the count)                                                                                                                                                                                                                                                                                                                                                                                                        |
| Night audit (4.8, 4.9)          | List pending room charges for a post date; post selected charges (with extra charges and payments) to CMA with per-row results; history by post date with batches; reverse selected items; business date state (Undo Check In disappears after a run)                                                                                                                                                                                                          |
| Online booking (5.x)            | Availability search by guests, nights, location and audience; pricing/stay summary; hold create/reset/release; tenant config (club name, favicon, URLs); sign-in with Core (non-member) and Axis (member), session handling; payment methods via Paycloud; create/edit/cancel reservation online; My Reservations upcoming/past; folio PDF                                                                                                                     |
| Reporting (6.x)                 | A report query endpoint per standard report with typed `ReportQuery` (date range, compare, filters, group by, columns, sort, totals) and CSV/PDF export by the backend; custom report CRUD with creator and updated time; unique names                                                                                                                                                                                                                         |
| System settings (7.1, 7.8, 7.9) | Read/write settings (time zone, times, mobile POS visibility hours, close settled folios, night audit mode, alternative base rates, card options, rate change handling, owner enable, labels, SKUs/lookups, folio details with logo, registration card items, online booking texts); a settings change log retained one year                                                                                                                                   |
| Rate categories (7.2)           | CRUD managed in Guest Rooms (not synced from CMA)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Room types and rooms (7.3)      | CRUD with associations (features, add-ons, linked rooms), photos upload, duplicate, delete rules (Unknown), owner member lookup                                                                                                                                                                                                                                                                                                                                |
| Booking rules (7.5)             | Read/write the rules matrix per audience and unique member-type rules; extends `GET /settings/booking-hold` (the employee value drives the New Reservation timer; the placeholder is 15 / 10 / 10 minutes)                                                                                                                                                                                                                                                     |
| Migration (7.7)                 | Template, upload and validate (.csv/.xlsx/.xls), column match, review, import (unassigned, future only, idempotent by reservation number), failed rows export                                                                                                                                                                                                                                                                                                  |
| Change log (7.10)               | List by admin page with sort/filter and the event type list                                                                                                                                                                                                                                                                                                                                                                                                    |
| Notifications (8.x)             | CRUD for triggered and scheduled notifications (unique names), recipients, attachments upload, content/snippets, a trigger engine and scheduler, a prompt-before-sending signal at trigger time                                                                                                                                                                                                                                                                |
| Members / locations / SKUs      | Lookups for members (`GET /members` and `POST /members` exist as placeholders from PR 119), locations (replaces the placeholder list), SKUs, employees by role                                                                                                                                                                                                                                                                                                 |
| Generic                         | `GET /locations` (the mock has no locations endpoint; the dashboard uses placeholders)                                                                                                                                                                                                                                                                                                                                                                         |

## Reservation menus (ticket 2.5, branch `feat/22-reservation-menus`)

Built on the mock behind `ReservationsApi`; both calls are idempotent on `requestId` (body and `Idempotency-Key` header) and
carry the `ReservationDetail.version` the user saw.

| #   | Method and path                                | Request                                                                                       | Response                                                                       | Errors                                                                                                                          |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /reservations/{id}/cancel`               | `CancelReservationRequest {requestId, reservationId, version}`                                | `ReservationDetail` with `status` `cancelled` and a new `version`              | 400 `invalid-id`/`invalid-query`, 403 `forbidden`, 404, 409 `stale`, 409 `not-cancellable`, 409 `idempotency-conflict`         |
| 2   | `POST /reservations/{id}/undo-check-in`        | `UndoCheckInRequest {requestId, reservationId, version, reservationRoomId?}` (no room: all)   | `ReservationDetail` as it is now                                               | 400, 403 `forbidden`, 404, 409 `stale`, 409 `not-checked-in`, 409 `audit-closed`, 409 `idempotency-conflict`                     |

- `ReservationDetail.lastAuditedDate?: IsoDate | null` is the latest business date a night audit has run for. The UI hides Undo
  Check In when a checked-in room's check-in business date (arrival, Q-22-5) is on or before it, and when the field is absent.
- Cancel is refused (`not-cancellable`) once any room is checked in or out, and for an already cancelled reservation. Fees are out of scope (D-007). A cancelled reservation leaves the schedule; its detail stays readable.
- New error codes: `not-cancellable`, `not-checked-in`, `audit-closed` (all 409).

## Online Booking settings (ticket 7.9, branch `feat/96-online-booking-settings`)

No new endpoint. `GET /settings/system` and `PUT /settings/system` (row 15 above) gain an `onlineBooking` object:
`{globalMessage (max 150), cancellationAgreement (max 300), includePolicyLink, policyUrl (absolute http or https, checked only
while includePolicyLink is true), chargeCancellationFee, showAddOnsPopup}`. The backend re-checks the limits and the URL and
answers 422 `validation`; the UI checks the same rules (`src/app/onlineBookingSettings.ts`).

## Add-on items (ticket 7.4, built on the mock)

| Method and path                  | Body / response                                                                                                | Errors                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET /add-ons/options`           | `AddOnOptions { skus, locations, roomTypes }`, each a list of `{ id, label }`                                 | 5xx                                      |
| `GET /add-ons`                   | `AddOnSetup[]`                                                                                                 | 5xx                                      |
| `POST /add-ons`                  | `AddOnInput` (no `id`) returns the stored `AddOnSetup`                                                         | 422 `validation`                         |
| `PUT /add-ons/{id}`              | `AddOnInput` returns the stored `AddOnSetup`                                                                   | 422 `validation`, 404 `not-found`        |
| `DELETE /add-ons/{id}`           | 204                                                                                                            | 404 `not-found`                          |

`AddOnSetup`: `id`, `name` (1 to 50), `startDate`, `endDate | null` (after the start), `kind` (`item` or `combo`),
`sku` (`{ id, label }`, required; the reservation shows its price), `onlineBooking`, `trackNightly`, `nightlyQty`
(1 to 99, meaningful only while `trackNightly`; the backend stores 1 otherwise), `description` (at most 400),
`photos` (at most 50, `{ id, name, url }`), `locationIds`, `roomTypeIds`. The rules are in `src/app/addOns.ts` and
must be enforced again by the backend, which also answers 422 `validation` when `sku`, a `locationIds` entry or a
`roomTypeIds` entry is not in the options (the mock does the same). The page drops ids that no longer exist before it
saves. Photo upload and storage are open (Q-72-1).
