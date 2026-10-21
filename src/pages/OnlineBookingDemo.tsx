import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { addDays, todayIso } from '../app/dateSelection';
import type { BookingAudience, BookingTenant } from '../app/onlineBookingNav';
import AdjustSearch from '../components/onlineBooking/AdjustSearch';
import OnlineBookingHeader from '../components/onlineBooking/OnlineBookingHeader';
import ReservationWidget from '../components/onlineBooking/ReservationWidget';

// Dev-only mock of online booking (ticket 5.2 and later): the club's site with the widget embedded,
// and the Guest Rooms results page with the header and Adjust Search. Everything is fake data; the
// widget's real Search opens the results route in a new tab, here it is only logged.
// The online booking routes do not exist yet, so every link comes back to this page.
const DEMO_PATH = '/dev/online-booking';

const TENANT: BookingTenant = {
  clubName: 'Pine Ridge Club',
  axisUrl: 'https://axis.example.com',
  memberAccountUrl: 'https://axis.example.com/account',
  nonMemberAccountUrl: 'https://core.example.com/account',
  memberPaymentsUrl: 'https://paycloud.example.com/methods',
  nonMemberPaymentsUrl: 'https://core.example.com/payments',
};

const LOCATIONS = [
  { id: 'a', name: 'Location A' },
  { id: 'b', name: 'Location B' },
];

type Who = 'out' | BookingAudience;

export default function OnlineBookingDemo() {
  const [who, setWho] = useState<Who>('out');
  const [log, setLog] = useState('Nothing searched yet.');
  const audience = who === 'out' ? null : who;

  return (
    <Container sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" component="h1">
          Online booking mock
        </Typography>
        <Typography color="text.secondary">
          Dev only. The widget as the club&apos;s site would embed it, then the Guest Rooms page it
          opens.
        </Typography>
      </Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={who}
        onChange={(_, v: Who | null) => v && setWho(v)}
        aria-label="Signed-in user"
      >
        <ToggleButton value="out">Signed out</ToggleButton>
        <ToggleButton value="nonMember">Non-member</ToggleButton>
        <ToggleButton value="member">Member</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="h6" component="h2">
        1. On the club&apos;s site (widget)
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 280px', minHeight: 200, color: 'text.secondary' }}>
          <Typography variant="subtitle1">Pine Ridge Club</Typography>
          <Typography variant="body2">
            Stand-in for the club&apos;s own web page. The widget sits in a column beside it.
          </Typography>
        </Box>
        <Paper sx={{ width: 335, p: 2 }}>
          <ReservationWidget
            locations={LOCATIONS}
            globalMessage="Call the club for groups of more than 3 rooms."
            onSearch={(c) => setLog(`Search: ${JSON.stringify(c)}`)}
          />
        </Paper>
      </Paper>
      <Typography variant="caption" color="text.secondary" component="p">
        {log}
      </Typography>

      <Typography variant="h6" component="h2">
        2. Guest Rooms results page (header and Adjust Search)
      </Typography>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <OnlineBookingHeader
          tenant={TENANT}
          audience={audience}
          trail={[{ label: 'Make a Reservation', to: DEMO_PATH }]}
          currentPage="Results"
          homePath={DEMO_PATH}
          myReservationsPath={DEMO_PATH}
          onSignIn={() => setWho('nonMember')}
          onSignOut={() => setWho('out')}
        />

        <Box sx={{ p: 2, maxWidth: 380 }}>
          <AdjustSearch
            criteria={{
              checkIn: addDays(todayIso(), 1),
              checkOut: addDays(todayIso(), 3),
              location: 'a',
              rooms: [{ adults: 2, children: 0 }],
            }}
            locations={LOCATIONS}
            onSearch={(c) => setLog(`Update: ${JSON.stringify(c)}`)}
          />
        </Box>
      </Paper>
    </Container>
  );
}
