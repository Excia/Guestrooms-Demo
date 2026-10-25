import { useClubLocations } from '../app/useClubLocations';
import NewReservationSearch from './NewReservationSearch';

/** The dashboard's New Reservation search, offering the locations saved on the Locations page. */
export default function ClubNewReservationSearch() {
  return <NewReservationSearch locations={useClubLocations() ?? []} />;
}
