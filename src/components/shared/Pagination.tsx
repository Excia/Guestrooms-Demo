import Box from '@mui/material/Box';
import MuiPagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import {
  clampPage,
  DEFAULT_ROWS_PER_PAGE_OPTIONS,
  formatRange,
  pageAfterRowsChange,
  pageCount,
} from '../../app/pagination';
import Select from './Select';

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  rowsPerPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  rowsPerPageOptions?: readonly number[];
  /** Accessible name of the navigation landmark. */
  label?: string;
}

// Rows-per-page select, range text and page items (Figma 20:2576: 40px outlined items, filled select).
export default function Pagination({
  page,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  label = 'Pagination',
}: PaginationProps) {
  const current = clampPage(page, total, rowsPerPage);
  const options = rowsPerPageOptions.map((n) => ({ value: n, label: String(n) }));
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
          label="Rows per page"
          value={rowsPerPage}
          options={options}
          onChange={(n) => {
            onRowsPerPageChange(n);
            onPageChange(pageAfterRowsChange(current, rowsPerPage, n));
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {formatRange(current, total, rowsPerPage)}
      </Typography>
      <MuiPagination
        aria-label={label}
        count={pageCount(total, rowsPerPage)}
        page={current}
        onChange={(_, next) => onPageChange(next)}
        variant="outlined"
        shape="rounded"
        size="large"
        showFirstButton={false}
        sx={{ '& .MuiPaginationItem-root': { m: 0.375 } }}
      />
    </Box>
  );
}
