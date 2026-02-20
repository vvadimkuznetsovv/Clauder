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

function getIcon(file: FileEntry): string {
  if (file.is_dir) return '/';
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || '--';
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
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:opacity-80 text-left transition-colors"
      style={{
        color: file.is_dir ? 'var(--accent)' : 'var(--text-primary)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span className="w-5 text-[10px] font-mono text-center opacity-60 shrink-0">
        {getIcon(file)}
      </span>
      <span className="truncate flex-1">{file.name}</span>
      {!file.is_dir && (
        <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
          {formatSize(file.size)}
        </span>
      )}
    </button>
  );
}
