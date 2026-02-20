import { useState, useEffect } from 'react';
import { listFiles, type FileEntry } from '../../api/files';
import FileTreeItem from './FileTreeItem';

interface FileTreeProps {
  rootPath?: string;
  onFileSelect: (path: string) => void;
}

export default function FileTree({ rootPath, onFileSelect }: FileTreeProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState(rootPath || '');
  const [loading, setLoading] = useState(false);

  const loadFiles = async (path?: string) => {
    setLoading(true);
    try {
      const { data } = await listFiles(path);
      setFiles(data.files || []);
      setCurrentPath(data.path);
    } catch (err) {
      console.error('Failed to list files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(rootPath);
  }, [rootPath]);

  const handleClick = (file: FileEntry) => {
    if (file.is_dir) {
      loadFiles(file.path);
    } else {
      onFileSelect(file.path);
    }
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/');
    if (parent) loadFiles(parent);
  };

  // Sort: folders first, then files
  const sorted = [...files].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b text-xs"
           style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
        <button onClick={goUp} className="hover:opacity-70" title="Go up">
          ..
        </button>
        <span className="truncate flex-1 font-mono">{currentPath}</span>
        <button onClick={() => loadFiles(currentPath)} className="hover:opacity-70" title="Refresh">
          R
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Empty directory
          </div>
        ) : (
          sorted.map((file) => (
            <FileTreeItem
              key={file.path}
              file={file}
              onClick={() => handleClick(file)}
            />
          ))
        )}
      </div>
    </div>
  );
}
