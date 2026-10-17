import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { routes, SCHEDULE_PATH } from './app/routes';
import AppShell from './AppShell';

function PagePlaceholder() {
  const { pathname } = useLocation();
  const title = routes.find((r) => r.path === pathname)?.title ?? 'Not found';
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
        <Route path="*" element={<PagePlaceholder />} />
      </Routes>
    </AppShell>
  );
}
