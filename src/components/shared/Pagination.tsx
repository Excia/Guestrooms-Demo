import Box from '@mui/material/Box';
import MuiPagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import {
  clampPage,
  DEFAULT_ROWS_PER_PAGE_OPTIONS,
  formatRange,
  pageAfterRowsChange,
  pageCount,
} from '../../app/pagination';
import Select from './Select';

export interface PaginationChange {
  page: number;
  rowsPerPage: number;
}

export interface PaginationProps {
  /** 1-based current page. An out-of-range page is corrected through onChange. */
  page: number;
  rowsPerPage: number;
  total: number;
  /** One call per user action (or per correction), so a consumer fetches once. */
  onChange: (next: PaginationChange) => void;
  /** A rowsPerPage that is not listed is added to the select so it still shows. */
  rowsPerPageOptions?: readonly number[];
  /** Accessible name of the navigation landmark. */
  label?: string;
}

// Rows-per-page select, range text and page items (Figma 20:2576: 40px outlined items, filled select).
export default function Pagination({
  page,
  rowsPerPage,
  total,
  onChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  label = 'Pagination',
}: PaginationProps) {
  const current = clampPage(page, total, rowsPerPage);
  useEffect(() => {
    if (current !== page) onChange({ page: current, rowsPerPage });
  }, [current, page, rowsPerPage, onChange]);

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
      <Box sx={{ width: (t) => t.spacing(18) }}>
        <Select
          variant="filled"
          fullWidth
          label="Rows per page"
          value={rowsPerPage}
          options={options}
          onChange={(n) =>
            onChange({ page: pageAfterRowsChange(current, rowsPerPage, n), rowsPerPage: n })
          }
        />
      </Box>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {formatRange(current, total, rowsPerPage)}
      </Typography>
      <MuiPagination
        aria-label={label}
        count={pageCount(total, rowsPerPage)}
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
