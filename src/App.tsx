import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { routes, SCHEDULE_PATH } from './app/routes';
import AppShell from './AppShell';

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
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={<PagePlaceholder title={r.title} />} />
        ))}
        {/* A real 404 page is a later ticket. */}
        <Route path="*" element={<PagePlaceholder title="Not found" />} />
      </Routes>
    </AppShell>
  );
}
