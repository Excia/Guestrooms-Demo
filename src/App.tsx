import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { lazy, type ReactElement, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import {
  DASHBOARD_PATH,
  NEW_RESERVATION_RESULTS_PATH,
  BOOKING_RULES_PATH,
  RESERVATION_HUB_PATH,
  RESERVATIONS_PATH,
  PRIMARY_SETUP_PATH,
  ADD_ON_ITEMS_PATH,
  RATE_CATEGORIES_PATH,
  ROOM_OPTIONS_PATH,
  KEYCARD_INTEGRATION_PATH,
  LOCATIONS_PATH,
  PERMISSIONS_PATH,
  ROOM_TYPES_PATH,
  ROOMS_PATH,
  FOLIO_PATH,
  routes,
  SCHEDULE_PATH,
} from './app/routes';
import { REPORTING_PATH } from './app/reports';
import AppShell from './AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import AccessDeniedNotice from './components/AccessDeniedNotice';
import RequireAccess from './components/RequireAccess';
import Dashboard from './pages/Dashboard';
import RoomTypes from './pages/RoomTypes';
import Rooms from './pages/Rooms';
import BookingRules from './pages/BookingRules';
import Locations from './pages/Locations';
import Permissions from './pages/Permissions';
import AddOnItems from './pages/AddOnItems';
import RateCategories from './pages/RateCategories';
import RoomOptions from './pages/RoomOptions';
import KeycardIntegration from './pages/KeycardIntegration';
import SystemSettings from './pages/SystemSettings';
import Reporting from './pages/Reporting';
import NewReservationResults from './pages/NewReservationResults';
import ReservationList from './pages/ReservationList';
import ScheduleSkeleton from './components/schedule/ScheduleSkeleton';

// Dev-only gallery of the shared components (0.9). Behind import.meta.env.DEV and lazy-loaded, so
// production builds drop the page and its route entirely (it answers with the 404 page there).
export const COMPONENTS_DEMO_PATH = '/dev/components';
// The schedule (grid, drag and drop, dialogs) is the largest page: its code loads on demand.
const Schedule = lazy(() => import('./pages/Schedule'));
const Folio = lazy(() => import('./pages/Folio'));
const ComponentsDemo = import.meta.env.DEV ? lazy(() => import('./pages/ComponentsDemo')) : null;
// Dev-only mock of the embedded widget and the online booking pages (ticket 5.2).
export const ONLINE_BOOKING_DEMO_PATH = '/dev/online-booking';
const OnlineBookingDemo = import.meta.env.DEV
  ? lazy(() => import('./pages/OnlineBookingDemo'))
  : null;

function PagePlaceholder({ title }: { title: string }) {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
    </Container>
  );
}

/** Keeps the query string, so dev switches like ?mock=empty survive the redirect. */
function RedirectToSchedule() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: SCHEDULE_PATH, search }} replace />;
}

// Real pages by route path; routes without an entry show the placeholder. Page tickets add theirs here.
const pages: Partial<Record<string, ReactElement>> = {
  [DASHBOARD_PATH]: <Dashboard />,
  [PRIMARY_SETUP_PATH]: <SystemSettings />,
  [BOOKING_RULES_PATH]: <BookingRules />,
  [REPORTING_PATH]: <Reporting />,
  [ROOM_TYPES_PATH]: <RoomTypes />,
  [ROOMS_PATH]: <Rooms />,
  [ADD_ON_ITEMS_PATH]: <AddOnItems />,
  [RATE_CATEGORIES_PATH]: <RateCategories />,
  [ROOM_OPTIONS_PATH]: <RoomOptions />,
  [KEYCARD_INTEGRATION_PATH]: <KeycardIntegration />,
  [LOCATIONS_PATH]: <Locations />,
  [PERMISSIONS_PATH]: <Permissions />,
  [FOLIO_PATH]: (
    <Suspense fallback={null}>
      <Folio />
    </Suspense>
  ),
  [NEW_RESERVATION_RESULTS_PATH]: <NewReservationResults />,
  [RESERVATIONS_PATH]: <ReservationList />,
  [SCHEDULE_PATH]: (
    <Suspense fallback={<ScheduleSkeleton />}>
      <Schedule />
    </Suspense>
  ),
};

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<RedirectToSchedule />} />
        {routes.map((r) => {
          // A page that fails (e.g. its lazy chunk does not load) must not blank the whole app.
          const page = (
            <ErrorBoundary>{pages[r.path] ?? <PagePlaceholder title={r.title} />}</ErrorBoundary>
          );
          return (
            <Route
              key={r.path}
              path={r.path}
              element={
                r.path === DASHBOARD_PATH ? (
                  page
                ) : (
                  <RequireAccess pageId={r.id}>{page}</RequireAccess>
                )
              }
            />
          );
        })}
        {/* The Reservation Hub (ticket 3.3) is not a menu link; until it exists the row click lands on a placeholder. */}
        <Route
          path={RESERVATION_HUB_PATH}
          element={
            <RequireAccess pageId="reservations">
              <ErrorBoundary>
                <PagePlaceholder title="Reservation Hub" />
              </ErrorBoundary>
            </RequireAccess>
          }
        />
        {/* Deliberately not in the route table or the menu. */}
        {ComponentsDemo ? (
          <Route
            path={COMPONENTS_DEMO_PATH}
            element={
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <ComponentsDemo />
                </Suspense>
              </ErrorBoundary>
            }
          />
        ) : null}
        {OnlineBookingDemo ? (
          <Route
            path={ONLINE_BOOKING_DEMO_PATH}
            element={
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <OnlineBookingDemo />
                </Suspense>
              </ErrorBoundary>
            }
          />
        ) : null}
        {/* A real 404 page is a later ticket. */}
        <Route path="*" element={<PagePlaceholder title="Not found" />} />
      </Routes>
      <AccessDeniedNotice />
    </AppShell>
  );
}
