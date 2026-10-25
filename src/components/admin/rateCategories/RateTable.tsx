import ContentCopy from '@mui/icons-material/ContentCopyOutlined';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import type { AddOnKind, LookupRef, RateColumnKey, RateSeason, RateSku } from '../../../api/types';
import {
  amountsFor,
  rateColumnGroups,
  SEASON_NAME_MAX,
  seasonSkuKind,
  seasonToneIndex,
  skusOfKind,
  type RateColumn,
  type SeasonChange,
  type SeasonErrors,
} from '../../../app/rateCategories';
import DateField from '../../shared/DateField';
import RemoveIconButton from '../../shared/RemoveIconButton';
import LookupField from '../systemSettings/LookupField';
import AmountField from './AmountField';
import { RATE_TABLE, tablePx } from './rateTableSizes';

export interface RateTableProps {
  seasons: readonly RateSeason[];
  /** The associated room types, one row each per season. */
  roomTypes: readonly LookupRef[];
  /** Every SKU the lookups can offer (a season's lookup lists the kind chosen for it). */
  skus: readonly RateSku[];
  columns: readonly RateColumn[];
  errors: Record<string, SeasonErrors>;
  onSeasonChange: (seasonId: string, change: SeasonChange) => void;
  onAmountChange: (
    seasonId: string,
    roomTypeId: string,
    column: RateColumnKey,
    cents: number,
  ) => void;
  /** A cell holds (or no longer holds) text that is not money. */
  onAmountInvalid: (cellKey: string, invalid: boolean) => void;
  onDuplicateSeason: (seasonId: string) => void;
  onRemoveSeason: (seasonId: string) => void;
}

export type SeasonField = 'name' | 'startDate' | 'endDate' | 'sku';

export const seasonDomId = (seasonId: string, field: SeasonField) =>
  `rate-season-${seasonId}-${field}`;

const seasonLabel = (season: RateSeason) =>
  season.isDefault ? 'Default' : season.name.trim() || 'New season';

const toneOf = (t: Theme, seasons: readonly RateSeason[], season: RateSeason) => {
  const index = seasonToneIndex(seasons, season.id);
  return index === null ? t.palette.season.neutral : t.palette.season.tones[index];
};

const stickyFirst = (t: Theme, left: number | string = 0) => ({
  position: 'sticky' as const,
  left,
  // A hairline on the right shows the column is pinned while the rest scrolls under it.
  borderRight: `1px solid ${t.palette.divider}`,
});

// The rate table (legacy RateCategoryTable): the default season first, then each season or special
// rate. Every season is its own colour-coded card: a title row (name, dates, SKU, duplicate and
// remove) over one row per associated room type. Compact on purpose (rateTableSizes.ts) so it fits
// the content width; if it is still wider it scrolls sideways and the room type column stays put.
export default function RateTable({
  seasons,
  roomTypes,
  skus,
  columns,
  errors,
  onSeasonChange,
  onAmountChange,
  onAmountInvalid,
  onDuplicateSeason,
  onRemoveSeason,
}: RateTableProps) {
  const ordered = [...seasons.filter((s) => s.isDefault), ...seasons.filter((s) => !s.isDefault)];
  const span = columns.length + 1;
  const groups = rateColumnGroups(columns);
  return (
    <TableContainer
      tabIndex={0}
      role="region"
      aria-label="Rate table"
      sx={(t) => ({
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        // Inside a grid or flex cell it must shrink to the cell and scroll, never stretch the page.
        minWidth: 0,
        maxWidth: '100%',
        // Inset ring: the scroll box would clip an outer one.
        '&:focus-visible': {
          outline: `2px solid ${t.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Table
        size="small"
        aria-label="Rates by season and room type"
        sx={(t) => ({
          // Separate borders keep the borders of sticky cells when the table scrolls.
          borderCollapse: 'separate',
          borderSpacing: 0,
          '& .MuiTableCell-root': {
            fontSize: t.typography.pxToRem(RATE_TABLE.fontPx),
            py: tablePx(t, RATE_TABLE.cellPaddingYPx),
            px: tablePx(t, RATE_TABLE.cellPaddingXPx),
          },
        })}
      >
        <TableHead>
          <TableRow>
            <TableCell
              aria-hidden
              colSpan={2}
              sx={(t) => ({
                ...stickyFirst(t),
                bgcolor: 'background.paper',
                zIndex: 3,
                borderBottom: 0,
              })}
            />
            {groups.map((g) => (
              <TableCell
                key={g.key}
                colSpan={g.span}
                scope="colgroup"
                align="center"
                title={g.help}
                sx={(t) => ({
                  fontSize: t.typography.pxToRem(RATE_TABLE.headerFontPx),
                  fontWeight: 'bold',
                  lineHeight: 1.25,
                  borderBottom: 0,
                  borderLeft: `1px solid ${t.palette.divider}`,
                  // Long help wraps inside the group; the header never widens the columns.
                  whiteSpace: 'normal',
                })}
              >
                {g.title}
                {g.note ? (
                  <Typography
                    component="span"
                    sx={(t) => ({
                      display: 'block',
                      fontWeight: 'normal',
                      fontSize: t.typography.pxToRem(RATE_TABLE.headerFontPx),
                      color: 'text.secondary',
                    })}
                  >
                    {g.note}
                  </Typography>
                ) : null}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell
              scope="col"
              sx={(t) => ({
                ...stickyFirst(t),
                bgcolor: 'background.paper',
                zIndex: 3,
                minWidth: tablePx(t, RATE_TABLE.seasonColPx),
                maxWidth: tablePx(t, RATE_TABLE.seasonColPx),
                fontSize: t.typography.pxToRem(RATE_TABLE.headerFontPx),
                fontWeight: 'bold',
              })}
            >
              Season / Special Rates
            </TableCell>
            <TableCell
              scope="col"
              sx={(t) => ({
                ...stickyFirst(t, tablePx(t, RATE_TABLE.seasonColPx)),
                bgcolor: 'background.paper',
                zIndex: 3,
                minWidth: tablePx(t, RATE_TABLE.roomTypeMinPx),
                fontSize: t.typography.pxToRem(RATE_TABLE.headerFontPx),
                fontWeight: 'bold',
              })}
            >
              Room Type
            </TableCell>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                scope="col"
                align="center"
                sx={(t) => ({
                  // A header never makes its column wider than the amount field; long labels wrap.
                  width: tablePx(t, RATE_TABLE.amountWidthPx + 2 * RATE_TABLE.cellPaddingXPx),
                  maxWidth: tablePx(t, RATE_TABLE.amountWidthPx + 2 * RATE_TABLE.cellPaddingXPx),
                  fontSize: t.typography.pxToRem(RATE_TABLE.headerFontPx),
                  fontWeight: 'bold',
                  lineHeight: 1.25,
                })}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        {ordered.map((season, seasonIndex) => {
          const e = errors[season.id] ?? {};
          const name = seasonLabel(season);
          const toneIndex = seasonToneIndex(seasons, season.id);
          return (
            <TableBody
              key={season.id}
              data-season={season.id}
              data-tone={toneIndex === null ? 'neutral' : String(toneIndex)}
            >
              {(roomTypes.length === 0 ? [null] : roomTypes).map((roomType, rowIndex) => {
                const amounts = roomType ? amountsFor(season, roomType.id) : null;
                return (
                  <TableRow key={roomType?.id ?? 'none'}>
                    {rowIndex === 0 ? (
                      <TableCell
                        rowSpan={Math.max(1, roomTypes.length)}
                        sx={(t) => ({
                          ...stickyFirst(t),
                          bgcolor: toneOf(t, seasons, season).band,
                          zIndex: 2,
                          p: 0,
                          verticalAlign: 'top',
                          minWidth: tablePx(t, RATE_TABLE.seasonColPx),
                          maxWidth: tablePx(t, RATE_TABLE.seasonColPx),
                          fontWeight: 'normal',
                          boxShadow: `inset ${tablePx(t, RATE_TABLE.accentPx)} 0 0 ${toneOf(t, seasons, season).accent}`,
                          borderTop:
                            seasonIndex === 0
                              ? undefined
                              : `8px solid ${t.palette.background.paper}`,
                        })}
                      >
                        <SeasonCell
                          season={season}
                          errors={e}
                          skus={skus}
                          onChange={(change) => onSeasonChange(season.id, change)}
                          onDuplicate={() => onDuplicateSeason(season.id)}
                          onRemove={() => onRemoveSeason(season.id)}
                        />
                      </TableCell>
                    ) : null}
                    {roomType === null || amounts === null ? (
                      <TableCell
                        colSpan={span}
                        sx={(t) => ({
                          bgcolor: toneOf(t, seasons, season).row,
                          borderTop:
                            seasonIndex === 0
                              ? undefined
                              : `8px solid ${t.palette.background.paper}`,
                        })}
                      >
                        No room types selected
                      </TableCell>
                    ) : (
                      <>
                        <TableCell
                          component="th"
                          scope="row"
                          title={roomType.label}
                          sx={(t) => {
                            const tone = toneOf(t, seasons, season);
                            return {
                              ...stickyFirst(t, tablePx(t, RATE_TABLE.seasonColPx)),
                              bgcolor: tone.row,
                              zIndex: 1,
                              fontWeight: 'normal',
                              minWidth: tablePx(t, RATE_TABLE.roomTypeMinPx),
                              maxWidth: tablePx(t, RATE_TABLE.roomTypeMaxPx),
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              borderTop:
                                seasonIndex === 0 || rowIndex > 0
                                  ? undefined
                                  : `8px solid ${t.palette.background.paper}`,
                            };
                          }}
                        >
                          {roomType.label}
                        </TableCell>
                        {columns.map((c) => (
                          <TableCell
                            key={c.key}
                            align="center"
                            sx={(t) => ({ bgcolor: toneOf(t, seasons, season).row })}
                          >
                            <AmountField
                              label={`${name}, ${roomType.label}, ${c.label}`}
                              cents={amounts[c.key]}
                              onChange={(cents) =>
                                onAmountChange(season.id, roomType.id, c.key, cents)
                              }
                              onInvalidChange={(bad) =>
                                onAmountInvalid(`${season.id}|${roomType.id}|${c.key}`, bad)
                              }
                            />
                          </TableCell>
                        ))}
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          );
        })}
      </Table>
    </TableContainer>
  );
}

interface SeasonCellProps {
  season: RateSeason;
  errors: SeasonErrors;
  skus: readonly RateSku[];
  onChange: (change: SeasonChange) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

// The first column of a season (legacy "Season / Special Rates"): it spans the season's room type
// rows and holds the name, start and end date, SKU, duplicate and remove. The default season has its
// title and the legacy explanation. Sticky, so the dates stay in view while the rates scroll.
function SeasonCell({ season, errors: e, skus, onChange, onDuplicate, onRemove }: SeasonCellProps) {
  const name = seasonLabel(season);
  const kind = seasonSkuKind(season);
  const kindLabelId = `${seasonDomId(season.id, 'sku')}-kind`;
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1,
        pr: 1,
        pl: tablePx(t, RATE_TABLE.accentPx + 6),
      })}
    >
      {season.isDefault ? (
        <Box>
          <Typography component="h3" sx={{ fontWeight: 'bold', typography: 'body2' }}>
            Default
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            If no other seasons or special rates apply, this pricing will serve as default.
          </Typography>
        </Box>
      ) : (
        <>
          <Typography component="h3" sx={{ fontWeight: 'bold', typography: 'body2' }}>
            Season / Special Rates
            <Box component="span" sx={visuallyHidden}>
              {`: ${name}`}
            </Box>
          </Typography>
          <TextField
            id={seasonDomId(season.id, 'name')}
            label="Season name"
            size="small"
            value={season.name}
            onChange={(ev) => onChange({ name: ev.target.value })}
            error={Boolean(e.name)}
            helperText={e.name}
            slotProps={{ htmlInput: { maxLength: SEASON_NAME_MAX } }}
            required
            sx={{ bgcolor: 'background.paper' }}
          />
          <Box id={seasonDomId(season.id, 'startDate')} sx={{ bgcolor: 'background.paper' }}>
            <DateField
              fullWidth
              size="small"
              label="Start date"
              ariaLabel={`${name} start date`}
              value={season.startDate}
              onChange={(startDate) => onChange({ startDate })}
              error={Boolean(e.startDate)}
              helperText={e.startDate}
            />
          </Box>
          <Box id={seasonDomId(season.id, 'endDate')} sx={{ bgcolor: 'background.paper' }}>
            <DateField
              fullWidth
              size="small"
              label="End date"
              ariaLabel={`${name} end date`}
              value={season.endDate}
              min={season.startDate || undefined}
              onChange={(endDate) => onChange({ endDate })}
              error={Boolean(e.endDate)}
              helperText={e.endDate}
            />
          </Box>
          <FormControl>
            <FormLabel id={kindLabelId} sx={{ typography: 'caption', color: 'text.primary' }}>
              {`SKU type (${name})`}
            </FormLabel>
            <RadioGroup
              row
              aria-labelledby={kindLabelId}
              value={kind}
              onChange={(ev) => {
                const next = ev.target.value as AddOnKind;
                // A SKU of the other kind no longer applies.
                const keep = skus.some((s) => s.id === season.sku?.id && s.kind === next);
                onChange({ skuKind: next, sku: keep ? season.sku : null });
              }}
            >
              <FormControlLabel
                value="item"
                control={<Radio size="small" />}
                label="Item"
                sx={{ mr: 1 }}
              />
              <FormControlLabel value="combo" control={<Radio size="small" />} label="Combo" />
            </RadioGroup>
          </FormControl>
          <Box sx={{ bgcolor: 'background.paper' }}>
            <LookupField
              id={seasonDomId(season.id, 'sku')}
              size="small"
              label={`SKU (${name})`}
              placeholder="Same as the category"
              value={season.sku ?? null}
              options={skusOfKind(skus, kind)}
              onChange={(sku) => onChange({ sku })}
              error={e.sku}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <IconButton
              size="small"
              color="primary"
              aria-label={`Duplicate season ${name}`}
              onClick={onDuplicate}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
            <RemoveIconButton size="small" label={`season ${name}`} onClick={onRemove} />
          </Box>
        </>
      )}
      {e.amount ? (
        // On a white chip: error text is 4.98:1 on white but under AA on the tinted bands.
        <Typography
          variant="caption"
          color="error"
          role="alert"
          sx={{ bgcolor: 'background.paper', px: 1, py: 0.25, borderRadius: 0.5 }}
        >
          {e.amount}
        </Typography>
      ) : null}
    </Box>
  );
}
