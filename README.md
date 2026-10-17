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
