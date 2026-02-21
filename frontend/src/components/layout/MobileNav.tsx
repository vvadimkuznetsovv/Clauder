interface MobileNavProps {
  activePanel: 'chat' | 'files' | 'editor' | 'terminal';
  onPanelChange: (panel: 'chat' | 'files' | 'editor' | 'terminal') => void;
  onMenuToggle: () => void;
}

const panels = [
  { id: 'chat' as const, label: 'Chat', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )},
  { id: 'files' as const, label: 'Files', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )},
  { id: 'editor' as const, label: 'Editor', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )},
  { id: 'terminal' as const, label: 'Term', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )},
];

export default function MobileNav({ activePanel, onPanelChange, onMenuToggle }: MobileNavProps) {
  return (
    <nav
      className="flex items-center lg:hidden relative z-20"
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        backdropFilter: 'blur(40px) saturate(180%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <button
        type="button"
        onClick={onMenuToggle}
        className="px-4 py-3"
        title="Menu"
        aria-label="Menu"
        style={{ color: 'rgba(255, 255, 255, 0.6)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {panels.map((panel) => (
        <button
          type="button"
          key={panel.id}
          onClick={() => onPanelChange(panel.id)}
          className="flex-1 py-2.5 flex flex-col items-center gap-1 transition-all duration-200"
          style={{
            color: activePanel === panel.id ? 'var(--accent-bright)' : 'rgba(255, 255, 255, 0.4)',
            borderTop: activePanel === panel.id
              ? '2px solid var(--accent)'
              : '2px solid transparent',
            background: activePanel === panel.id
              ? 'rgba(127, 0, 255, 0.08)'
              : 'transparent',
          }}
        >
          {panel.icon}
          <span className="text-[10px] font-medium">{panel.label}</span>
        </button>
      ))}
    </nav>
  );
}
