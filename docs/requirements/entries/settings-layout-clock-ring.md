# 7.1 System Settings: layout and clock ring follow-up

Owner feedback 2026-10-26 (relayed by CEO, no ticket number). Branch `fix/settings-layout-clock-ring`.

## Decisions

| ID      | Date       | Decision                                                                                                                                                                                                                                                    | Why                                | Source         | Status      |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | ----------- |
| D-SSO-5 | 2026-10-26 | Supersedes D-SSO-4: Training Mode is back in the top right corner above the form (as before #215). SSO Admin is the first section of the left column and Night Audit the first of the right column, so they share a top line; below 1200px they stack       | Owner: Training Mode to its corner | owner feedback | provisional |
| D-SSO-6 | 2026-10-26 | One vertical spacing token between sections and columns of the Settings tab (`theme.spacing(3)`, 24px, was 32px); the Service Charge Label counter sits inside the field (end adornment) so it adds no extra gap before Transfer Item                       | Owner: even, tighter gaps          | owner feedback | provisional |
| D-CLK-3 | 2026-10-26 | The clock dial and popover Paper draw no browser-default focus outline in any state (`outline: none`, transparent tap highlight); only keyboard focus on the dial draws the 2px `primary.main` ring. A test scans the open picker for the default MUI blues | Owner: ring still blue while open  | owner feedback | provisional |

## Notes

- The blue was not reproducible in Chrome 147 (computed styles all green); the browser-default focus ring (blue in Safari and some Chrome modes) is the likely source, and is now suppressed.
