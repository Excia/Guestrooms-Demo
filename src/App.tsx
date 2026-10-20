import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { DASHBOARD_PATH, routes, SCHEDULE_PATH } from './app/routes';
import AppShell from './AppShell';
import AccessDeniedNotice from './components/AccessDeniedNotice';
import RequireAccess from './components/RequireAccess';

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

// Built pages, keyed by route path; anything missing shows a placeholder.
const pages: Partial<Record<string, ReactElement>> = {};

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
        {routes.map((r) => {
          const page = pages[r.path] ?? <PagePlaceholder title={r.title} />;
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
      <AccessDeniedNotice />
    </AppShell>
  );
}
