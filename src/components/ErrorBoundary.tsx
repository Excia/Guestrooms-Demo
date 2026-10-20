import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Message shown instead of the page. */
  message?: string;
  /** What the Reload button does; defaults to reloading the browser page (loads fresh chunks). */
  onReload?: () => void;
}

interface State {
  failed: boolean;
}

/**
 * Keeps a failing page (typically a lazy chunk that did not load: a stale tab after a deploy, or
 * offline) from blanking the whole app. Shows a message with a Reload button and logs the error.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Page failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { message = 'This page could not be loaded.', onReload } = this.props;
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={onReload ?? (() => window.location.reload())}
            >
              Reload
            </Button>
          }
        >
          {message}
        </Alert>
      </Box>
    );
  }
}
