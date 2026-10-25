import History from '@mui/icons-material/History';
import Button from '@mui/material/Button';
import { useState } from 'react';
import type { ChangeLogPageId } from '../../../api/changeLogTypes';
import ChangeLogOverlay from './ChangeLogOverlay';

// The "Change Log" button of an admin page and the dialog it opens (ticket 7.10).
export default function ChangeLogButton({ page }: { page: ChangeLogPageId }) {
  const [open, setOpen] = useState(false);
  // A new key on every opening gives the dialog fresh sort, filters, page and rows (D-97-5).
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        variant="text"
        size="large"
        startIcon={<History />}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        Change Log
      </Button>
      <ChangeLogOverlay key={session} page={page} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
