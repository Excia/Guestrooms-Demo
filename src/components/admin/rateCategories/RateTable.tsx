import ContentCopy from '@mui/icons-material/ContentCopyOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { LookupRef, RateColumnKey, RateSeason } from '../../../api/types';
import {
  amountsFor,
  SEASON_NAME_MAX,
  type RateColumn,
  type SeasonErrors,
} from '../../../app/rateCategories';
import DateField from '../../shared/DateField';
import RemoveIconButton from '../../shared/RemoveIconButton';
import AmountField from './AmountField';

export interface RateTableProps {
  seasons: readonly RateSeason[];
  /** The associated room types, one row each per season. */
  roomTypes: readonly LookupRef[];
  columns: readonly RateColumn[];
  errors: Record<string, SeasonErrors>;
  onSeasonChange: (
    seasonId: string,
    change: Partial<Pick<RateSeason, 'name' | 'startDate' | 'endDate'>>,
  ) => void;
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

export const seasonDomId = (seasonId: string, field: 'name' | 'startDate' | 'endDate') =>
  `rate-season-${seasonId}-${field}`;

const seasonLabel = (season: RateSeason) =>
  season.isDefault ? 'Default' : season.name.trim() || 'New season';

// The rate table (legacy RateCategoryTable): the default season first, then each season or special
// rate with its own name and dates. One row per associated room type and season; the money cells
// are typed in dollars. Wide on purpose: it scrolls sideways inside its own region.
export default function RateTable({
  seasons,
  roomTypes,
  columns,
  errors,
  onSeasonChange,
  onAmountChange,
  onAmountInvalid,
  onDuplicateSeason,
  onRemoveSeason,
}: RateTableProps) {
  const ordered = [...seasons.filter((s) => s.isDefault), ...seasons.filter((s) => !s.isDefault)];
  return (
    <TableContainer
      tabIndex={0}
      role="region"
      aria-label="Rate table"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      <Table size="small" aria-label="Rates by season and room type">
        <TableHead>
          <TableRow>
            <TableCell scope="col" sx={{ minWidth: 220 }}>
              Season / Special Rates
            </TableCell>
            <TableCell scope="col">Room Type</TableCell>
            {columns.map((c) => (
              <TableCell key={c.key} scope="col" align="center">
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        {ordered.map((season) => {
          const e = errors[season.id] ?? {};
          const name = seasonLabel(season);
          return (
            <TableBody key={season.id}>
              {roomTypes.length === 0 ? (
                <TableRow>
                  <TableCell>{season.isDefault ? <DefaultNote /> : name}</TableCell>
                  <TableCell colSpan={columns.length + 1}>No room types selected</TableCell>
                </TableRow>
              ) : null}
              {roomTypes.map((roomType, index) => {
                const amounts = amountsFor(season, roomType.id);
                return (
                  <TableRow key={roomType.id} hover>
                    {index === 0 ? (
                      <TableCell
                        rowSpan={roomTypes.length}
                        sx={{
                          verticalAlign: 'top',
                          bgcolor: season.isDefault ? 'action.hover' : undefined,
                        }}
                      >
                        {season.isDefault ? (
                          <DefaultNote />
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                              id={seasonDomId(season.id, 'name')}
                              label="Season name"
                              size="small"
                              value={season.name}
                              onChange={(ev) =>
                                onSeasonChange(season.id, { name: ev.target.value })
                              }
                              error={Boolean(e.name)}
                              helperText={e.name}
                              slotProps={{ htmlInput: { maxLength: SEASON_NAME_MAX } }}
                              required
                            />
                            <Box id={seasonDomId(season.id, 'startDate')}>
                              <DateField
                                fullWidth
                                size="small"
                                label="Start date"
                                ariaLabel={`${name} start date`}
                                value={season.startDate}
                                onChange={(startDate) => onSeasonChange(season.id, { startDate })}
                                error={Boolean(e.startDate)}
                                helperText={e.startDate}
                              />
                            </Box>
                            <Box id={seasonDomId(season.id, 'endDate')}>
                              <DateField
                                fullWidth
                                size="small"
                                label="End date"
                                ariaLabel={`${name} end date`}
                                value={season.endDate}
                                min={season.startDate || undefined}
                                onChange={(endDate) => onSeasonChange(season.id, { endDate })}
                                error={Boolean(e.endDate)}
                                helperText={e.endDate}
                              />
                            </Box>
                            {e.amount ? (
                              <Typography variant="caption" color="error" role="alert">
                                {e.amount}
                              </Typography>
                            ) : null}
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={`Duplicate season ${name}`}
                                onClick={() => onDuplicateSeason(season.id)}
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                              <RemoveIconButton
                                size="small"
                                label={`season ${name}`}
                                onClick={() => onRemoveSeason(season.id)}
                              />
                            </Box>
                          </Box>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell component="th" scope="row" sx={{ whiteSpace: 'nowrap' }}>
                      {roomType.label}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key} align="center">
                        <AmountField
                          label={`${name}, ${roomType.label}, ${c.label}`}
                          cents={amounts[c.key]}
                          onChange={(cents) => onAmountChange(season.id, roomType.id, c.key, cents)}
                          onInvalidChange={(bad) =>
                            onAmountInvalid(`${season.id}|${roomType.id}|${c.key}`, bad)
                          }
                        />
                      </TableCell>
                    ))}
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

function DefaultNote() {
  return (
    <Box>
      <Typography sx={{ fontWeight: 'bold' }}>Default</Typography>
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        If no other seasons or special rates apply, this pricing will serve as default.
      </Typography>
    </Box>
  );
}
