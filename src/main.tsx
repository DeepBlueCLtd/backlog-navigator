import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { startServiceWorker } from './pwa/registerSW';
import { PWAUpdateProvider } from './pwa/UpdatePrompt';
import type { ServiceWorkerUpdateState } from './types';
import './styles/app.css';
import './styles/mobile.css';

function Root(): JSX.Element {
  const [swState, setSwState] = useState<ServiceWorkerUpdateState>({ kind: 'up-to-date' });
  useEffect(() => {
    startServiceWorker((next) => setSwState(next));
  }, []);
  return (
    <PWAUpdateProvider state={swState}>
      <App />
    </PWAUpdateProvider>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('root element not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
