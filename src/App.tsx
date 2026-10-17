import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Navigate, Route, Routes } from 'react-router';
import { findRoute, routes, SCHEDULE_PATH } from './app/routes';
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

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to={SCHEDULE_PATH} replace />} />
        {routes.map((r) => (
          <Route
            key={r.path}
            path={r.path}
            element={<PagePlaceholder title={findRoute(r.path)!.title} />}
          />
        ))}
        {/* A real 404 page is a later ticket. */}
        <Route path="*" element={<PagePlaceholder title="Not found" />} />
      </Routes>
    </AppShell>
  );
}
