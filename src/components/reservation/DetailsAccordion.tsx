import CreditCard from '@mui/icons-material/CreditCard';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Groups from '@mui/icons-material/Groups';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Description from '@mui/icons-material/Description';
import Badge from '@mui/icons-material/Badge';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import type { ReservationDetail } from '../../api';
import { formatPanelDate } from '../../app/newReservation';
import { guestCountText } from '../../app/reservationPanel';
import { formatMoney } from '../../app/quickStats';
import { OPEN_FOLIOS_PATH } from '../../app/routes';

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

function GuestDetails({
  detail,
  onStub,
}: {
  detail: ReservationDetail;
  onStub: (m: string) => void;
}) {
  const lead = detail.leadOccupant;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">
          {guestCountText(detail.adults, detail.children)}
        </Typography>
        {stubAction(
          'Edit guests',
          'Editing guests arrives with the Reservation Hub (ticket 3.12).',
          onStub,
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Badge aria-hidden color="primary" fontSize="small" />
        <Box>
          <Typography variant="body2">
            <strong>{lead.name}</strong>
            {lead.memberNumber ? ` (${lead.memberNumber})` : ''}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Lead occupant
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

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

function Notes({ detail, onStub }: { detail: ReservationDetail; onStub: (m: string) => void }) {
  const note = (label: string, text: string) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {text || 'None'}
      </Typography>
    </Box>
  );
  return (
    <Box>
      {note('Public Notes', detail.publicNotes)}
      {note('Private Notes', detail.privateNotes)}
      {stubAction(
        'Edit notes',
        'Editing notes arrives with the Reservation Hub (ticket 3.12).',
        onStub,
      )}
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
        <Button variant="contained" fullWidth component={RouterLink} to={OPEN_FOLIOS_PATH}>
          Folio
        </Button>
      </Box>
    </Box>
  );
}

export interface DetailsAccordionProps {
  detail: ReservationDetail;
  /** Sections whose editing is built later report why here. */
  onStub: (message: string) => void;
}

/**
 * The four sections at the foot of the panel (Figma "ResDetailsAccordion"): one open at a time,
 * each a button with aria-expanded (Enter/Space toggle). Content is read-only here; editing
 * belongs to the Reservation Hub (ticket 3.12) and reports that through `onStub`.
 */
export default function DetailsAccordion({ detail, onStub }: DetailsAccordionProps) {
  const [open, setOpen] = useState<SectionId | null>(null);
  const body = (id: SectionId) =>
    id === 'guests' ? (
      <GuestDetails detail={detail} onStub={onStub} />
    ) : id === 'add-ons' ? (
      <AddOns detail={detail} onStub={onStub} />
    ) : id === 'notes' ? (
      <Notes detail={detail} onStub={onStub} />
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
            aria-controls={`panel-section-${s.id}`}
            id={`panel-section-${s.id}-header`}
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
          <AccordionDetails
            id={`panel-section-${s.id}`}
            role="region"
            aria-labelledby={`panel-section-${s.id}-header`}
            sx={{ px: 2.5, py: 2 }}
          >
            {body(s.id)}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
