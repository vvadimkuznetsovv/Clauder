import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';

interface ChatPanelProps {
  sessionId: string | null;
}

type Status = 'checking' | 'ok' | 'unavailable';

// ── Singleton iframe: created once, NEVER removed from DOM ──
// Survives any React remount (layout changes, tab switches, panel toggles).
// Uses position:fixed and syncs position to the ChatPanel container via ResizeObserver.

let iframeWrapper: HTMLDivElement | null = null;
let iframeEl: HTMLIFrameElement | null = null;
function ensureIframe(token: string): void {
  if (iframeWrapper) return; // already created
  console.log('[ChatPanel] Creating singleton iframe');

  iframeWrapper = document.createElement('div');
  iframeWrapper.style.cssText =
    'position:fixed;z-index:15;display:none;overflow:hidden;pointer-events:none;';
  document.body.appendChild(iframeWrapper);

  iframeEl = document.createElement('iframe');
  iframeEl.src = `/code/?token=${token}`;
  iframeEl.title = 'VS Code';
  iframeEl.allow = 'clipboard-read; clipboard-write';
  iframeEl.style.cssText =
    'width:100%;height:100%;border:0;background:#1e1e1e;pointer-events:auto;';
  iframeWrapper.appendChild(iframeEl);
}

function showIframe(rect: DOMRect): void {
  if (!iframeWrapper) return;
  if (rect.width <= 0 || rect.height <= 0) {
    iframeWrapper.style.display = 'none';
    return;
  }
  iframeWrapper.style.display = 'block';
  iframeWrapper.style.top = `${rect.top}px`;
  iframeWrapper.style.left = `${rect.left}px`;
  iframeWrapper.style.width = `${rect.width}px`;
  iframeWrapper.style.height = `${rect.height}px`;
}

function hideIframe(): void {
  if (iframeWrapper) iframeWrapper.style.display = 'none';
}

function isIframeCreated(): boolean {
  return !!iframeWrapper;
}

export default function ChatPanel(_props: ChatPanelProps) {
  const token = useAuthStore((s) => s.accessToken);
  const containerRef = useRef<HTMLDivElement>(null);

  // Probe result tracks which token was probed — auto-resets on token change
  const [probe, setProbe] = useState<{ token: string; result: 'ok' | 'failed' } | null>(
    isIframeCreated() ? { token: '', result: 'ok' } : null,
  );

  // Derive status: no refs, no setState during render
  const status: Status =
    isIframeCreated() ? 'ok' :
    !token ? 'unavailable' :
    (probe?.token === token && probe.result === 'ok') ? 'ok' :
    (probe?.token === token && probe.result === 'failed') ? 'unavailable' :
    'checking';

  // Probe code-server (fires when status is 'checking')
  useEffect(() => {
    if (status !== 'checking' || !token || isIframeCreated()) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    console.log('[ChatPanel] Probing /code/ ...');
    fetch(`/code/?token=${token}`, { method: 'HEAD', signal: controller.signal })
      .then(res => {
        console.log('[ChatPanel] Probe response:', res.status, res.ok);
        if (res.ok) {
          ensureIframe(token);
          setProbe({ token, result: 'ok' });
        } else {
          setProbe({ token, result: 'failed' });
        }
      })
      .catch((err) => { console.warn('[ChatPanel] Probe failed:', err); setProbe({ token, result: 'failed' }); })
      .finally(() => clearTimeout(timer));

    return () => { controller.abort(); clearTimeout(timer); };
  }, [status, token]);

  // Sync iframe position to our container
  const syncPosition = useCallback(() => {
    if (containerRef.current) {
      showIframe(containerRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (status !== 'ok' || !containerRef.current) return;

    // Initial sync
    syncPosition();

    // ResizeObserver: fires when container size changes (tab switch, panel resize, etc.)
    const ro = new ResizeObserver(syncPosition);
    ro.observe(containerRef.current);

    // Also sync on scroll/resize (catches position changes without size change)
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
      hideIframe();
    };
  }, [status, syncPosition]);

  if (status === 'checking') {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Подключение...</div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(248,113,113,0.12)',
            border: '1px solid rgba(248,113,113,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>
            Claude Code не запущен
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
            Запустите сервис через Docker Compose
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setProbe(null); }}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid var(--glass-border)',
            background: 'rgba(127,0,255,0.1)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  // Placeholder div — iframe is positioned over it via position:fixed
  return <div ref={containerRef} className="h-full" style={{ touchAction: 'manipulation' }} />;
}
