import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { RateSeason } from '../../../api/types';
import { blankAmounts, visibleRateColumns } from '../../../app/rateCategories';
import { theme } from '../../../theme';
import { focusField } from '../roomSetup/useSetupEditor';
import RateTable, { seasonDomId, type RateTableProps } from './RateTable';

const rates = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, blankAmounts()]));
const ROOMS = [
  { id: 'a', label: 'King Room' },
  { id: 'b', label: 'Cottage' },
];
const seasons: RateSeason[] = [
  { id: 'd', name: '', isDefault: true, startDate: '', endDate: '', rates: rates(['a', 'b']) },
  {
    id: 's1',
    name: 'Summer',
    isDefault: false,
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    sku: null,
    skuKind: 'item',
    rates: rates(['a', 'b']),
  },
  {
    id: 's2',
    name: 'Winter',
    isDefault: false,
    startDate: '2026-12-01',
    endDate: '2027-01-02',
    sku: null,
    skuKind: 'item',
    rates: rates(['a', 'b']),
  },
];

function setup(over: Partial<RateTableProps> = {}) {
  const props: RateTableProps = {
    seasons,
    roomTypes: ROOMS,
    skus: [{ id: 'k1', label: 'Room night', kind: 'item' }],
    columns: visibleRateColumns(null),
    errors: {},
    onSeasonChange: vi.fn(),
    onAmountChange: vi.fn(),
    onAmountInvalid: vi.fn(),
    onDuplicateSeason: vi.fn(),
    onRemoveSeason: vi.fn(),
    ...over,
  };
  render(
    <ThemeProvider theme={theme}>
      <RateTable {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('RateTable', () => {
  it('spans each season cell over its room type rows, one rowgroup per season', () => {
    setup();
    const groups = screen
      .getAllByRole('rowheader')
      .filter((h) => h.getAttribute('scope') === 'rowgroup');
    expect(groups).toHaveLength(3);
    groups.forEach((g) => expect(g).toHaveAttribute('rowspan', String(ROOMS.length)));
    expect(document.querySelectorAll('tbody[data-season]')).toHaveLength(3);
  });

  it('spans one row when there are no room types', () => {
    setup({ roomTypes: [] });
    expect(screen.getAllByText('No room types selected')).toHaveLength(3);
    screen.getAllByRole('rowheader').forEach((g) => expect(g).toHaveAttribute('rowspan', '1'));
  });

  it('shows the group headers and their notes as separate texts, with no tooltip-only help', () => {
    setup();
    const weekday = screen.getByText('Weekday add-on');
    expect(weekday).toBeVisible();
    expect(weekday.closest('th')).not.toHaveAttribute('title');
    expect(screen.getByText('added to the base rate; 0 = no extra charge')).toBeVisible();
    expect(screen.getByText('added per night; 0 = no extra charge')).toBeVisible();
    expect(screen.getByText('Base rate')).toBeVisible();
  });

  it('does not repeat a heading per season', () => {
    setup();
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('duplicates and removes the season whose buttons were used', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Duplicate season Winter' }));
    expect(props.onDuplicateSeason).toHaveBeenCalledWith('s2');
    await user.click(screen.getByRole('button', { name: 'Remove season Summer' }));
    expect(props.onRemoveSeason).toHaveBeenCalledWith('s1');
  });

  it('changes the SKU kind and clears a SKU of the other kind', async () => {
    const user = userEvent.setup();
    const props = setup();
    const group = screen.getByRole('radiogroup', { name: 'SKU type (Summer)' });
    await user.click(within(group).getByRole('radio', { name: 'Combo' }));
    expect(props.onSeasonChange).toHaveBeenCalledWith('s1', { skuKind: 'combo', sku: null });
    expect(screen.getByRole('combobox', { name: 'SKU (Summer)' })).toBeInTheDocument();
  });

  it('shows an amount error in an alert chip inside the season cell', () => {
    setup({ errors: { s1: { amount: 'Enter a rate between 0 and 9,999,999.99 (Mon).' } } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a rate between 0');
    expect(alert.closest('th')).toHaveAttribute('scope', 'rowgroup');
  });

  it.each(['name', 'startDate', 'endDate', 'sku'] as const)(
    'the %s id used to focus a field lands on a focusable control',
    (field) => {
      setup();
      focusField(seasonDomId('s1', field));
      const active = document.activeElement as HTMLElement;
      expect(active).not.toBe(document.body);
      expect(active.matches('input,button,textarea,select')).toBe(true);
      expect(active.closest('[data-season="s1"]')).not.toBeNull();
    },
  );
});
