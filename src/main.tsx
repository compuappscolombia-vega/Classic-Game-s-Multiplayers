import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const EXTENSION_PREFIXES = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

function isExtensionNoise(message?: string, stack?: string, filename?: string): boolean {
  const hay = `${message ?? ''}\n${stack ?? ''}\n${filename ?? ''}`;
  if (EXTENSION_PREFIXES.some((prefix) => hay.includes(prefix))) {
    return true;
  }
  return message?.includes('Failed to connect to MetaMask') ?? false;
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const stack = event.error instanceof Error ? event.error.stack : undefined;
      if (isExtensionNoise(event.message, stack, event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason;
      const message =
        typeof reason === 'string'
          ? reason
          : reason instanceof Error
            ? reason.message
            : typeof reason === 'object' && reason !== null && 'message' in reason
              ? String((reason as { message?: unknown }).message ?? '')
              : '';
      const stack = reason instanceof Error ? reason.stack : undefined;
      if (isExtensionNoise(message, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
