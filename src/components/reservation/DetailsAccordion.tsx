import CreditCard from '@mui/icons-material/CreditCard';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Groups from '@mui/icons-material/Groups';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Description from '@mui/icons-material/Description';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import type { ReservationDetail, ReservationRoomDetail } from '../../api';
import { formatPanelDate } from '../../app/newReservation';
import { formatMoney } from '../../app/quickStats';
import { folioPath } from '../../app/routes';
import GuestsSection from './GuestsSection';
import NotesSection from './NotesSection';

type SectionId = 'guests' | 'add-ons' | 'notes' | 'rates';

interface Section {
  id: SectionId;
  title: string;
  icon: ReactNode;
}

export const DETAILS_SECTIONS: readonly Section[] = [
  { id: 'guests', title: 'Guest Details', icon: <Groups /> },
  { id: 'add-ons', title: 'Add-Ons', icon: <PlaylistAdd /> },
  { id: 'notes', title: 'Notes', icon: <Description /> },
  { id: 'rates', title: 'Rates & Payment', icon: <CreditCard /> },
];

const stubAction = (label: string, reason: string, onStub: (message: string) => void) => (
  <Button size="small" onClick={() => onStub(reason)}>
    {label}
  </Button>
);

function AddOns({ detail, onStub }: { detail: ReservationDetail; onStub: (m: string) => void }) {
  return (
    <Box>
      {detail.addOns.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No add-ons on this reservation.
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {detail.addOns.map((a) => (
            <Box
              component="li"
              key={a.id}
              sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
            >
              <Typography variant="body2">
                {a.quantity}x {a.name}
              </Typography>
              <Typography variant="body2">+{formatMoney(a.priceCents)}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ mt: 1 }}>
        {stubAction(
          'Add an add-on',
          'Adding add-ons arrives with the Reservation Hub (ticket 3.12).',
          onStub,
        )}
      </Box>
    </Box>
  );
}

function Rates({ detail, onStub }: { detail: ReservationDetail; onStub: (m: string) => void }) {
  return (
    <Box>
      <Typography variant="subtitle2" component="h3">
        Stay Summary
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, my: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
          Folio Total
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
          {formatMoney(detail.stay.folioTotalCents)}
        </Typography>
      </Box>
      <Box
        component="ul"
        sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: (t) => t.spacing(20), overflow: 'auto' }}
      >
        {detail.stay.lines.map((l, i) => (
          <Box
            component="li"
            key={`${l.date}-${i}`}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="caption">
              {l.roomType} {formatPanelDate(l.date)}
            </Typography>
            <Typography variant="caption">{formatMoney(l.amountCents)}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<CreditCard />}
          fullWidth
          sx={{ borderColor: 'primary.outlinedBorder' }}
          onClick={() =>
            onStub('Payments arrive with the payments ticket (mock payments interface).')
          }
        >
          Payment
        </Button>
        <Button variant="contained" fullWidth component={RouterLink} to={folioPath(detail.id)}>
          Folio
        </Button>
      </Box>
    </Box>
  );
}

export interface DetailsAccordionProps {
  detail: ReservationDetail;
  /** The room selected in the room selector: Guest Details shows its guests. */
  room: ReservationRoomDetail;
  /** Holds `reservation.edit`. */
  canEdit: boolean;
  /** The reservation as it is after a save (guests, notes) or a reload that a failure triggered. */
  onReloaded: (detail: ReservationDetail) => void;
  /** A save was applied: the schedule behind the panel reloads. */
  onChanged?: () => void;
  /** Polite notice (saved, failed outside the section) and sections built later. */
  onStub: (message: string) => void;
}

/**
 * The four sections at the foot of the panel (Figma "ResDetailsAccordion"): one open at a time,
 * each a button with aria-expanded (Enter/Space toggle). Guest Details and Notes edit in place
 * (ticket 151); Add-Ons and payments belong to later tickets and report that through `onStub`.
 */
export default function DetailsAccordion({
  detail,
  room,
  canEdit,
  onReloaded,
  onChanged,
  onStub,
}: DetailsAccordionProps) {
  const [open, setOpen] = useState<SectionId | null>(null);
  const body = (id: SectionId) =>
    id === 'guests' ? (
      <GuestsSection
        detail={detail}
        room={room}
        canEdit={canEdit}
        onReloaded={onReloaded}
        onChanged={onChanged}
        say={onStub}
      />
    ) : id === 'add-ons' ? (
      <AddOns detail={detail} onStub={onStub} />
    ) : id === 'notes' ? (
      <NotesSection
        detail={detail}
        canEdit={canEdit}
        onReloaded={onReloaded}
        onChanged={onChanged}
        say={onStub}
      />
    ) : (
      <Rates detail={detail} onStub={onStub} />
    );
  return (
    <Box
      sx={{
        borderTop: (t) => `1px solid ${t.palette.text.primary}`,
        maxHeight: '60%',
        overflow: 'auto',
      }}
    >
      {DETAILS_SECTIONS.map((s) => (
        <Accordion
          key={s.id}
          disableGutters
          square
          elevation={0}
          expanded={open === s.id}
          onChange={(_, expanded) => setOpen(expanded ? s.id : null)}
          slotProps={{ transition: { unmountOnExit: true } }}
          sx={{
            '&:before': { display: 'none' },
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            '&.Mui-expanded': { m: 0 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                gap: 1.5,
                color: 'text.secondary',
              },
              '& .MuiSvgIcon-root:first-of-type': { color: 'primary.main' },
              '&.Mui-expanded': { bgcolor: 'primary.tint' },
            }}
          >
            {s.icon}
            <Typography variant="body1">{s.title}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, py: 2 }}>{body(s.id)}</AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
