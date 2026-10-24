import Badge from '@mui/icons-material/Badge';
import Edit from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { Member, ReservationDetail, ReservationRoomDetail } from '../../api';
import { guestCountText } from '../../app/reservationPanel';
import {
  canStep,
  confirmationsToSend,
  draftFromRoom,
  guestFromMember,
  guestSlots,
  guestsAccess,
  guestsFailure,
  guestsSuccessMessage,
  isGuestsDirty,
  MAX_PARTY,
  MIN_ADULTS,
  roomParty,
  setSlot,
  slotKindText,
  stepCount,
  toUpdateGuestsRequest,
  totalGuests,
  type DraftGuest,
  type GuestsDraft,
} from '../../app/roomGuests';
import AddGuestDialog from './AddGuestDialog';
import CountStepper from './CountStepper';
import GuestAutocomplete from './GuestAutocomplete';
import { useIdempotentSave } from './useIdempotentSave';

export interface GuestsSectionProps {
  detail: ReservationDetail;
  /** The room whose guests are shown (the one selected in the room selector). */
  room: ReservationRoomDetail;
  canEdit: boolean;
  /** The reservation as it is after a save, or after a reload that a failure triggered. */
  onReloaded: (detail: ReservationDetail) => void;
  /** A save was applied: the schedule behind the panel reloads. */
  onChanged?: () => void;
  say: (text: string) => void;
}

const asMember = (g: DraftGuest): Member => ({
  id: g.memberId ?? g.name,
  memberNumber: g.memberNumber ?? '',
  name: g.name,
  email: g.email ?? '',
  phone: '',
});

function GuestCard({
  name,
  memberNumber,
  role,
  email,
  sent,
}: {
  name: string;
  memberNumber?: string | null;
  role: string;
  email?: string;
  sent?: boolean;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 1,
        px: 1.5,
        py: 1,
        listStyle: 'none',
      }}
    >
      <Badge aria-hidden color="primary" fontSize="small" />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          {name}
          {memberNumber ? ` (${memberNumber})` : ''}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {role}
          {email ? ` · ${email}` : ''}
        </Typography>
      </Box>
      {sent ? <Chip size="small" label="Confirmation sent" variant="outlined" /> : null}
    </Box>
  );
}

/**
 * Guest Details of the selected room (ticket 151; legacy "Additional Guests"): the party, the lead
 * occupant (Guest 1) and the other guests as "Guest 2..." cards. Edit Guests opens the steppers and
 * one picker per guest; Update saves and Cancel discards. Read-only once the room is checked in,
 * and without permission. Each save sends the version on screen; an unknown outcome keeps the
 * idempotency key for the retry.
 */
export default function GuestsSection({
  detail,
  room,
  canEdit,
  onReloaded,
  onChanged,
  say,
}: GuestsSectionProps) {
  const api = useApi();
  const headingId = useId();
  const access = guestsAccess(detail.status, room, canEdit);
  const party = roomParty(detail, room);
  const saved = draftFromRoom(detail, room);
  const lead = room.leadOccupant ?? detail.leadOccupant;
  const [draft, setDraft] = useState<GuestsDraft | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<{ kind: 'adult' | 'child'; index: number } | null>(null);
  const save = useIdempotentSave();
  const editButton = useRef<HTMLButtonElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const [refocus, setRefocus] = useState(0);

  // Another room, or a room that is no longer editable, closes the editor.
  const roomId = room.id;
  const [forRoom, setForRoom] = useState(roomId);
  if (forRoom !== roomId) {
    setForRoom(roomId);
    setDraft(null);
    setFailure(null);
  }
  if (draft && !access.editable) setDraft(null);

  useEffect(() => {
    if (draft) editHeading.current?.focus();
    // Only when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null]);
  useEffect(() => {
    if (refocus > 0) editButton.current?.focus();
  }, [refocus]);

  const close = () => {
    setDraft(null);
    setFailure(null);
    setRefocus((n) => n + 1);
  };

  const update = () => {
    if (!draft || save.busy) return;
    const sending = confirmationsToSend(draft);
    const body = toUpdateGuestsRequest(draft, detail, room.id, '');
    const fingerprint = JSON.stringify({ ...body, requestId: undefined });
    setFailure(null);
    void save
      .run(fingerprint, (requestId) => api.reservations.updateGuests({ ...body, requestId }))
      .then((result) => {
        if (!result) return;
        if (result.ok) {
          onReloaded(result.value);
          onChanged?.();
          if (save.isMounted()) {
            setDraft(null);
            setRefocus((n) => n + 1);
          }
          say(guestsSuccessMessage(sending));
          return;
        }
        const failed = guestsFailure(result.error);
        if (save.isMounted()) setFailure(failed.message);
        if (!failed.refetch) return;
        api.reservations.getDetail(detail.id).then(
          (fresh) => {
            onReloaded(fresh);
            onChanged?.();
          },
          () => undefined,
        );
      });
  };

  if (!draft) {
    const slots = guestSlots(saved);
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" component="h3" id={headingId}>
            {guestCountText(party.adults, party.children)}
          </Typography>
          {access.editable ? (
            <Button
              ref={editButton}
              size="small"
              startIcon={<Edit />}
              onClick={() => setDraft(saved)}
              aria-describedby={headingId}
            >
              Edit Guests
            </Button>
          ) : null}
        </Box>
        {access.reason ? (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {access.reason}
          </Typography>
        ) : null}
        <Box
          component="ul"
          aria-label="Guests of this room"
          sx={{ m: 0, mt: 1, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <GuestCard
            name={lead.name}
            memberNumber={lead.memberNumber}
            role="Lead occupant (Guest 1)"
          />
          {slots.map((s) =>
            s.guest ? (
              <GuestCard
                key={`${s.kind}-${s.index}`}
                name={s.guest.name}
                memberNumber={s.guest.memberNumber}
                role={`${s.label} (${slotKindText(s.kind)})`}
                email={s.guest.email}
                sent={s.guest.confirmationSent}
              />
            ) : (
              <GuestCard
                key={`${s.kind}-${s.index}`}
                name="TBD"
                role={`${s.label} (${slotKindText(s.kind)})`}
              />
            ),
          )}
        </Box>
      </Box>
    );
  }

  const dirty = isGuestsDirty(saved, draft);
  const room_left = MAX_PARTY - totalGuests(draft);
  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e) => e.preventDefault()}
      aria-labelledby={headingId}
    >
      <Typography
        id={headingId}
        ref={editHeading}
        tabIndex={-1}
        variant="subtitle2"
        component="h3"
        sx={{ outline: 'none' }}
      >
        Edit guests
      </Typography>
      <Box sx={{ display: 'flex', gap: 5, mt: 1.5 }}>
        <CountStepper
          label="Adults"
          value={draft.adults}
          min={MIN_ADULTS}
          max={draft.adults + (canStep(draft, 'adult', 1) ? room_left : 0)}
          onChange={(v) => setDraft(stepCount(draft, 'adult', v > draft.adults ? 1 : -1))}
        />
        <CountStepper
          label="Children"
          value={draft.children}
          min={0}
          max={draft.children + (canStep(draft, 'child', 1) ? room_left : 0)}
          onChange={(v) => setDraft(stepCount(draft, 'child', v > draft.children ? 1 : -1))}
        />
      </Box>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
        A room holds up to {MAX_PARTY} guests. The lead occupant is Guest 1.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        {guestSlots(draft).map((s) => (
          <Box
            key={`${s.kind}-${s.index}`}
            role="group"
            aria-label={`${s.label}, ${slotKindText(s.kind).toLowerCase()}`}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {s.label}
              <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                {' '}
                ({slotKindText(s.kind)})
              </Box>
            </Typography>
            <GuestAutocomplete
              label={s.label}
              value={s.guest ? asMember(s.guest) : null}
              onChange={(m) =>
                setDraft(setSlot(draft, s.kind, s.index, m ? guestFromMember(m) : null))
              }
              onAdd={() => setAddFor({ kind: s.kind, index: s.index })}
              addLabel={`Add ${s.label}`}
            />
            {s.guest?.email ? (
              <FormControlLabel
                sx={{ ml: 0.5 }}
                control={
                  <Switch
                    size="small"
                    checked={s.guest.sendConfirmation}
                    onChange={(_, on) =>
                      setDraft(
                        setSlot(draft, s.kind, s.index, { ...s.guest!, sendConfirmation: on }),
                      )
                    }
                  />
                }
                label={`Send Confirmation to ${s.guest.email}`}
                slotProps={{ typography: { variant: 'body2' } }}
              />
            ) : null}
            {s.guest?.confirmationSent ? (
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                A confirmation was sent before.
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
      {failure ? (
        <Alert severity="error" role="alert" sx={{ mt: 2 }}>
          {failure}
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          onClick={close}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          fullWidth
          onClick={dirty ? update : undefined}
          aria-disabled={!dirty || save.busy || undefined}
          className={!dirty || save.busy ? 'Mui-disabled' : undefined}
          sx={{ '&.Mui-disabled': { pointerEvents: 'auto' } }}
        >
          {save.busy ? 'Saving…' : 'Update'}
        </Button>
      </Box>
      <AddGuestDialog
        open={addFor !== null}
        forLabel={
          addFor
            ? (guestSlots(draft)
                .find((s) => s.kind === addFor.kind && s.index === addFor.index)
                ?.label.toLowerCase() ?? 'guest')
            : 'guest'
        }
        onClose={() => setAddFor(null)}
        onAdded={(member) => {
          if (addFor) setDraft(setSlot(draft, addFor.kind, addFor.index, guestFromMember(member)));
          setAddFor(null);
        }}
      />
    </Box>
  );
}
