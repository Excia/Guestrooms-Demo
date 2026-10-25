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

| #   | Method and path                  | Query / body                                                                                                                  | Response                                                                                                                                                                           | Errors                                                                                                       |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `GET /permissions/me`            | none                                                                                                                          | `PermissionGrant { role: string, permissions: string[] \| 'all' }`                                                                                                                 | 401, 5xx                                                                                                     |
| 2   | `GET /dashboard/stats`           | none                                                                                                                          | `DashboardStats` (date, arrivalsToday, departuresToday, inHouse, occupancyPercent, rateCategories[], roomBlocks[], unassignedChargesCount, totalRevenue, totalNights, averageRate) | 5xx                                                                                                          |
| 3   | `GET /dashboard/quick-stats`     | `view=day\|week\|month` plus `date` (day), `startDate` (week) or `month` (`YYYY-MM`)                                          | `QuickStats` (see below)                                                                                                                                                           | 400 `invalid-query`, 5xx                                                                                     |
| 4   | `GET /reservations`              | `status`, `search`, `arrivalFrom`, `arrivalTo`, `departureFrom`, `departureTo`, `sort=<field>:<asc\|desc>`, `cursor`, `limit` | `Page<Reservation>`                                                                                                                                                                | 5xx                                                                                                          |
| 5   | `GET /reservations/{id}`         | none                                                                                                                          | `Reservation`                                                                                                                                                                      | 400 `invalid-id`, 404                                                                                        |
| 6   | `GET /schedule`                  | `startDate`, `days` (7, 14 or 30)                                                                                             | `ScheduleData`                                                                                                                                                                     | 400 `invalid-query`                                                                                          |
| 7   | `POST /schedule/move-room`       | `MoveRoomRequest`; header `Idempotency-Key`                                                                                   | `{ blocks: ScheduleBlock[] }`                                                                                                                                                      | 400, 404, 409 (`conflict`, `not-movable`, `stale`, `idempotency-conflict`)                                   |
| 8   | `POST /schedule/move-dates`      | `MoveDatesRequest`; header `Idempotency-Key`                                                                                  | `{ blocks: ScheduleBlock[] }`                                                                                                                                                      | same as 7                                                                                                    |
| 8a  | `POST /schedule/closures`        | `SaveClosureRequest`; header `Idempotency-Key`                                                                                | `ScheduleClosure` (201)                                                                                                                                                            | 400, 404 (room), 403 `forbidden` (no `reservation.edit`), 422 `closure-conflict`, 409 `idempotency-conflict` |
| 8b  | `PUT /schedule/closures/{id}`    | `UpdateClosureRequest`; header `Idempotency-Key`                                                                              | `ScheduleClosure`                                                                                                                                                                  | as 8a, and 404 (closure)                                                                                     |
| 8c  | `DELETE /schedule/closures/{id}` | header `Idempotency-Key`                                                                                                      | 204                                                                                                                                                                                | 400, 404                                                                                                     |

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
- `ScheduleClosure`: `kind: 'closure'`, `id`, `roomId`, `startDate`, `endDate`, `reason`, `endMarker` (unused by the UI since D-EM-2; closures draw no end markers).
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

| #   | Method and path                                                                                                                            | Request                                                                                                                                                                                                                                                                                                            | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Errors                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `GET /reservations/{id}/detail`                                                                                                            | none (must not change anything)                                                                                                                                                                                                                                                                                    | `ReservationDetail` (id, confirmationNumber, status, arrival, departure, nights, adults, children, leadOccupant {name, memberNumber, guestType}, rooms[] {id, roomId, roomNumber, locationName, roomTypeName, status `nyci\|checked-in\|checked-out`, arrival, departure}, earlyCheckIn, lateCheckOut, addOns[] {id, name, quantity, priceCents per unit excluding taxes and service charges}, publicNotes, privateNotes, stay {lines[] {roomType, date, amountCents}, folioTotalCents excluding taxes and service charges}, version)                                   | 400, 404                                                                                                                                                                                                             |
| 10  | `POST /reservations/{id}/early-late`                                                                                                       | `EarlyLateRequest {requestId, reservationId, version, earlyCheckIn?, lateCheckOut?}` (send only the changed flags); `Idempotency-Key`                                                                                                                                                                              | `{ earlyCheckIn, lateCheckOut, version }` (the flags must match what was asked, else the client treats it as a failed save)                                                                                                                                                                                                                                                                                                                                                                                                                                             | 400, 404, 409 `stale`, 409 `not-editable` (checked out or cancelled), 409 `idempotency-conflict`                                                                                                                     |
| 11  | `POST /reservations`                                                                                                                       | `CreateReservationRequest {requestId, roomId? (null or absent = Unassigned), arrival, departure, adults, children, guestName (the booking guest, "TBD" when not chosen), bookingGuestId?, bookingGuestRole `occupant\|reserver`, leadOccupant? {name, memberId?}, publicNotes?, privateNotes?}`; `Idempotency-Key` | `ReservationDetail` of the new one-room reservation (must echo adults, children, one room, `roomId` (null when Unassigned), arrival, departure and the lead occupant: for `occupant` the booking guest, for `reserver` the `leadOccupant` name or "TBD")                                                                                                                                                                                                                                                                                                                | 400 `invalid-query`, 404 unknown room, 409 `conflict` (room booked or closed; only checked when a room is given), 409 `idempotency-conflict`                                                                         |
| 12  | `GET /settings/booking-hold`                                                                                                               | none                                                                                                                                                                                                                                                                                                               | `BookingHold { employee, member, nonMember }`, each an integer 1 to 99 (minutes; "Reservation Hold" of Booking Rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 5xx                                                                                                                                                                                                                  |
| 13  | `GET /members`                                                                                                                             | `q` (matches name, member number or email, case-insensitive; at most 200 characters), `limit`                                                                                                                                                                                                                      | `Page<Member>` (`Member {id, memberNumber, name, email, phone}`); the mock answers 8 by default, at most 50                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 400 `invalid-query`, 5xx                                                                                                                                                                                             |
| 14  | `POST /members`                                                                                                                            | `CreateMemberRequest {requestId, name, email?, phone?}`; `Idempotency-Key`                                                                                                                                                                                                                                         | the new `Member` (idempotent on `requestId`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 400 `invalid-query`, 409 `idempotency-conflict`                                                                                                                                                                      |
| 15  | `GET /settings/system`, `PUT /settings/system`, `GET /settings/system/options`                                                             | `PUT`: the whole `SystemSettings` object, including the `onlineBooking` object (see Online Booking settings below) (times as 24-hour `HH:mm` on a 5-minute step, MPOS and close settled values as `{amount 0-31, unit hours                                                                                        | days}`, `nightAuditRunTime`, folio details with `logo` as a data URL or null)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `SystemSettings` (breaking contract change: `GET` now fails with a validation error on a backend that omits `onlineBooking`); options `{timeZones, cardReaders, items, areas, members}` each a list of `{id, label}` | 422 `validation` when a rule fails (the UI checks the same rules, `src/app/systemSettings.ts`); 5xx |
| 16  | `GET /reports/custom`                                                                                                                      | none                                                                                                                                                                                                                                                                                                               | `CustomReportSummary[] { id, name, creatorName, updatedAt }` (`updatedAt` an ISO 8601 instant). Unsorted: the UI sorts newest first and filters client-side (Reporting landing, Excia/Guestrooms-Demo#57; Q-58-1 covers the large-list question)                                                                                                                                                                                                                                                                                                                        | 5xx                                                                                                                                                                                                                  |
| 17  | `GET /settings/booking-rules`, `PUT /settings/booking-rules`, `GET /settings/booking-rules/options`                                        | `PUT`: the whole `BookingRules` (`employee`, `member` or null, `nonMember` or null, `uniqueMemberTypeRules`, `memberTypeRules[]`; periods as `{amount, unit days\|weeks\|months}`, money in cents)                                                                                                                 | `BookingRules`; options `{roomTypes, memberTypes}` as `{id, label}` lists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 422 `validation` when a rule fails (same rules as `src/app/bookingRules.ts`); 5xx                                                                                                                                    |
| 18  | `GET /room-setup/options`; `GET/POST /room-types`, `PUT/DELETE /room-types/{id}`; `GET/POST /rooms`, `PUT/DELETE /rooms/{id}` (ticket 7.3) | `RoomTypeInput` / `RoomInput` (see `src/api/types.ts`; `id` absent on create)                                                                                                                                                                                                                                      | `RoomSetupOptions {skus, features, addOns, bedSizes, members}`, `RoomTypeSetup`, `RoomSetup`. Errors: 422 `validation` (rules in `src/app/roomSetup.ts`: name 1 to 50, start before end, description 750, a room type needs a photo, a room needs a room type), 404 `not-found`, 409 `in-use` (deleting a room type that rooms use). Backend rules: a room that inherits details stores its room type's (and follows later edits); `linkedRoomIds` is two-way and deleting a room unlinks it; add-on associations on a room type or room must show on the add-on (7.4). |

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

| #   | Endpoint                                | Request                                                                                                                                                                                                                                                            | Answer                                                                                                                                                                                                                                                                                                      | Errors                                                              |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 12  | `GET /reservation-list`                 | `checkInFrom`, `checkInTo` (inclusive, on arrival), `unassignedOnly=true`, `locationIds`, `roomTypeIds`, `statuses` (comma lists), text filters `guest`, `reserver`, `resNumber`, `block`, `room`, `search`, `sort=<field>:<asc\|desc>`, `page` (1-based), `limit` | `Page<ReservationListRow>`: `items`, `total` of all matches (`nextCursor` unused). Row: id, confirmationNumber, arrival, departure (exclusive), guestName (lead occupant), reserverName, blockName, locationId/Name and roomTypeId/Name of the first room, rooms[] {id, roomNumber or null, status}, status | 400 `invalid-query`, 5xx                                            |
| 13  | `GET /reservation-list/options`         | none                                                                                                                                                                                                                                                               | `{ locations[], roomTypes[] }` (id, name), never narrowed by a query                                                                                                                                                                                                                                        | 5xx                                                                 |
| 14  | `POST /reservation-rooms/{id}/check-in` | none (idempotency key header)                                                                                                                                                                                                                                      | `{ reservationRoomId, status: "checked-in" }`                                                                                                                                                                                                                                                               | 404, 409 `unassigned`, 409 `no-payment-method`, 409 `not-checkable` |

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

| #   | Method and path                         | Request                                                                                     | Response                                                          | Errors                                                                                                                 |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /reservations/{id}/cancel`        | `CancelReservationRequest {requestId, reservationId, version}`                              | `ReservationDetail` with `status` `cancelled` and a new `version` | 400 `invalid-id`/`invalid-query`, 403 `forbidden`, 404, 409 `stale`, 409 `not-cancellable`, 409 `idempotency-conflict` |
| 2   | `POST /reservations/{id}/undo-check-in` | `UndoCheckInRequest {requestId, reservationId, version, reservationRoomId?}` (no room: all) | `ReservationDetail` as it is now                                  | 400, 403 `forbidden`, 404, 409 `stale`, 409 `not-checked-in`, 409 `audit-closed`, 409 `idempotency-conflict`           |

- `ReservationDetail.lastAuditedDate?: IsoDate | null` is the latest business date a night audit has run for. The UI hides Undo
  Check In when a checked-in room's check-in business date (arrival, Q-22-5) is on or before it, and when the field is absent.
- `ReservationDetail.folioCharges?: {type, status}[]` lists the folio's lines (type and status only). The UI hides Add Another
  Room when any line is `posted` or `settled` and not of type `mpos` (the legacy inference that the night audit has run; D-LM-5).
  Absent means the menu keeps offering it. The backend may instead send the same fact from its own audit log.
- `ScheduleBlock.linkedTo.multilinkageCount?: number` (integer, 0 or more) is set when several rooms are linked: the number shown
  as " +N" after the linked room and in the tooltip (D-LM-1).
- Cancel is refused (`not-cancellable`) once any room is checked in or out, and for an already cancelled reservation. Fees are out of scope (D-007). A cancelled reservation leaves the schedule; its detail stays readable.
- New error codes: `not-cancellable`, `not-checked-in`, `audit-closed` (all 409).

## Edit panel: add another room, guests, notes (ticket 151, built on the mock)

All three are idempotent on `requestId` (body and `Idempotency-Key` header) and carry the `ReservationDetail.version` the user saw;
each answers the `ReservationDetail` as it is now, with a new `version`. Add room needs **no permission** (owner decision,
D-LM-5 / Q-LM-2: legacy has none), so it has no 403 row; guests and notes need `reservation.edit` (403 `forbidden`).

| #   | Method and path                      | Request                                                                                                  | Errors                                                                                               |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `POST /reservations/{id}/rooms`      | `AddRoomRequest {requestId, reservationId, version, roomId?, adults, children, leadOccupant?}`           | 400; 404 (reservation or room); 409 `stale`, `conflict`, `held`, `not-editable`, `idempotency-conflict` |
| 2   | `PUT /reservation-rooms/{id}/guests` | `UpdateGuestsRequest {requestId, reservationId, reservationRoomId, version, adults, children, guests[]}` | 400; 403; 404; 409 `stale`, `not-editable`, `idempotency-conflict`                                   |
| 3   | `PUT /reservations/{id}/notes`       | `UpdateNotesRequest {requestId, reservationId, version, publicNotes, privateNotes}`                      | 400; 403; 404; 409 `stale`, `not-editable`, `idempotency-conflict`                                   |

- Add room: the new room takes the arrival and departure of the whole stay (dates are never sent). `roomId` null or absent adds an
  UNASSIGNED room. 409 `conflict` when the room is booked or closed on any night of the stay. 409 `not-editable` in the cases that
  hide the menu item (cancelled, every room checked out, the night audit has run: a posted or settled non-POS folio line). There is
  **no permission check** (owner decision, D-LM-5; no 403). Existing rooms keep their party; `ReservationDetail.adults` and
  `children` are the totals of the rooms. The answer has one more room, and the requested `roomId` among them.
- Guests: `guests` replaces the room's named guests (`{kind: 'adult' | 'child', slot, name, memberId?, email?, sendConfirmation?}`); the
  lead occupant is the first adult, so at most `adults - 1` adults and `children` children may be named (400 otherwise). `slot` is the
  guest's position among the room's adults (0 to `adults - 2`) or children (0 to `children - 1`); a slot may not be used twice per kind
  (400). Slots left out stay TBD, so naming Guest 3 and leaving Guest 2 TBD (adult slot 1) survives a save and a reload. The rest of the
  party is TBD. Requires `reservation.edit`. 409 `not-editable` once the room is checked in or out. `sendConfirmation` is ignored without an email address; the
  guest then comes back with `confirmationSent: true`. A guest that stays (same kind, name and `memberId`) keeps its `id`.
- Notes: both texts are sent whole, at most 2000 characters each. 409 `not-editable` once checked out. Requires `reservation.edit`.
  The answer is the reservation; the UI shows the note texts it returns (the backend may trim or normalize them, so they are not compared with the request).
- `ReservationRoomDetail` gains optional `adults`, `children`, `guests[]` (`ReservationGuest {id, kind, slot, name, memberId?, memberNumber,
email?, confirmationSent?}`) and `leadOccupant`. Absent means the backend does not say: the UI then shows the reservation's totals for a
  one-room reservation and one adult per other room.
- The HTTP client checks that the answers show what was asked: the added room and the room's counts and guest count (not the note texts).
- Retry after an unknown outcome (no answer, 408, 5xx): the UI sends the same body with the same `Idempotency-Key` and does not refresh the
  version first, so the backend must replay the first answer instead of adding a second room.
- Slot holds (ticket 152, D-152-4): another user's live hold on the room on any night of the stay refuses the add with 409 `held`
  (`details.roomId`), as for a new booking; the caller's own hold and an expired one never block. The UI hides such rooms using `ScheduleData.holds`.

## Registration Card (ticket 7.8, branch `feat/95-registration-card`)

| #   | Method and path                   | Request                                                                                                                    | Response                                                        | Errors        |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| 1   | `POST /registration-card/preview` | `{settings: RegistrationCardSettings, folio: FolioDetails}` (the unsaved draft; the folio header for Include Folio Header) | `{url}` of a PDF of a sample card; the UI opens it in a new tab | 400, 422, 5xx |

- `GET` and `PUT /settings/system` (row 15 above) gain `registrationCard: {enabled, items: {<id>: boolean}, customText (max 500)}`. Item ids: `folioHeader`, `confirmationNumber`, `checkInDate`, `checkOutDate`, `earlyCheckInFlag`, `lateCheckOutFlag`, `roomNumber`, `roomType`, `guestCount`, `averageRoomRate`, `leadOccupantName`, `leadOccupantAddress`, `leadOccupantPhone`, `reserverName`, `reserverPhone`, `publicNotes`, `customText`, `guestSignature`, `staffSignature`. The backend re-checks the 500-character limit (422 `validation`). The client rejects a System Settings response that omits `registrationCard`, so loading System Settings (and everything that reads them) fails against a backend that does not send it yet.
- The backend's PDF generator follows `buildRegistrationCard` (`src/app/registrationCard.ts`): only checked items print; a phone or address needs its name; Reserved By prints only for a reserver who is not the lead occupant; Average Room Rate is revenue over nights without taxes or service charges; custom text prints above the signatures.
- `POST /registration-card/preview` also takes an optional `reservation` (the `RegistrationCardReservation` shape in `src/api/registrationCardTypes.ts`); Print Registration Card(s) sends it with the saved settings. The backend may instead render the card from its own copy of the reservation. The URL in the answer must be http(s) or a same-origin path; the UI refuses anything else.

## Change Log (ticket 7.10, branch `feat/97-change-log-overlay`)

| #   | Method and path               | Request (query parameters)                                                                                                                                                                                                                                                                                                                                                 | Response                                                                                                                                 | Errors                   |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `GET /change-log`             | `page` (an admin page id, required), `sort` (`date`, `time`, `changeType` or `actionBy`, then `:asc` or `:desc`; default `date:desc`), `dateFrom`, `dateTo` (`YYYY-MM-DD`), `timeFrom`, `timeTo` (`HH:mm`, time of day), `changeTypes` (comma-separated event type ids), `actionBy`, `search` (parts of a name or description), `pageNumber` (1-based), `limit` (1 to 200) | `Page<ChangeLogEntry>`: `{items: [{id, date, time, changeType, description, actionBy}], total}`; date and time are the club's local time | 400 `invalid-query`, 5xx |
| 2   | `GET /change-log/event-types` | none                                                                                                                                                                                                                                                                                                                                                                       | `[{id, label}]`; the Change Type filter offers exactly these                                                                             | 5xx                      |

- Retention: one year. The backend never returns an entry older than one year before today (the mock does the same).
- The backend writes the entries when an admin page saves or deletes something (Q-97-3 in `entries/97-change-log.md`).

## Online Booking settings (ticket 7.9, branch `feat/96-online-booking-settings`)

No new endpoint. `GET /settings/system` and `PUT /settings/system` (row 15 above) gain an `onlineBooking` object:
`{globalMessage (max 150), cancellationAgreement (max 300), includePolicyLink, policyUrl (absolute http or https, checked only
while includePolicyLink is true), chargeCancellationFee, showAddOnsPopup}`. The backend re-checks the limits and the URL and
answers 422 `validation`; the UI checks the same rules (`src/app/onlineBookingSettings.ts`). The URL is checked and stored
trimmed, and must not carry a username or password. This is a breaking contract change: the client rejects a
`GET /settings/system` response without `onlineBooking`, so the backend must send it before this ships.

## Add-on items (ticket 7.4, built on the mock)

| Method and path        | Body / response                                                               | Errors                            |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| `GET /add-ons/options` | `AddOnOptions { skus, locations, roomTypes }`, each a list of `{ id, label }` | 5xx                               |
| `GET /add-ons`         | `AddOnSetup[]`                                                                | 5xx                               |
| `POST /add-ons`        | `AddOnInput` (no `id`) returns the stored `AddOnSetup`                        | 422 `validation`                  |
| `PUT /add-ons/{id}`    | `AddOnInput` returns the stored `AddOnSetup`                                  | 422 `validation`, 404 `not-found` |
| `DELETE /add-ons/{id}` | 204                                                                           | 404 `not-found`                   |

`AddOnSetup`: `id`, `name` (1 to 50), `startDate`, `endDate | null` (after the start), `kind` (`item` or `combo`),
`sku` (`{ id, label }`, required; the reservation shows its price), `onlineBooking`, `trackNightly`, `nightlyQty`
(a whole number, 0 or more, no maximum, as in the legacy system; meaningful only while `trackNightly`; the backend stores 1 otherwise), `description` (at most 400),
`photos` (at most 50, `{ id, name, url }`), `locationIds`, `roomTypeIds`. The rules are in `src/app/addOns.ts` and
must be enforced again by the backend, which also answers 422 `validation` when `sku`, a `locationIds` entry or a
`roomTypeIds` entry is not in the options (the mock does the same). The page drops ids that no longer exist before it
saves. Photo upload and storage are open (Q-72-1).

## Keycard integration (ticket 7.6, built on the mock)

| Method and path                    | Body / response                                                                       | Errors           |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| `GET /keycards/encoders`           | `string[]`: the saved Encoder Keys, in list order                                     | 5xx              |
| `PUT /keycards/encoders`           | `string[]` replaces the list; returns what was stored                                 | 422 `validation` |
| `POST /keycards/encoders/retrieve` | no body; `string[]` of the encoders Visionline knows (empty when none); does not save | 5xx              |

An Encoder Key is digits only, `ENCODER_KEY_LENGTH` (14, **provisional**, Q-75-1) long, without separators; the API
rejects anything else with 422 (a hyphenated key is refused; the UI normalizes before sending). The list has no blanks
and no duplicates (`src/app/keycards.ts`; the backend enforces the same). The UI treats an empty answer and any
error from retrieve the same way (the "No encoders retrieved" dialog). Authentication with Visionline is the
backend's concern (Q-75-3).

## Room closures (ticket 149)

- `SaveClosureRequest {roomId, startDate, endDate, description, requestId}`; dates are half-open like
  reservations (`endDate` is the day the room is free again, so `startDate < endDate`); `description` is empty
  or at most 50 characters. `UpdateClosureRequest` adds `closureId` (the path carries it too).
- **Conflict:** a reservation or another closure in the room on any of those nights answers **422**
  `closure-conflict` with `details.roomId: [<id>]`; the UI shows it on the Room field. The client also
  checks the loaded window first; the server stays authoritative (a stay outside the window).
- **403 `forbidden`** without the `reservation.edit` permission (as for cancel and undo check-in). **429** is retryable with the same `requestId`.
- `requestId` is the `Idempotency-Key` (same rules as moves). Delete answers 204. The grid reloads the
  schedule after every save or removal (the endpoint has no list of changed blocks).
- A new closure has `endMarker: false` (`endMarker` is seed data only and the UI does not draw it, D-EM-2).

## Check in on past dates (ticket 163, built on the mock)

| Method and path                           | Body / response                                                                                                                                    | Errors                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /reservations/{id}/check-in`        | `CheckInReservationRequest { requestId, reservationId, version, reservationRoomIds[], pastDateConfirmed, overrideCode?, checkOutAfter }` returns `CheckInReservationResult { reservation, rooms[], autoCheckedOut, nightsPosted, integrationErrors[] }` | 400 `invalid-id`/`invalid-query`; 403 `forbidden`, `override-required`, `override-invalid`; 404; 409 `stale`, `future-arrival`, `past-date-unconfirmed`, `idempotency-conflict` |
| `POST /override-codes/verify`             | `{ permission: 'reservation.check-in.any-time', code }` returns `{ valid }` (a wrong code is a normal answer)                                       | 400                                                                                                                                              |
| `POST /reservation-rooms/{id}/split`      | `SplitRoomRequest { requestId, reservationId, reservationRoomId, version }` returns the **new** `ReservationDetail`                                 | 400; 403 `forbidden`; 404; 409 `stale`, `not-splittable` (one room), `idempotency-conflict`                                                      |
| `POST /reservations/{id}/payment-methods` | PLACEHOLDER (ticket 3.9): puts a mock card on file; returns the `ReservationDetail`                                                                | 400; 404                                                                                                                                         |

Rules the backend must enforce (the mock does, `src/api/checkInData.ts`; the UI decides the same in `src/app/checkInDecision.ts`):

- "Past" means the club's today (its time zone) is after the room's arrival date; the business date and the last night audit are not used.
  A past arrival needs `pastDateConfirmed: true` (409 `past-date-unconfirmed`). A future arrival is 409 `future-arrival` at every level.
- The caller's check-in level is `any-time`, `arrival-date-only` or `never` (permissions below). `never` is 403 `forbidden`.
  `arrival-date-only` plus a past arrival needs a valid `overrideCode` (403 `override-required` / `override-invalid`).
  Ticket 127 builds the real PIN prompt and validation; the mock accepts one fixed placeholder code.
- A room that cannot be checked in does not fail the request. It comes back in `rooms[]` with `checkedIn: false` and a `failure`:
  `unassigned`, `room-not-ready` (dirty), `occupied` (another reservation is still checked in to the assigned room),
  `no-payment-method` (required also for a past date, D-008), `not-checkable` (not waiting for check in). The other rooms are still checked in.
- Check-in and check-out date and time are recorded per room (`ReservationRoomDetail.checkedInAt` / `checkedOutAt`, ISO-8601 instants).
- A past-date check in charges the nights before today to the folio (`nightsPosted`).
- `checkOutAfter: true` asks for an automatic check out of each room just checked in whose departure date and the club's
  check-out time have passed (owner decision). The server decides again and ignores the flag for a room whose departure has not passed.
  It posts the remaining nights, leaves the room needing cleaning and sets `autoCheckedOut`.
- `ReservationDetail` gains optional `paymentOnFile`, and each room optional `housekeeping` (`clean` | `dirty`), `checkedInAt`, `checkedOutAt`.
  Absent means the backend does not say; the UI then lets the attempt run and the backend answers.
- The Reservation List's bulk check in only selects reservations arriving **today** (the club's date): past-dated and future ones are never bulk checked in.

**Override codes: what the real backend must do (ticket 163; ticket 127 builds the prompt):**

- `POST /override-codes/verify` and the `overrideCode` of `POST /reservations/{id}/check-in` are the only places a code is
  tested, so both need **rate limiting and lockout** (per user and per club, e.g. a short lock after a few wrong codes) and must answer
  the same way for "wrong" and "unknown" so codes cannot be probed. Only a signed-in user who holds a check-in grant may call verify
  (the mock answers 403 `forbidden` otherwise).
- **Verify is advisory.** It only lets the UI move on or show an error early; the check in **re-validates** the code every time and
  is the only authority. A code verified earlier must not be trusted.
- The request's `permission: 'reservation.check-in.any-time'` names the permission whose holder's PIN is accepted: a code is valid when it
  belongs to a user who holds that permission (a manager), not to the caller. It is the only value today; it is a field so other
  override-able permissions can use the same endpoint.
- **Audit record** for every override: who entered the code, whose code it was, which reservation and rooms, the permission and the time, also for refused attempts.
- **Never log the code** (request bodies of these two endpoints must be excluded from access logs and traces) and never store it in
  the idempotency record: store a hash of it. The mock does this: its replay fingerprint holds a hash, not the code.
- The mock does not enforce the "another room is already checked in or out" precondition of the split in the partial case; the UI
  offers it only for one chosen room and the backend should refuse a split that leaves a room with nothing to split from (`not-splittable`).
- A request that names a room arriving after today fails the whole request (409 `future-arrival`); the UI never sends such a room
  (it lists it as "not yet"). The automatic check out is decided per room.


## Slot holds (ticket 152, built on the mock)

A New Reservation in progress holds its room and nights so the grid can shade them and nobody else books them
(functional doc 15.10; Q-19-3, Q-19-10). **A real backend must own holds and their expiry**: the client only asks, shows and
hides; it never decides a conflict. The mock (`src/api/holdData.ts`) behaves like such a server.

- `ScheduleData.holds?: ScheduleHold[]` on `GET /schedule`: the live holds (anyone's) that touch the window. Each hold has
  `id`, `roomId`, `startDate`, `endDate` (exclusive, like a block), `expiresAt` (ISO 8601 instant, the server's clock) and
  `mine` (the signed-in user placed it). Absent: none. The server drops a hold at expiry; the client also stops drawing one
  whose `expiresAt` has passed. The http guard rejects a malformed hold, a duplicate id and a hold in an unlisted room.
- `PUT /schedule/holds/{holdId}` with `{ roomId, startDate, endDate }` (`schedule.holdSlot`): places or moves the hold. The id
  is chosen by the client (a UUID), so a repeat is idempotent: the same slot answers the existing hold without extending it, a
  new slot moves it and **keeps its expiry**, and after expiry the same id starts a new hold. The length comes from Booking Rules
  "Reservation Hold" minutes for the caller's audience (the mock uses employee). Needs `reservation.edit` (403 otherwise).
  Answers the hold (the client checks the id and slot match). Errors: 400 `invalid-id` / `invalid-query` (no night, bad dates);
  404 (unknown room); 409 `conflict` (the slot is booked or closed; `details.roomId`); 409 `held` (another user holds an
  overlapping slot; `details.roomId`). Nothing changes on an error. The older hold of the id stays where it was.
- `DELETE /schedule/holds/{holdId}` (`schedule.releaseHold`): releases a hold of the caller; 204. Idempotent: an unknown, expired
  or someone else's id changes nothing and still answers 204. The UI calls it when the panel closes, the time expires or the
  room is cleared, and treats a failure as harmless (the hold expires by itself).
- `POST /reservations` (`create`) takes an optional `holdId`. The server refuses a booking on a slot another user holds (409
  `held`), ends the named hold when the reservation is created, and ignores an unknown or expired id.
- **Hold ids are not tokens for other users.** `holdId` on `create` only exempts a hold owned by the caller. The ids of other
  users' holds appear in `ScheduleData.holds`, so the backend must either omit them or ignore them as tokens (the mock refuses
  with 409 `held`). A hold of the caller under another id (a refresh, a second tab, an orphan) never blocks the caller: the
  server replaces it when the caller holds an overlapping slot, and the client ignores holds marked `mine` when checking for a clash.
- One client sends its hold requests in order, one at a time (it waits for the answer before the next, and releases only after a
  PUT in flight settles), so the server needs no sequence number. A server that cannot rely on that should add one.
- `expiresAt` is shown as "Held until HH:mm" on the club's clock (System Settings time zone).
- **Concurrency rules the backend must enforce:** a booking, a move or a room change onto held nights is refused (409 `held`)
  unless it is the holder's own; hold requests and bookings are serialised per room so two users cannot both win; a hold does
  not extend itself; expiry is the server's clock only. Other users' holds reach a client only when it loads the schedule (no
  push yet, Q-152-4).
