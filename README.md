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
  localhost logs a warning). Set it and the app uses the fetch client in `src/api/http.ts`, with no
  code changes. Public configuration only, never secrets.
  - Unset or invalid in **dev**: the in-memory mock (`src/api/mock.ts`) is used (a warning is logged
    for an invalid value).
  - Unset or invalid in a **production build**: no mock data is served. `console.error` is logged and
    every API call rejects with `ApiError` code `misconfigured`.
- `VITE_MOCK_SCENARIO`: `normal` (default), `loading`, `empty` or `error`; what the mock returns.
  **Dev only**: production builds ignore it, `?mock=` and `localStorage`. In dev you can switch
  without restarting: add `?mock=empty` to the URL (kept across the `/` redirect), or run
  `localStorage.setItem('gr.mock', 'error')` in the console and reload. The query wins over
  storage, which wins over `VITE_MOCK_SCENARIO`.

## API conventions

- Every client method takes `options?: { signal }` last; aborting rejects with an `AbortError`
  (not an `ApiError`). The fetch client times out after 15 s (`ApiError` status 0, code `timeout`).
- Errors are `ApiError` with `status`, optional `code` and field `details`. Status 0 means no
  response (`network` or `timeout`). Non-JSON or malformed bodies become `invalid-response` errors.
- Lists return `{ items, total, nextCursor? }`; cursors are opaque. Reservations support
  `status`, `search`, arrival/departure date ranges, `sort` and `limit`.
- `credentials: 'include'` is a placeholder until auth is designed. `createHttpClient` accepts
  `getHeaders` and `onUnauthorized` (called on any 401) as hooks; nothing uses them yet.
- Mutations and idempotency keys are deferred to the tickets that need them.
- The permissions grant `permissions: 'all'` sentinel has to be agreed with the backend. Consumers
  go through `permissionsFromGrant`, which denies anything that is not `'all'` or an array.
- Money is integer cents and dates are ISO strings; branded types for them are a possible
  follow-up.
