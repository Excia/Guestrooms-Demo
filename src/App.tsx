import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { DASHBOARD_PATH, routes, SCHEDULE_PATH } from './app/routes';
import AppShell from './AppShell';
import Dashboard from './pages/Dashboard';

// Dev-only gallery of the shared components (0.9). Behind import.meta.env.DEV and lazy-loaded, so
// production builds drop the page and its route entirely (it answers with the 404 page there).
export const COMPONENTS_DEMO_PATH = '/dev/components';
const ComponentsDemo = import.meta.env.DEV ? lazy(() => import('./pages/ComponentsDemo')) : null;

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

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<RedirectToSchedule />} />
        <Route path={DASHBOARD_PATH} element={<Dashboard />} />
        {routes
          .filter((r) => r.path !== DASHBOARD_PATH)
          .map((r) => (
            <Route key={r.path} path={r.path} element={<PagePlaceholder title={r.title} />} />
          ))}
        {/* Deliberately not in the route table or the menu. */}
        {ComponentsDemo ? (
          <Route
            path={COMPONENTS_DEMO_PATH}
            element={
              <Suspense fallback={null}>
                <ComponentsDemo />
              </Suspense>
            }
          />
        ) : null}
        {/* A real 404 page is a later ticket. */}
        <Route path="*" element={<PagePlaceholder title="Not found" />} />
      </Routes>
    </AppShell>
  );
}
