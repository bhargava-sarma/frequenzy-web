import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/doto/wght.css';
import './styles/index.css';

// Settings apply themselves to the document on import, before the first paint.
import './state/settings';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Fade the boot screen once React has painted something.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('fz-boot');
    boot?.classList.add('fz-boot-done');
    setTimeout(() => boot?.remove(), 400);
  });
});
