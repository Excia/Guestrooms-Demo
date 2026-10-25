import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useId } from 'react';
import DialogHeader from '../shared/DialogHeader';
import { roomResultLabel, summarizeCheckIn, type RoomCheckInResult } from '../../app/bulkCheckIn';

export interface CheckInResultDialogProps {
  open: boolean;
  results: readonly RoomCheckInResult[];
  onClose: () => void;
}

/**
 * Bulk check-in result (Figma Check In Mixed Result 2524:35269): the rooms checked in with green
 * checks, then the rooms that could not be, with red crosses and the reason. Only the parts that
 * apply are shown, so an all-success or all-failure attempt is the same dialog with one list (the
 * single-outcome copy is not in Figma, Q-25-2). The summary is announced when it opens.
 */
export default function CheckInResultDialog({ open, results, onClose }: CheckInResultDialogProps) {
  const id = useId();
  const summary = summarizeCheckIn(results);
  const heading = summary.successTitle ?? summary.failureTitle;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby={`${id}-title`}>
      <DialogHeader id={`${id}-title`} title={heading ?? ''} onClose={onClose} closeAutoFocus />
      <Box role="status" sx={visuallyHidden}>
        {summary.announcement}
      </Box>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2.5 }}>
        {summary.successTitle ? (
          <List
            disablePadding
            aria-label="Rooms checked in"
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {summary.succeeded.map(({ room }) => (
              <ListItem
                key={room.reservationRoomId}
                disablePadding
                sx={{ alignItems: 'flex-start', gap: 0.5 }}
              >
                <CheckIcon color="primary" aria-hidden />
                <Typography>{roomResultLabel(room)}</Typography>
              </ListItem>
            ))}
          </List>
        ) : null}
        {summary.successTitle && summary.failureTitle ? (
          <Typography variant="h6" component="h3" sx={{ color: 'warning.main' }}>
            {summary.failureTitle}
          </Typography>
        ) : null}
        {summary.failureTitle ? (
          <List
            disablePadding
            aria-label="Rooms not checked in"
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {summary.failed.map(({ room, failure }) => (
              <ListItem
                key={room.reservationRoomId}
                disablePadding
                sx={{ alignItems: 'flex-start', gap: 0.5 }}
              >
                <CloseIcon sx={{ color: 'warning.main' }} aria-hidden />
                <Box>
                  <Typography>{roomResultLabel(room)}</Typography>
                  <Typography variant="body2" sx={{ color: 'warning.main' }}>
                    {failure}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
