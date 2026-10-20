// Pure paging helpers for <Pagination> (Figma 20:2576).

export const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export function pageCount(total: number, rowsPerPage: number): number {
  return rowsPerPage > 0 ? Math.max(1, Math.ceil(total / rowsPerPage)) : 1;
}

/** Keeps a 1-based page inside 1..pageCount (e.g. after rows per page grows). */
export function clampPage(page: number, total: number, rowsPerPage: number): number {
  const last = pageCount(total, rowsPerPage);
  return Math.min(Math.max(1, Math.trunc(page) || 1), last);
}

/** 1-based inclusive row range shown on a page; { from: 0, to: 0 } when there are no rows. */
export function pageRange(
  page: number,
  total: number,
  rowsPerPage: number,
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const p = clampPage(page, total, rowsPerPage);
  return { from: (p - 1) * rowsPerPage + 1, to: Math.min(p * rowsPerPage, total) };
}

/** "1–25 of 120" (en dash), "0 of 0" when empty. */
export function formatRange(page: number, total: number, rowsPerPage: number): string {
  const { from, to } = pageRange(page, total, rowsPerPage);
  return total <= 0 ? '0 of 0' : `${from}–${to} of ${total}`;
}

/** The page that keeps the first visible row in view after changing rows per page. */
export function pageAfterRowsChange(
  page: number,
  oldRowsPerPage: number,
  newRowsPerPage: number,
): number {
  const firstRow = (Math.max(1, page) - 1) * oldRowsPerPage;
  return Math.floor(firstRow / newRowsPerPage) + 1;
}
