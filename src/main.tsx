import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.tsx';
import './index.css';

export const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() ||
  'cmw9085hh004s0hl29d6ts78f';

createRoot(document.getElementById('root')!).render(
  <PrivyProvider
    appId={PRIVY_APP_ID}
    config={{
      loginMethods: ['google'],
      appearance: {
        theme: 'dark',
        accentColor: '#b8ff3c',
      },
    }}
  >
    <App />
  </PrivyProvider>,
);
