import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import ContextMenu, { type ContextMenuItem } from '../files/ContextMenu';
import toast from 'react-hot-toast';

// ── Font size persistence ──

const FONT_SIZE_KEY = 'clauder-terminal-font-size';
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;

function getSavedFontSize(): number {
  const saved = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '', 10);
  return saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE ? saved : DEFAULT_FONT_SIZE;
}

// ── Singleton: xterm lives forever, WebSocket is transient ──

interface TermSession {
  xterm: XTerm;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  container: HTMLDivElement | null;
}

let session: TermSession | null = null;
let currentWs: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
const RECONNECT_DELAY = 800;

/** Notify React component to re-render (e.g. after reconnect status change) */
let notifyRerender: (() => void) | null = null;

function createXterm(): TermSession {
  const fontSize = getSavedFontSize();

  const xterm = new XTerm({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontSize,
    scrollback: 5000,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
    theme: {
      background: '#0a0a1a',
      foreground: 'rgba(255, 255, 255, 0.9)',
      cursor: '#6eb4ff',
      cursorAccent: '#0a0a1a',
      selectionBackground: 'rgba(110, 180, 255, 0.25)',
      selectionForeground: '#ffffff',
      black: '#484f58',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#6eb4ff',
      magenta: '#a78bfa',
      cyan: '#22d3ee',
      white: '#e2e8f0',
      brightBlack: '#6e7681',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde68a',
      brightBlue: '#93c5fd',
      brightMagenta: '#c4b5fd',
      brightCyan: '#67e8f9',
      brightWhite: '#f8fafc',
    },
  });

  const fitAddon = new FitAddon();
  xterm.loadAddon(fitAddon);
  xterm.loadAddon(new WebLinksAddon());

  const searchAddon = new SearchAddon();
  xterm.loadAddon(searchAddon);

  // Single onData listener — reads currentWs by closure reference
  xterm.onData((data) => {
    if (currentWs?.readyState === WebSocket.OPEN) {
      currentWs.send(new TextEncoder().encode(data));
    }
  });

  return { xterm, fitAddon, searchAddon, container: null };
}

function connectWs(): WebSocket {
  const token = localStorage.getItem('access_token');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal?token=${token}`);
  ws.binaryType = 'arraybuffer';
  currentWs = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    if (!session) return;
    try {
      session.fitAddon.fit();
      const dims = session.fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: 'resize', rows: dims.rows, cols: dims.cols }));
      }
    } catch { /* xterm may not be attached yet */ }
  };

  ws.onmessage = (event) => {
    if (!session) return;
    if (event.data instanceof ArrayBuffer) {
      session.xterm.write(new Uint8Array(event.data));
    } else {
      session.xterm.write(event.data);
    }
  };

  ws.onerror = () => {
    session?.xterm.write('\r\n\x1b[38;2;248;113;113m[Connection error]\x1b[0m\r\n');
  };

  ws.onclose = () => {
    if (currentWs === ws) currentWs = null;
    if (!session) return;

    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      session.xterm.write('\r\n\x1b[38;2;251;191;36m[Shell exited \u2014 reconnecting...]\x1b[0m\r\n');
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectWs();
      }, RECONNECT_DELAY);
    } else {
      session.xterm.write('\r\n\x1b[38;2;248;113;113m[Disconnected]\x1b[0m\r\n');
      session.xterm.write('\x1b[38;2;110;180;255m[Right-click \u2192 Reconnect]\x1b[0m\r\n');
      // Do NOT reset reconnectAttempts — only forceReconnect() resets
    }
    notifyRerender?.();
  };

  return ws;
}

function forceReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentWs) {
    currentWs.close();
    currentWs = null;
  }
  reconnectAttempts = 0;
  session?.xterm.write('\r\n\x1b[38;2;110;180;255m[Reconnecting...]\x1b[0m\r\n');
  connectWs();
}

function getOrCreateSession(): TermSession {
  if (!session) {
    session = createXterm();
  }
  // Only auto-connect if we haven't exhausted reconnect attempts
  if (reconnectAttempts < MAX_RECONNECT && (!currentWs || currentWs.readyState > WebSocket.OPEN)) {
    connectWs();
  }
  return session;
}

// ── React component ──

interface TerminalProps {
  active?: boolean;
}

// Feather-style SVG icons (14x14)
const TERM_ICONS = {
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  clipboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  selectAll: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  zoomIn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  zoomOut: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  eraser: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16a1 1 0 0 1 0-1.4l9.6-9.6a2 2 0 0 1 2.8 0l5.2 5.2a2 2 0 0 1 0 2.8L15 18.6" /><path d="M6.5 13.5L12 8" />
    </svg>
  ),
};

export default function TerminalComponent({ active }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setTick] = useState(0);

  // Register re-render notifier for reconnect status updates
  useEffect(() => {
    notifyRerender = () => setTick((t) => t + 1);
    return () => { notifyRerender = null; };
  }, []);

  // Touch handling: scroll by swiping + long-press context menu
  // xterm.js canvas doesn't support native touch scroll, so we translate
  // touch moves into xterm.scrollLines() calls manually.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number>(0);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchLastY = useRef(0);
  const scrolling = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const LONG_PRESS_MS = 500;
    const MOVE_THRESHOLD = 10; // px before we consider it a scroll
    const LINE_HEIGHT = session?.xterm.options.fontSize
      ? Math.ceil(session.xterm.options.fontSize * 1.2)
      : 16;

    let accumulatedDelta = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      touchLastY.current = t.clientY;
      scrolling.current = false;
      accumulatedDelta = 0;

      // Start long-press timer
      longPressTimer.current = window.setTimeout(() => {
        if (!scrolling.current) {
          setCtxMenu({ x: touchStartPos.current.x, y: touchStartPos.current.y });
        }
        longPressTimer.current = 0;
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      // Check if we've moved enough to count as scroll
      if (!scrolling.current) {
        const dx = t.clientX - touchStartPos.current.x;
        const dy = t.clientY - touchStartPos.current.y;
        if (Math.abs(dy) > MOVE_THRESHOLD || Math.abs(dx) > MOVE_THRESHOLD) {
          scrolling.current = true;
          // Cancel long-press — user is scrolling
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = 0;
          }
        }
      }

      if (scrolling.current && session) {
        const deltaY = touchLastY.current - t.clientY; // positive = scroll down
        touchLastY.current = t.clientY;
        accumulatedDelta += deltaY;

        // Convert pixel delta to lines
        const lines = Math.trunc(accumulatedDelta / LINE_HEIGHT);
        if (lines !== 0) {
          session.xterm.scrollLines(lines);
          accumulatedDelta -= lines * LINE_HEIGHT;
        }
      }
    };

    const onTouchEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = 0;
      }
      scrolling.current = false;
      accumulatedDelta = 0;
    };

    // passive: true — we never call preventDefault, browser can handle its own stuff
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      clearTimeout(longPressTimer.current);
    };
  }, []);

  const fit = useCallback(() => {
    if (!session) return;
    try {
      session.fitAddon.fit();
      const dims = session.fitAddon.proposeDimensions();
      if (dims && currentWs?.readyState === WebSocket.OPEN) {
        currentWs.send(JSON.stringify({ type: 'resize', rows: dims.rows, cols: dims.cols }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const el = termRef.current;
    if (!el) return;

    const s = getOrCreateSession();

    // Attach xterm to this DOM element (re-open if container changed)
    if (s.container !== el) {
      if (s.container) {
        const xtermEl = s.xterm.element?.parentElement;
        if (xtermEl) {
          el.appendChild(xtermEl);
        }
      } else {
        s.xterm.open(el);
      }
      s.container = el;
    }

    setTimeout(fit, 50);

    const resizeObserver = new ResizeObserver(() => fit());
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [fit]);

  useEffect(() => {
    if (active) setTimeout(fit, 50);
  }, [active, fit]);

  // ── Context menu ──

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCtxAction = useCallback((action: string) => {
    setCtxMenu(null);
    if (!session) return;

    switch (action) {
      case 'copy': {
        const sel = session.xterm.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel)
            .then(() => toast.success('Copied'))
            .catch(() => toast.error('Failed to copy'));
        }
        break;
      }
      case 'paste':
        navigator.clipboard.readText()
          .then((text) => {
            if (text && currentWs?.readyState === WebSocket.OPEN) {
              currentWs.send(new TextEncoder().encode(text));
            }
          })
          .catch(() => toast.error('Failed to paste'));
        break;
      case 'select-all':
        session.xterm.selectAll();
        break;
      case 'find':
        setSearchVisible(true);
        break;
      case 'font-increase': {
        const cur = session.xterm.options.fontSize || DEFAULT_FONT_SIZE;
        const next = Math.min(cur + 1, MAX_FONT_SIZE);
        session.xterm.options.fontSize = next;
        localStorage.setItem(FONT_SIZE_KEY, String(next));
        fit();
        break;
      }
      case 'font-decrease': {
        const cur = session.xterm.options.fontSize || DEFAULT_FONT_SIZE;
        const next = Math.max(cur - 1, MIN_FONT_SIZE);
        session.xterm.options.fontSize = next;
        localStorage.setItem(FONT_SIZE_KEY, String(next));
        fit();
        break;
      }
      case 'clear':
        if (currentWs?.readyState === WebSocket.OPEN) {
          currentWs.send(new TextEncoder().encode('\x0c'));
        }
        break;
      case 'clear-all':
        session.xterm.clear();
        if (currentWs?.readyState === WebSocket.OPEN) {
          currentWs.send(new TextEncoder().encode('\x0c'));
        }
        break;
      case 'reconnect':
        forceReconnect();
        break;
    }
  }, [fit]);

  // ── Search ──

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val) session?.searchAddon.findNext(val);
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) session?.searchAddon.findPrevious(searchTerm);
      else session?.searchAddon.findNext(searchTerm);
    }
    if (e.key === 'Escape') {
      setSearchVisible(false);
      setSearchTerm('');
      session?.searchAddon.clearDecorations();
    }
  }, [searchTerm]);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchTerm('');
    session?.searchAddon.clearDecorations();
  }, []);

  // ── Build menu items ──

  const hasSelection = session?.xterm.hasSelection() ?? false;
  const isConnected = currentWs?.readyState === WebSocket.OPEN;

  const ctxMenuItems: ContextMenuItem[] = [
    { label: 'Copy', action: 'copy', icon: TERM_ICONS.copy, disabled: !hasSelection },
    { label: 'Paste', action: 'paste', icon: TERM_ICONS.clipboard },
    { type: 'separator' },
    { label: 'Select All', action: 'select-all', icon: TERM_ICONS.selectAll },
    { label: 'Find...', action: 'find', icon: TERM_ICONS.search },
    { type: 'separator' },
    { label: 'Font +', action: 'font-increase', icon: TERM_ICONS.zoomIn },
    { label: 'Font \u2013', action: 'font-decrease', icon: TERM_ICONS.zoomOut },
    { type: 'separator' },
    { label: 'Clear', action: 'clear', icon: TERM_ICONS.trash },
    { label: 'Clear Console', action: 'clear-all', icon: TERM_ICONS.eraser, danger: true },
    { label: 'Reconnect', action: 'reconnect', icon: TERM_ICONS.refresh, disabled: isConnected },
  ];

  return (
    <div
      ref={wrapperRef}
      className="h-full relative"
      style={{ background: '#0a0a1a' }}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={termRef}
        className="h-full"
      />

      {/* Search bar */}
      {searchVisible && (
        <div className="terminal-search-bar">
          <input
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find..."
            autoFocus
          />
          <button
            type="button"
            title="Previous (Shift+Enter)"
            onClick={() => session?.searchAddon.findPrevious(searchTerm)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            type="button"
            title="Next (Enter)"
            onClick={() => session?.searchAddon.findNext(searchTerm)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button type="button" title="Close (Escape)" onClick={closeSearch}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenuItems}
          onAction={handleCtxAction}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
