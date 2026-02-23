import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'

// ── DEBUG: catch page unloads to find reload cause ──
window.addEventListener('beforeunload', () => {
  console.error('[PAGE] beforeunload fired — page is about to reload!', new Error().stack);
});
window.addEventListener('unload', () => {
  console.error('[PAGE] unload fired');
});
window.addEventListener('error', (e) => {
  console.error('[PAGE] Uncaught error:', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[PAGE] Unhandled promise rejection:', e.reason);
});
// Log navigation changes
const _origPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  console.log('[PAGE] pushState:', args[2]);
  return _origPushState(...args);
};
const _origReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
  console.log('[PAGE] replaceState:', args[2]);
  return _origReplaceState(...args);
};
window.addEventListener('popstate', () => {
  console.log('[PAGE] popstate:', window.location.href);
});
// Intercept location.href setter
const _origLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
if (_origLocationDescriptor) {
  console.log('[PAGE] location descriptor exists, monitoring via Proxy not possible — will catch via beforeunload');
}
console.log('[PAGE] Debug listeners installed, page loaded at', new Date().toISOString());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          color: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '9999px',
          padding: '14px 24px',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.4)',
          fontSize: '14px',
          fontWeight: 500,
        },
      }}
    />
  </StrictMode>,
)
