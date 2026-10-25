import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { RegistrationCardModel } from '../../app/registrationCard';

export interface RegistrationCardSheetProps {
  card: RegistrationCardModel;
}

// The Registration Card page as the owner's mockup draws it (header block with the logo, title and
// number, dates, room, guests, notes, custom text, signature lines). It renders the output of
// `buildRegistrationCard`, so only the checked items appear. The sheet is a document: white paper and
// black text (palette.common) whatever the theme, on whatever backdrop the caller gives it. Kept apart
// from the dialog so a new mockup only touches this file.
export default function RegistrationCardSheet({ card }: RegistrationCardSheetProps) {
  const logo = card.header?.logo?.startsWith('data:image/') ? card.header.logo : null;
  const labelled = (label: string, children: ReactNode) => (
    <Box>
      <Typography variant="body2" component="span" sx={{ mr: 0.75 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
  const bold = (text: string) => (
    <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
      {text}
    </Typography>
  );
  const italic = (text: string) => (
    <Typography variant="body2" component="div" sx={{ fontStyle: 'italic' }}>
      {text}
    </Typography>
  );
  // "[Room #] ([Room Type], [Room Rate])": the room is bold, the bracket italic.
  const roomParts = card.room ? card.room.split(/ (?=\()/) : [];

  return (
    <Box
      data-testid="registration-card-sheet"
      sx={(t) => ({
        bgcolor: t.palette.common.white,
        color: t.palette.common.black,
        boxShadow: t.shadows[1],
        px: 4.5,
        py: 5,
        minHeight: t.spacing(100),
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        '& .MuiTypography-root': { color: 'inherit' },
      })}
    >
      {card.header ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
            <Typography variant="caption" component="div" sx={{ lineHeight: 1.5 }}>
              {card.header.lines.map((line) => (
                <Box key={line}>{line}</Box>
              ))}
            </Typography>
            <Box
              sx={(t) => ({
                width: '45%',
                minHeight: t.spacing(9.5),
                maxHeight: t.spacing(12),
                flexShrink: 0,
                bgcolor: logo ? 'transparent' : t.palette.grey[300],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {logo ? (
                <Box
                  component="img"
                  src={logo}
                  alt="Logo"
                  sx={(t) => ({
                    maxWidth: '100%',
                    maxHeight: t.spacing(12),
                    objectFit: 'contain',
                  })}
                />
              ) : (
                <Typography variant="body2">LOGO</Typography>
              )}
            </Box>
          </Box>
          <Box
            component="hr"
            sx={(t) => ({ m: 0, border: 0, borderTop: `1px solid ${t.palette.grey[300]}` })}
          />
        </>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 400 }}>
          Registration Card
        </Typography>
        {card.confirmationNumber ? (
          <Typography variant="h5" component="p" sx={{ fontWeight: 400 }}>
            {card.confirmationNumber}
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: 3,
          rowGap: 2.5,
        }}
      >
        {card.checkIn
          ? labelled(
              'Check In:',
              <>
                {bold(card.checkIn.date)}
                {card.checkIn.flag ? italic(card.checkIn.flag) : null}
              </>,
            )
          : null}
        {card.checkOut
          ? labelled(
              'Check Out:',
              <>
                {bold(card.checkOut.date)}
                {card.checkOut.flag ? italic(card.checkOut.flag) : null}
              </>,
            )
          : null}
        {card.room
          ? labelled(
              'Room:',
              <>
                {bold(roomParts[0])}
                {roomParts[1] ? (
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ fontStyle: 'italic', ml: 0.5 }}
                  >
                    {roomParts[1]}
                  </Typography>
                ) : null}
              </>,
            )
          : null}
        {card.guestCount ? labelled('Guest Count:', bold(card.guestCount)) : null}
        {card.guest
          ? labelled(
              'Guest:',
              <>
                {bold(card.guest[0])}
                {card.guest.slice(1).map((line) => (
                  <Box key={line}>{italic(line)}</Box>
                ))}
              </>,
            )
          : null}
        {card.reservedBy
          ? labelled(
              'Reserved By:',
              <>
                {bold(card.reservedBy[0])}
                {card.reservedBy.slice(1).map((line) => (
                  <Box key={line}>{italic(line)}</Box>
                ))}
              </>,
            )
          : null}
      </Box>

      {card.notes ? labelled('Notes:', bold(card.notes)) : null}
      {card.customText ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {card.customText}
        </Typography>
      ) : null}

      {card.guestSignature || card.staffSignature ? (
        <>
          <Box
            component="hr"
            sx={(t) => ({ m: 0, border: 0, borderTop: `1px solid ${t.palette.grey[300]}` })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            {[
              card.guestSignature ? 'Guest Signature' : null,
              card.staffSignature ? 'Staff Signature' : null,
            ].map((label) =>
              label ? (
                <Box key={label} sx={{ flex: 1 }}>
                  <Box
                    sx={(t) => ({
                      height: t.spacing(5.5),
                      bgcolor: t.palette.grey[50],
                      borderBottom: `1px solid ${t.palette.common.black}`,
                    })}
                  />
                  <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                    {label}
                  </Typography>
                </Box>
              ) : null,
            )}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
