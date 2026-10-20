import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import {
  createValue,
  setCompare,
  dateSelectionState,
  type DateSelectionValue,
  type PeriodKind,
} from '../app/dateSelection';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import DateSelection from '../components/shared/DateSelection';
import LocationFilter from '../components/shared/LocationFilter';
import NonActionableDialog from '../components/shared/NonActionableDialog';
import Pagination from '../components/shared/Pagination';
import SaveToast from '../components/shared/SaveToast';
import Select from '../components/shared/Select';

// A fixed "today" keeps the states identical to the Figma examples (February 2025).
const DEMO_TODAY = '2025-02-12';

const LOCATIONS = [
  { id: 'a', name: 'Location A' },
  { id: 'b', name: 'Location B' },
  { id: 'c', name: 'Location C' },
];

const OPTIONS = [
  { value: 'one', label: 'Option one' },
  { value: 'two', label: 'Option two' },
  { value: 'three', label: 'Option three', disabled: true },
];

// The first eight are the Figma states; the last two are Compare on kinds Figma does not draw.
const STATES: ReadonlyArray<{ state: string; kind: PeriodKind; compare: boolean }> = [
  { state: 'Custom', kind: 'custom', compare: false },
  { state: 'This Week', kind: 'thisWeek', compare: false },
  { state: 'Compare', kind: 'thisWeek', compare: true },
  { state: 'Month', kind: 'month', compare: false },
  { state: 'As Of', kind: 'asOf', compare: false },
  { state: 'Single Day', kind: 'singleDay', compare: false },
  { state: 'Compare-Month', kind: 'month', compare: true },
  { state: 'Compare-AsOf', kind: 'asOf', compare: true },
  { state: 'Compare (Custom, not in Figma)', kind: 'custom', compare: true },
  { state: 'Compare (Single Day, not in Figma)', kind: 'singleDay', compare: true },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 5 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Labeled({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" component="p" sx={{ mb: 1, color: 'text.secondary' }}>
        {caption}
      </Typography>
      {children}
    </Box>
  );
}

function DateStateDemo({ state, kind, compare }: (typeof STATES)[number]) {
  const [value, setValue] = useState<DateSelectionValue>(() => {
    const v = createValue(kind, DEMO_TODAY);
    return compare ? setCompare(v, true) : v;
  });
  return (
    <Labeled caption={`${state} (renders as ${dateSelectionState(value)})`}>
      <DateSelection value={value} onChange={setValue} today={DEMO_TODAY} />
      <Typography
        variant="caption"
        component="pre"
        sx={{ mt: 1, whiteSpace: 'pre-wrap', maxWidth: (t) => t.spacing(27.5) }}
      >
        {JSON.stringify(value)}
      </Typography>
    </Labeled>
  );
}

// Dev-only gallery of the shared components (not in the menu): compare each state against Figma.
export default function ComponentsDemo() {
  const [selectValue, setSelectValue] = useState('');
  const [paging, setPaging] = useState({ page: 1, rowsPerPage: 25 });
  const [fieldLocations, setFieldLocations] = useState<string[]>(['a', 'b']);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [saveId, setSaveId] = useState(0);

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Shared components
      </Typography>
      <Typography sx={{ mb: 4, color: 'text.secondary' }}>
        Every shared component and state, for visual comparison with the Reporting page in Figma.
      </Typography>

      <Section title="Select">
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}
        >
          <Box sx={{ width: (t) => t.spacing(27.5) }}>
            <Labeled caption="Outlined, placeholder">
              <Select
                fullWidth
                label="Additional Input"
                placeholder="[Input Selection]"
                value={selectValue}
                options={OPTIONS}
                onChange={setSelectValue}
              />
            </Labeled>
          </Box>
          <Box sx={{ width: (t) => t.spacing(27.5) }}>
            <Labeled caption="With value and helper text">
              <Select
                fullWidth
                label="Room type"
                value="two"
                options={OPTIONS}
                onChange={() => undefined}
                helperText="Helper text"
              />
            </Labeled>
          </Box>
          <Box sx={{ width: (t) => t.spacing(27.5) }}>
            <Labeled caption="Error">
              <Select
                fullWidth
                label="Room type"
                value=""
                options={OPTIONS}
                onChange={() => undefined}
                error
                required
                helperText="Choose a room type."
              />
            </Labeled>
          </Box>
          <Box sx={{ width: (t) => t.spacing(27.5) }}>
            <Labeled caption="Disabled">
              <Select
                fullWidth
                label="Room type"
                value="one"
                options={OPTIONS}
                onChange={() => undefined}
                disabled
              />
            </Labeled>
          </Box>
          <Box sx={{ width: (t) => t.spacing(27.5) }}>
            <Labeled caption="Filled">
              <Select
                fullWidth
                variant="filled"
                label="Room 1"
                value="one"
                options={OPTIONS}
                onChange={() => undefined}
              />
            </Labeled>
          </Box>
        </Stack>
      </Section>

      <Section title="Pagination">
        <Stack sx={{ gap: 3 }}>
          <Labeled caption="120 results">
            <Pagination {...paging} total={120} onChange={setPaging} />
          </Labeled>
          <Labeled caption="0 results">
            <Pagination page={1} rowsPerPage={25} total={0} onChange={() => undefined} />
          </Labeled>
        </Stack>
      </Section>

      <Section title="Date Selection (eight states)">
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}
        >
          {STATES.map((s) => (
            <DateStateDemo key={s.state} {...s} />
          ))}
        </Stack>
      </Section>

      <Section title="Location Filter">
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}
        >
          <Labeled caption="CTA">
            <LocationFilter variant="cta" onOpen={() => setCtaOpen((o) => !o)} />
            {ctaOpen ? (
              <Typography variant="caption" role="status">
                CTA clicked: the page swaps in the field.
              </Typography>
            ) : null}
          </Labeled>
          <Labeled caption="Field, two selected (Figma)">
            <LocationFilter
              variant="field"
              locations={LOCATIONS}
              value={fieldLocations}
              onChange={setFieldLocations}
              onRemove={() => setFieldLocations([])}
            />
          </Labeled>
          <Labeled caption="Field, default (All Locations)">
            <LocationFilter
              variant="field"
              locations={LOCATIONS}
              value={allLocations}
              onChange={setAllLocations}
            />
          </Labeled>
        </Stack>
      </Section>

      <Section title="Dialogs and toast">
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(true)}>
            Open Confirm Leaving
          </Button>
          <Button variant="outlined" onClick={() => setInfoOpen(true)}>
            Open Non-Actionable Dialog
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setSaveId((n) => n + 1);
              setToastOpen(true);
            }}
          >
            Show Save Toast
          </Button>
        </Stack>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        onDiscard={() => setConfirmOpen(false)}
      />
      <NonActionableDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Here’s some non-actionable information."
      >
        Lorem ipsum dolor sit amet.
      </NonActionableDialog>
      <SaveToast
        saveId={saveId}
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        onUndo={() => undefined}
      />
    </Container>
  );
}
