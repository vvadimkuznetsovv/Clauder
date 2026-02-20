interface MobileNavProps {
  activePanel: 'chat' | 'files' | 'editor' | 'terminal';
  onPanelChange: (panel: 'chat' | 'files' | 'editor' | 'terminal') => void;
  onMenuToggle: () => void;
}

const panels = [
  { id: 'chat' as const, label: 'Chat', icon: '>' },
  { id: 'files' as const, label: 'Files', icon: '/' },
  { id: 'editor' as const, label: 'Editor', icon: '#' },
  { id: 'terminal' as const, label: 'Term', icon: '$' },
];

export default function MobileNav({ activePanel, onPanelChange, onMenuToggle }: MobileNavProps) {
  return (
    <nav
      className="flex items-center border-t lg:hidden"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      <button
        onClick={onMenuToggle}
        className="px-3 py-3 text-sm font-mono"
        style={{ color: 'var(--text-secondary)' }}
      >
        =
      </button>

      {panels.map((panel) => (
        <button
          key={panel.id}
          onClick={() => onPanelChange(panel.id)}
          className="flex-1 py-3 text-xs font-medium text-center transition-colors"
          style={{
            color: activePanel === panel.id ? 'var(--accent)' : 'var(--text-secondary)',
            borderTop: activePanel === panel.id ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          <div className="text-base font-mono">{panel.icon}</div>
          <div>{panel.label}</div>
        </button>
      ))}
    </nav>
  );
}
