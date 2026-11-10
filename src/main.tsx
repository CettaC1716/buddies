import { createRoot } from 'react-dom/client';
import { SafePrivyProvider } from './lib/privyAuthBridge';
import App from './App.tsx';
import './index.css';

export const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() || '';

createRoot(document.getElementById('root')!).render(
  <SafePrivyProvider appId={PRIVY_APP_ID}>
    <App />
  </SafePrivyProvider>,
);
