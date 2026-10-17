import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { ApiProvider, createApiClientFromEnvironment } from './api';
import { theme } from './theme';

const apiClient = createApiClientFromEnvironment();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ApiProvider client={apiClient}>
          <App />
        </ApiProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
