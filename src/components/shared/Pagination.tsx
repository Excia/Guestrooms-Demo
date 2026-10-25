import Box from '@mui/material/Box';
import MuiPagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';
import {
  clampPage,
  DEFAULT_ROWS_PER_PAGE_OPTIONS,
  formatRange,
  pageAfterRowsChange,
  pageCount,
} from '../../app/pagination';
import { TOOLBAR_FIELD_SIZE } from './controlSizes';
import Select from './Select';

export interface PaginationChange {
  page: number;
  rowsPerPage: number;
}

export interface PaginationProps {
  /** 1-based current page. Against a known total, an out-of-range page is corrected via onChange. */
  page: number;
  rowsPerPage: number;
  /**
   * Total rows. Leave it undefined while loading: nothing is clamped and no range text shows.
   * A total of 0 is treated the same way for clamping (page is left alone, so a first fetch that
   * is in flight cannot reset the user to page 1); the range text then reads "0 of 0".
   */
  total?: number;
  /** One call per user action (or per correction), so a consumer fetches once. */
  onChange: (next: PaginationChange) => void;
  /** A rowsPerPage that is not listed is added to the select so it still shows. */
  rowsPerPageOptions?: readonly number[];
  /** Accessible name of the navigation landmark. */
  label?: string;
}

// Rows-per-page select, range text and page items. One pager look for every list: the select is an
// outlined 40px toolbar field (owner decision 2026-10-25; Figma 20:2576 drew it filled, see F-178-2).
export default function Pagination({
  page,
  rowsPerPage,
  total,
  onChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  label = 'Pagination',
}: PaginationProps) {
  const known = total !== undefined && total > 0;
  const current = known ? clampPage(page, total, rowsPerPage) : Math.max(1, Math.trunc(page) || 1);
  // The latest handler lives in a ref so an inline arrow cannot re-fire the correction each render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (current !== page) onChangeRef.current({ page: current, rowsPerPage });
  }, [current, page, rowsPerPage]);

  const listed = rowsPerPageOptions.includes(rowsPerPage)
    ? rowsPerPageOptions
    : [...rowsPerPageOptions, rowsPerPage].sort((a, b) => a - b);
  const options = listed.map((n) => ({ value: n, label: String(n) }));
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 3,
      }}
    >
      <Select
        inlineLabel
        size={TOOLBAR_FIELD_SIZE}
        sx={{ minWidth: (t) => t.spacing(24) }}
        label="Rows per page"
        value={rowsPerPage}
        options={options}
        onChange={(n) =>
          onChange({ page: pageAfterRowsChange(current, rowsPerPage, n), rowsPerPage: n })
        }
      />
      <Typography variant="body2" sx={{ color: 'text.secondary' }} aria-live="polite">
        {total === undefined ? '' : formatRange(current, total, rowsPerPage)}
      </Typography>
      <MuiPagination
        aria-label={label}
        count={known ? pageCount(total, rowsPerPage) : current}
        page={current}
        onChange={(_, next) => onChange({ page: next, rowsPerPage })}
        variant="outlined"
        shape="rounded"
        size="large"
        sx={{ '& .MuiPaginationItem-root': { m: 0.375 } }}
      />
    </Box>
  );
}
