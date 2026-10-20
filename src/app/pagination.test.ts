import { clampPage, formatRange, pageAfterRowsChange, pageCount, pageRange } from './pagination';

describe('pagination helpers', () => {
  it('counts pages, minimum one', () => {
    expect(pageCount(120, 25)).toBe(5);
    expect(pageCount(126, 25)).toBe(6);
    expect(pageCount(0, 25)).toBe(1);
  });

  it('clamps the page', () => {
    expect(clampPage(9, 120, 25)).toBe(5);
    expect(clampPage(0, 120, 25)).toBe(1);
    expect(clampPage(Number.NaN, 120, 25)).toBe(1);
  });

  it('computes the visible range, with a short last page', () => {
    expect(pageRange(1, 120, 25)).toEqual({ from: 1, to: 25 });
    expect(pageRange(5, 118, 25)).toEqual({ from: 101, to: 118 });
    expect(pageRange(1, 0, 25)).toEqual({ from: 0, to: 0 });
  });

  it('formats the range text', () => {
    expect(formatRange(2, 120, 25)).toBe('26–50 of 120');
    expect(formatRange(1, 0, 25)).toBe('0 of 0');
  });

  it('keeps the first visible row on screen when rows per page changes', () => {
    expect(pageAfterRowsChange(3, 10, 25)).toBe(1);
    expect(pageAfterRowsChange(3, 25, 10)).toBe(6);
  });
});
