import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

/** Placeholder rows while the schedule loads (first load, or the page chunk). */
export default function ScheduleSkeleton() {
  return (
    <Box role="status" aria-label="Loading schedule" sx={{ p: 2, display: 'grid', gap: 1 }}>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={60} />
      ))}
    </Box>
  );
}
