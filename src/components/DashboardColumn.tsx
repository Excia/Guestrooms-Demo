import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { hasVerticalOverflow } from '../app/overflow';

/** Column width at the 1512 design width (Figma 69:3790); 56.25 x 8px = 450px. */
export const COLUMN_MAX_WIDTH_SPACING = 56.25;
/** Smallest stacked panel: 28 x 8px = 224px, so an empty or short panel is still a visible card. */
const STACKED_MIN_HEIGHT_SPACING = 28;

export interface DashboardColumnProps {
  /** Column title, in normal case; it is shown uppercase with CSS (the source text stays readable). */
  title: string;
  /**
   * Column content: any ReactNode. It must not set its own scroll or height; the panel owns the
   * scrolling. Pass `disablePadding` for full-bleed content (e.g. list rows).
   */
  children?: React.ReactNode;
  /** Remove the panel's inner padding. Default false. */
  disablePadding?: boolean;
}

/**
 * One dashboard column: an uppercase section heading above a white panel (Figma 69:3790 / 69:3713 /
 * 69:3803). From the lg breakpoint (1200px) the panel fills the column and scrolls on its own; below
 * it the panel grows with its content (down to a minimum height), so the page scrolls and there is
 * no nested scroll area. While the panel overflows it is a keyboard-focusable region named by the
 * column title; it stays focusable while it has focus, so focus never drops to the body.
 */
export default function DashboardColumn({
  title,
  children,
  disablePadding = false,
}: DashboardColumnProps) {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [focused, setFocused] = useState(false);

  // Layout effect: measure before first paint so the first frame has the right tabindex.
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) setOverflowing(hasVerticalOverflow(scrollEl));
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || typeof ResizeObserver === 'undefined') return;
    // Observe the box (viewport / breakpoint changes) and the content (children growing).
    const observer = new ResizeObserver(() => setOverflowing(hasVerticalOverflow(scrollEl)));
    observer.observe(scrollEl);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  const asRegion = overflowing || focused;

  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        // Desktop: the column spans the Dashboard grid's two rows (title, panel) and shares them via
        // subgrid, so a wrapped title in one column pushes all panel tops down together.
        [t.breakpoints.up('lg')]: {
          display: 'grid',
          gridRow: 'span 2',
          gridTemplateRows: 'subgrid',
        },
      })}
    >
      <Typography
        id={headingId}
        variant="subtitle1"
        component="h2"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', mb: 0.5 }}
      >
        {title}
      </Typography>
      <Paper
        elevation={0}
        sx={(t) => ({
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Stacked: height follows the content (the page scrolls), but never below a card-sized minimum.
          [t.breakpoints.down('lg')]: { minHeight: t.spacing(STACKED_MIN_HEIGHT_SPACING) },
        })}
      >
        <Box
          ref={scrollRef}
          {...(asRegion ? { tabIndex: 0, role: 'region', 'aria-labelledby': headingId } : {})}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          sx={(t) => ({
            flex: '1 1 auto',
            minHeight: 0,
            p: disablePadding ? 0 : 3,
            '&:focus-visible': {
              outline: `2px solid ${t.palette.primary.main}`,
              outlineOffset: -2,
            },
            [t.breakpoints.up('lg')]: { overflowY: 'auto' },
          })}
        >
          <div ref={contentRef}>{children}</div>
        </Box>
      </Paper>
    </Box>
  );
}
