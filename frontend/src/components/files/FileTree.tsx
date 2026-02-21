import { useState, useEffect } from 'react';
import { listFiles, deleteFile, type FileEntry } from '../../api/files';
import FileTreeItem from './FileTreeItem';
import toast from 'react-hot-toast';

interface FileTreeProps {
  rootPath?: string;
  onFileSelect: (path: string) => void;
  onFileOpenNewTab?: (path: string) => void;
}

export default function FileTree({ rootPath, onFileSelect, onFileOpenNewTab }: FileTreeProps) {
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

  const handleContextAction = (action: string, file: FileEntry) => {
    switch (action) {
      case 'open-new-tab':
        onFileOpenNewTab?.(file.path);
        break;
      case 'delete':
        deleteFile(file.path)
          .then(() => {
            toast.success('File deleted');
            loadFiles(currentPath);
          })
          .catch(() => toast.error('Failed to delete file'));
        break;
    }
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/');
    if (parent) loadFiles(parent);
  };

  const sorted = [...files].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'transparent' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs"
        style={{
          borderBottom: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        <button
          type="button"
          onClick={goUp}
          className="hover:opacity-70 transition-opacity px-1"
          title="Go up"
        >
          ..
        </button>
        <span className="truncate flex-1 font-mono">{currentPath}</span>
        <button
          type="button"
          onClick={() => loadFiles(currentPath)}
          className="hover:opacity-70 transition-opacity px-1"
          title="Refresh"
        >
          R
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="glow-pulse inline-block">Loading...</span>
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
              onContextAction={handleContextAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
