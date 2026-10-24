import History from '@mui/icons-material/History';
import Button from '@mui/material/Button';
import { useState } from 'react';
import type { ChangeLogPageId } from '../../../api/changeLogTypes';
import ChangeLogOverlay from './ChangeLogOverlay';

// The "Change Log" button of an admin page and the overlay it opens (ticket 7.10).
export default function ChangeLogButton({ page }: { page: ChangeLogPageId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="text" size="large" startIcon={<History />} onClick={() => setOpen(true)}>
        Change Log
      </Button>
      <ChangeLogOverlay page={page} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
