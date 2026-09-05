import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { SettingsProvider } from './state/settings';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SettingsProvider>
  </StrictMode>,
);

// Fade out the splash once React has painted something.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('fz-boot');
    boot?.classList.add('fz-boot-done');
    setTimeout(() => boot?.remove(), 600);
  });
});
