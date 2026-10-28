# 188 API Integrations (Legacy Port LP-A.7)

Ticket Excia/Guestrooms-Demo#188 (epic #181). Figma: no frame (the ticket is labeled `needs-design`; the Admin Setup frames show the
"API Integrations" item in the left navigation only).
**Status:** in review (branch `feat/188-api-integrations`), 2026-10-28.

Source of behavior: the legacy screens `APIIntegrations.vue` (tabs), `PayCloudAPITokensEdit.vue`, `APIAuthentications.vue` and
`ApiKeys.vue`. The layout is this build's Admin Setup shell. One page, `/admin/api-integrations`, with three tabs: PayCloud API Tokens
(opens first, as in legacy), Authentications and API Keys.

## Figma deviations

| ID      | Area       | Figma                                                                                  | Built                                                                                                                                               | Why                                                                                | Choice (owner, ticket, agent, forced) |
| ------- | ---------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| F-188-1 | Whole page | No API Integrations frame                                                              | Tabs PayCloud API Tokens, Authentications, API Keys in the Admin Setup shell; one Save in the header for the first two                              | Port the legacy behavior in the shell of the other setup pages; owner rule         | owner                                 |
| F-188-2 | API Keys   | Legacy is a separate page with no navigation entry                                     | A third tab on the same page                                                                                                                        | The shell navigation has one "API Integrations" item and no room for a second page | agent                                 |
| F-188-3 | Secrets    | Legacy shows every key and token in clear text, with a show/hide eye and a copy button | A saved secret is masked (bullets and the last four characters) and never shown again; a new or rotated API key is shown once in a dialog with Copy | Ticket: secrets are shown masked, write-once and shown once on creation            | ticket                                |

## Open questions

| ID      | Question                                                                                                                                                  | Blocks      | Default used                                                                                                                                                               | Who answers     | Status |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Q-188-1 | The ticket marks API Keys "owner: needed". What does the owner want from API Keys beyond legacy (scopes, expiry, last used, who created it)?              | API Keys    | Legacy plus the ticket: name, masked key, created date, Create New Key, Rotate and Revoke. No scopes, expiry or last-used column                                           | Owner           | open   |
| Q-188-2 | Who may change API integrations? Legacy requires a root administrator (and Admin Setup not View) for PayCloud and Authentications; API Keys has no check. | Edit access | Administrators only (`admin`); anyone else opens the page View-only, even with `api-integrations.edit`. The mock refuses writes without `admin` or `api-integrations.edit` | Owner           | open   |
| Q-188-3 | Does Revoke only stop a key, or delete it? Legacy deletes it.                                                                                             | Revoke      | Deleted: it leaves the list. No "revoked" history                                                                                                                          | Owner           | open   |
| Q-188-4 | Should creating, rotating or revoking a key and changing a token or authentication appear in the Change Log?                                              | Change Log  | No: the page has no Change Log button, because a log entry must not carry a secret and the Change Log pages list is fixed. The backend should audit these actions          | Owner           | open   |
| Q-188-5 | What are the real limits of an API key name, a PayCloud key and the Tiger TMS and Assa Abloy fields?                                                      | Validation  | Name 50 characters, unique ignoring case; PayCloud key 36 characters without spaces and Username, Password, Access ID and UUID 36 (legacy `maxlength`); URL 500            | Owner / backend | open   |
| Q-188-6 | May an Authentication URL be plain `http`?                                                                                                                | Validation  | Yes, absolute `http` or `https` only (legacy accepted any URL the browser could parse, such as `ftp:`)                                                                     | Owner           | open   |
| Q-188-7 | Is saving with no tested connection allowed when an integration is disabled? Legacy tests only the enabled ones.                                          | Save        | Yes: only enabled integrations must be complete and are tested after saving                                                                                                | Owner           | open   |

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                              | Why                                                                                         | Source | Status |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ | ------ |
| D-188-1 | 2026-10-28 | Secrets are write-once. The API accepts one when created or replaced and returns it again only in the response that issues a new API key. Lists carry `maskedKey` (`maskSecret`) or `hasPassword`                                     | Ticket: masked display, shown once, never logged                                            | ticket | open   |
| D-188-2 | 2026-10-28 | The saved Authentication password is never loaded. Its field starts empty; an empty field keeps the saved password, a typed one replaces it                                                                                           | Same rule; legacy loaded and edited the password in clear text                              | ticket | open   |
| D-188-3 | 2026-10-28 | A saved PayCloud key shows masked and read-only; Replace Key opens an empty password field. Add API Token starts a new row. Save sends the whole set (`PUT`): a token left out is removed, one without `apiKey` keeps its key         | Idempotent save like Locations; no secret round trip                                        | agent  | open   |
| D-188-4 | 2026-10-28 | The header Save saves the PayCloud and Authentications tabs together (each only when it has changes); all three tabs stay mounted so edits survive a tab switch; leaving the page with edits asks first                               | One Save and one unsaved-changes prompt, as on the other setup pages (legacy saved per tab) | agent  | open   |
| D-188-5 | 2026-10-28 | API Keys act at once (no Save): Create asks for a name, Rotate and Revoke ask first. A new or rotated key opens a dialog with the key, Show/Hide and Copy Key; the key is dropped from the page when Done is chosen                   | A secret is never kept after the one time it is shown                                       | ticket | open   |
| D-188-6 | 2026-10-28 | Create and Rotate carry a `requestId` (idempotency key), so a repeated request returns the same key instead of a second one                                                                                                           | Network retries must not create duplicate keys                                              | agent  | open   |
| D-188-7 | 2026-10-28 | Save tests every enabled integration and the toast uses the legacy wording ("Connection has been made successfully.", "Credentials saved, but connection test failed for Tiger TMS." and so on); Test Connection tests without saving | Legacy behavior (`APIAuthentications.vue`)                                                  | legacy | open   |
| D-188-8 | 2026-10-28 | The Assa Abloy UUID is created in the browser the first time the integration is saved or tested while it is empty (legacy), and kept afterwards                                                                                       | Legacy behavior                                                                             | legacy | open   |

## Placeholders and invented values

- **P-188-1:** two API keys ("Website booking widget", "Accounting export"), two PayCloud tokens (production and test) and two
  authentications, both disabled and without a password (`src/api/integrationsData.ts`). The secrets are invented and live only inside the mock.
- **P-188-2:** the mock's connection test (`mockConnectionWorks`): it succeeds when the URL is valid, a password is saved or typed, and the host
  does not start with "offline" or "fail" (for example `https://offline.example.com` fails). No real system is called.
- **P-188-3:** a generated API key is `grk_` and 40 lowercase letters and digits (`generateApiKeySecret`). The real format is the backend's.

## API, permissions, notes

- **API:** `integrations.listApiKeys`, `createApiKey`, `rotateApiKey`, `revokeApiKey`, `listPayCloudTokens`, `savePayCloudTokens`,
  `listAuthentications`, `saveAuthentications`, `testConnection`; section "API integrations" in `api-contract.md`, including the security notes
  (never log a request or response body of these endpoints, never put a secret in a URL or an error message).
- **Permissions:** new route `api-integrations` (`page.api-integrations`, an Admin Setup page, not in the menu) and, from the route table,
  `api-integrations.edit`. The page edits only for `admin` (Q-188-2). The mock guards the five writes (`createApiKey`, `rotateApiKey`,
  `revokeApiKey`, `savePayCloudTokens`, `saveAuthentications`) with `admin` or `api-integrations.edit` (403 `forbidden`).
- **Notes:** one-line change in `adminNav.ts` (the API Integrations item gets its path and id). View-only checks are in `viewOnly.test.tsx`.
  Keyboard and focus: Create, Rotate and Revoke dialogs focus Cancel (Revoke and Rotate) or the name field (Create); after a key is revoked or
  a new key dialog closes, focus returns to Create New Key; a refused save focuses the first field with an error; Add API Token focuses the new field.
  The Escape key closes the one-time key dialog like any dialog, so a key not copied then is lost and can be rotated.
