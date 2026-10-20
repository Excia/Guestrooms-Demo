import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import DemoDataChip from './components/DemoDataChip';
import { ApiProvider, createApiClientFromEnvironment } from './api';
import { AccessProvider } from './app/AccessProvider';
import { theme } from './theme';

// Dev only; production builds drop the switcher and its chunk.
const DevUserSwitcher = import.meta.env.DEV
  ? lazy(() => import('./components/DevUserSwitcher'))
  : null;

const { client: apiClient, demo, devMock } = createApiClientFromEnvironment();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ApiProvider client={apiClient}>
          <AccessProvider>
            <App />
          </AccessProvider>
          {demo && <DemoDataChip />}
          {DevUserSwitcher && devMock && (
            <Suspense fallback={null}>
              <DevUserSwitcher />
            </Suspense>
          )}
        </ApiProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
