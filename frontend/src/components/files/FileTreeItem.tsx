import type { FileEntry } from '../../api/files';

interface FileTreeItemProps {
  file: FileEntry;
  onClick: () => void;
}

const FILE_ICONS: Record<string, string> = {
  '.ts': 'TS',
  '.tsx': 'TX',
  '.js': 'JS',
  '.jsx': 'JX',
  '.go': 'GO',
  '.py': 'PY',
  '.rs': 'RS',
  '.md': 'MD',
  '.json': '{}',
  '.yaml': 'YM',
  '.yml': 'YM',
  '.css': 'CS',
  '.html': '<>',
  '.sql': 'SQ',
  '.sh': 'SH',
  '.env': 'EN',
  '.toml': 'TM',
  '.mod': 'GM',
};

const FILE_COLORS: Record<string, string> = {
  '.ts': '#3b82f6',
  '.tsx': '#3b82f6',
  '.js': '#eab308',
  '.jsx': '#eab308',
  '.go': '#06b6d4',
  '.py': '#22c55e',
  '.rs': '#f97316',
  '.md': '#a78bfa',
  '.json': '#fbbf24',
  '.css': '#ec4899',
  '.html': '#f97316',
};

function getIcon(file: FileEntry): string {
  if (file.is_dir) return '/';
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || '--';
}

function getColor(file: FileEntry): string {
  if (file.is_dir) return 'var(--accent)';
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return FILE_COLORS[ext] || 'var(--text-secondary)';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'K';
  return (bytes / (1024 * 1024)).toFixed(1) + 'M';
}

export default function FileTreeItem({ file, onClick }: FileTreeItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-all duration-150"
      style={{
        color: 'var(--text-primary)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--glass-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        className="w-5 text-[10px] font-mono text-center shrink-0 font-bold"
        style={{ color: getColor(file) }}
      >
        {getIcon(file)}
      </span>
      <span className="truncate flex-1">{file.name}</span>
      {!file.is_dir && (
        <span className="text-xs shrink-0 font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {formatSize(file.size)}
        </span>
      )}
    </button>
  );
}
