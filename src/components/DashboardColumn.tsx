import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import { HEADER_HEIGHT } from '../app/layout';
import { hasVerticalOverflow } from '../app/overflow';

export interface DashboardColumnProps {
  /** Column title, in normal case; it is shown uppercase with CSS (the source text stays readable). */
  title: string;
  children?: React.ReactNode;
}

/**
 * One dashboard column: an uppercase section heading above a white panel (Figma 69:3790 / 69:3713 /
 * 69:3803). From the lg breakpoint (1200px) the panel fills the column and scrolls on its own; below
 * it the column grows with its content, so there is no nested scroll area on the page.
 * While the panel overflows it is a keyboard-focusable region named by the column title.
 */
export default function DashboardColumn({ title, children }: DashboardColumnProps) {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;
    const measure = () => setOverflowing(hasVerticalOverflow(scrollEl));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Observe the box (viewport / breakpoint changes) and the content (children growing).
    const observer = new ResizeObserver(measure);
    observer.observe(scrollEl);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        [t.breakpoints.up('lg')]: { flex: '1 1 0', maxWidth: t.spacing(56.25) /* 450px */ },
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
          // Stacked: the panel is as tall as its content (page scrolls). Desktop: scroll inside.
          [t.breakpoints.down('lg')]: { minHeight: t.spacing(HEADER_HEIGHT * 4) },
        })}
      >
        <Box
          ref={scrollRef}
          {...(overflowing ? { tabIndex: 0, role: 'region', 'aria-labelledby': headingId } : {})}
          sx={(t) => ({
            flex: '1 1 auto',
            minHeight: 0,
            p: 3,
            [t.breakpoints.up('lg')]: { overflowY: 'auto' },
          })}
        >
          <div ref={contentRef}>{children}</div>
        </Box>
      </Paper>
    </Box>
  );
}
