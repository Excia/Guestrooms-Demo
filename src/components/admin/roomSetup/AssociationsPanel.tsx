import { useReadOnly } from '../../../app/readOnlyContext';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import type { LookupRef } from '../../../api/types';
import { selectAllIds, toggleId } from '../../../app/roomSetup';
import { Hint } from '../systemSettings/fieldParts';

export interface AssociationTab {
  id: string;
  label: string;
  /** Heading above the list, e.g. "Features". */
  heading: string;
  items: readonly LookupRef[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** An inherited list is shown but cannot be changed. */
  disabled?: boolean;
  /** Short explanation under the heading. */
  note?: string;
  /** Two columns, for long lists (Linked Rooms). */
  columns?: 1 | 2;
}

export interface AssociationsPanelProps {
  tabs: readonly AssociationTab[];
}

// "Associations" tabs (Figma 11964:23814): a checkbox list per tab with Select All | Select None.
// The tab label carries the count of selected items (PDF 9.4.11.3).
export default function AssociationsPanel({ tabs }: AssociationsPanelProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const base = useId();
  const readOnly = useReadOnly();
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!tab) return null;
  const ids = (id: string) => `${base}-${id}`;
  const frozen = tab.disabled || readOnly;
  return (
    <Box>
      <Tabs
        value={tab.id}
        onChange={(_, next: string) => setActive(next)}
        aria-label="Associations"
        variant="fullWidth"
      >
        {tabs.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={`${t.label} (${t.selected.length})`}
            id={ids(`tab-${t.id}`)}
            aria-controls={ids(`panel-${t.id}`)}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={ids(`panel-${tab.id}`)}
        aria-labelledby={ids(`tab-${tab.id}`)}
        sx={{ pt: 2 }}
      >
        <Typography
          variant="body2"
          component="h3"
          sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {tab.heading}
        </Typography>
        {tab.note ? <Hint>{tab.note}</Hint> : null}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, my: 1 }}>
          {readOnly ? null : (
            <>
              <Button
                size="small"
                disabled={tab.disabled}
                onClick={() => tab.onChange(selectAllIds(tab.items))}
              >
                Select all
              </Button>
              <Typography aria-hidden color="text.secondary">
                |
              </Typography>
              <Button size="small" disabled={tab.disabled} onClick={() => tab.onChange([])}>
                Select none
              </Button>
            </>
          )}
        </Box>
        {tab.items.length === 0 ? (
          <Hint>Nothing to select yet.</Hint>
        ) : (
          <Box
            role="group"
            aria-label={tab.heading}
            sx={{
              display: 'grid',
              gridTemplateColumns: tab.columns === 2 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
              columnGap: 2,
            }}
          >
            {tab.items.map((item) => (
              <FormControlLabel
                key={item.id}
                label={item.label}
                control={
                  <Checkbox
                    checked={tab.selected.includes(item.id)}
                    disabled={frozen}
                    onChange={(e) =>
                      tab.onChange(toggleId(tab.selected, item.id, e.target.checked))
                    }
                  />
                }
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
