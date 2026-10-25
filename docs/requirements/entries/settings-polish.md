# System Settings polish (owner feedback 2026-10-25)

PR: branch `fix/settings-polish-registration-preview-modal`. Figma: Registration Card mockup image from the owner (a white card
page on grey; a newer mockup is promised); Folio Details 11964:11725, Registration Card tab 13319:41951.
**Status:** in review, 2026-10-25.

## Figma deviations

| ID                  | Area                      | Figma                                                         | Built                                                                                                                 | Why                                                                        | Choice |
| ------------------- | ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| F-settings-polish-1 | Registration Card preview | Owner's mockup image of the card page (not a Figma frame yet) | The card in `RegistrationCardSheet` follows the image; proportions are approximate (a letter-like page, 800px dialog) | The owner will send an updated mockup; the sheet is one isolated component | owner  |

## Open questions

| ID                  | Question                                                                                                                                                                                                         | Blocks                  | Default used                                                            | Who answers | Status |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- | ----------- | ------ |
| Q-settings-polish-1 | What else does Training Mode change (legacy has it on the System Settings record; the files read for this ticket only show the Night Audit lock)? Does it mark folios, charges, payments or reports as practice? | Training Mode consumers | Only the setting, its toggle and the Night Audit lock are built         | Owner       | open   |
| Q-settings-polish-2 | Should the type scale also shrink on the other admin pages for consistency, or stay System Settings only?                                                                                                        | Admin pages             | System Settings only (`settings_*` theme variants, applied by the page) | Owner       | open   |
| Q-settings-polish-3 | Is a 12px hint and a 16px input value acceptable next to the smaller labels (readability), or should inputs follow legacy exactly?                                                                               | Typography              | Inputs 16px, hints 12px, floating labels 16px/12px unchanged            | Owner       | open   |
| Q-settings-polish-4 | Should the reservation's Print Registration Card(s) menu open the same dialog before printing?                                                                                                                   | Reservation menus       | No: it still opens the generated document in a new tab, as before       | Owner       | open   |

## Decisions

| ID                  | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Why                                                                         | Source | Status      |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ | ----------- |
| D-settings-polish-1 | 2026-10-25 | The Remove logo badge is a red X: `error.main` fill, `error.contrastText` icon, `error.dark` on hover, at least 24px, with the theme's focus ring and the names "Remove logo" / "Remove photo <name>". The room photo badge (`PhotosField`) is the only other photo remove control; it is a separate component and gets the same `error.main` icon                                                                                                                                                                | Owner                                                                       | owner  | provisional |
| D-settings-polish-2 | 2026-10-25 | `SystemSettings.trainingMode` (boolean, default off) is a Settings tab switch at the top right, labelled "Training Mode Enabled" / "Training Mode Disabled" like legacy, with a description. Turning it on sets Night Audit to Run Manually (`withTrainingMode`) and disables Run Automatically with the legacy sentence shown as text; validation refuses the combination. It is saved by the page's Save button, counts for Confirm Leaving, and a Change Log line "Training Mode turned on" exists in the mock | Legacy behavior                                                             | owner  | provisional |
| D-settings-polish-3 | 2026-10-25 | System Settings text uses the theme variants `settings_title`, `settings_heading`, `settings_body`, `settings_tab` (see the table below), applied by `settingsTextSx` on the page and by `AdminShell`'s `titleVariant`. Other pages are unchanged                                                                                                                                                                                                                                                                 | Owner: "a bit thick/large", match legacy, about 1pt smaller, "not too much" | owner  | provisional |
| D-settings-polish-4 | 2026-10-25 | Generate Preview opens a MUI Dialog (scroll paper, 800px max, 90vh max, title bar with X, Escape and backdrop close, focus trapped and returned to the button) that draws the card from `buildRegistrationCard` output with sample data. The only thing that opens a tab is its Print button, which asks the backend for the document (D-003). Supersedes F-95-1 and the Generate Preview part of D-95-6                                                                                                          | Owner                                                                       | owner  | provisional |
| D-settings-polish-5 | 2026-10-25 | The card page is a document: white paper and black text (`palette.common`), grey placeholders and rules from `palette.grey`, on a `grey.100` backdrop; it does not follow any future dark mode. Spacing and type use theme tokens. The sheet is `src/components/registrationCard/RegistrationCardSheet.tsx`, separate from the dialog, so the next mockup is a one-file change                                                                                                                                    | A printed card is paper                                                     | agent  | provisional |

## Legacy facts (read-only reference, own words)

- **Training Mode** lives on the system settings record (`trainingMode`, boolean, sent on save). Its switch sits in the header row of the
  System Settings page, to the right of the tab strip (the strip takes 80% of the row, the switch the rest), with the visible label
  "Training Mode Enabled" when on and "Training Mode Disabled" when off. Changing it marks the page as changed. It is disabled for a user
  with view-only access. Turning it on also sets Night Audit to Run Manually. While it is on, the Run Automatically radio is disabled and
  an info icon explains, in a tooltip, "Running Night Audit automatically is not available in Training Mode". Four night-audit and
  folio-settle screens also read the flag (not examined further: Q-settings-polish-1). Here the switch sits at the top right of the
  Settings tab itself, as the owner asked.
- **Text:** font Roboto (then system fonts); the page body is 16px regular; the page title is 20px bold; section headings are bold at body
  size; explanatory paragraphs are "smaller" (about 13px); tabs are bold.

## Typography values (px, before and after)

| Role                                                    | Before (first build)   | After                            | Legacy         |
| ------------------------------------------------------- | ---------------------- | -------------------------------- | -------------- |
| Page title ("System Settings")                          | 18 / 700 (`subtitle1`) | 16.67 / 700 (`settings_title`)   | 20 / 700       |
| Section headings (and Night Audit, Rate Change legends) | 14 / 700 (`body2`)     | 13.33 / 700 (`settings_heading`) | 16 / 700       |
| Radio, checkbox, switch labels, paragraphs              | 16 / 400               | 14.67 / 400 (`settings_body`)    | 16 / 400       |
| Tab labels                                              | 14 / 500               | 12.67 / 500 (`settings_tab`)     | about 16 / 700 |
| Input and select text (values)                          | 16 / 400               | 16 / 400 (unchanged)             | 16 / 400       |
| Floating field labels                                   | 16 (12 when shrunk)    | unchanged                        | 16             |
| Hints and helper text (`caption`)                       | 12 / 400               | 12 / 400 (unchanged)             | about 13 / 400 |

Exceptions: input text stays 16px (readability, and it is the legacy value); hints and the shrunk field label stay at 12px, the smallest
size the app uses, so they are not shrunk further; headings drop only 0.67px so they stay distinct from the labels. Weights and family
follow legacy (Roboto, bold headings, regular labels). Colors are unchanged (text.primary / text.secondary, both AA on white).

## Placeholders and invented values

- **P-settings-polish-1:** the sample reservation and "Pine Ridge Club" for the in-app preview now live in `src/app/registrationCardSample.ts` (moved from `src/api/registrationCardData.ts`, which re-exports them). Its Training Mode explanation text ("Practice mode for training staff. While on, Night Audit can only be run manually.") is written for this build.
- **P-settings-polish-2:** the card's proportions (minimum page height of 800px, logo box 45% wide, 76 to 96px high) are estimates from the mockup image.

## API, permissions, notes

- **API:** `trainingMode` on `GET`/`PUT /settings/system` (see "System Settings polish" in `api-contract.md`); the preview request is now sent only when Print is pressed.
- **Permissions:** none new.
- **Notes:** the room-setup photo badge is the only other remove-photo control. The reservation menu's Print Registration Card(s) still opens the generated document in a new tab (Q-settings-polish-4). `window.print` is not used: the backend document is the printable file (D-003). Not verified in a real browser.
