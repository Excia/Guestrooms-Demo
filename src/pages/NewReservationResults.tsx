import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'react-router';
import { PLACEHOLDER_LOCATIONS } from '../app/placeholderLocations';
import { ALL_LOCATIONS_VALUE, fromSearchParams } from '../app/reservationSearch';

// `location` comes from the URL unvalidated: the real results page must check it against the known list.
function locationName(id: string): string {
  if (id === ALL_LOCATIONS_VALUE) return 'All Locations';
  return PLACEHOLDER_LOCATIONS.find((l) => l.id === id)?.name ?? id;
}

/**
 * Stub for the search results (ticket 1.4): the results screens are not designed for the admin
 * app yet, so this only echoes the criteria parsed from the URL.
 */
export default function NewReservationResults() {
  const [params] = useSearchParams();
  const c = fromSearchParams(params);
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Search Results
      </Typography>
      <Typography sx={{ color: 'text.secondary' }} gutterBottom>
        Results arrive in a later ticket. Criteria from the URL:
      </Typography>
      <dl>
        <dt>Check In</dt>
        <dd>{c.checkIn || 'Not set'}</dd>
        <dt>Check Out</dt>
        <dd>{c.checkOut || 'Not set'}</dd>
        <dt>Location</dt>
        <dd>{locationName(c.location)}</dd>
        {c.rooms.map((r, i) => (
          <div key={i}>
            <dt>Room {i + 1}</dt>
            <dd>
              {r.adults} adults, {r.children} children
            </dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}
