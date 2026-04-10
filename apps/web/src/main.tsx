import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import './index.css';

// Hide the boot-loading spinner once JS modules finish loading
const bootMsg = document.getElementById('boot-msg');
if (bootMsg) bootMsg.classList.add('hidden');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (err) {
  // Surface any synchronous render bootstrap errors (won't be caught by ErrorBoundary)
  const bootErr = document.getElementById('boot-err');
  if (bootErr) {
    bootErr.style.display = 'block';
    bootErr.textContent =
      'React bootstrap error\n\n' +
      (err instanceof Error ? err.stack ?? err.message : String(err));
  }
}
