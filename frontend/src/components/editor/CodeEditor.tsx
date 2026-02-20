import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { readFile, writeFile } from '../../api/files';
import toast from 'react-hot-toast';

interface CodeEditorProps {
  filePath: string | null;
}

// Detect language from file extension
function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    go: 'go',
    py: 'python',
    rs: 'rust',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    scss: 'scss',
    html: 'html',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    toml: 'toml',
    xml: 'xml',
    env: 'plaintext',
    txt: 'plaintext',
    mod: 'go',
    sum: 'plaintext',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
  };
  return map[ext || ''] || 'plaintext';
}

export default function CodeEditor({ filePath }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    readFile(filePath)
      .then(({ data }) => {
        setContent(data.content);
        setOriginalContent(data.content);
        setModified(false);
      })
      .catch(() => toast.error('Failed to read file'))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath || !modified) return;
    try {
      await writeFile(filePath, content);
      setOriginalContent(content);
      setModified(false);
      toast.success('File saved');
    } catch {
      toast.error('Failed to save file');
    }
  };

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filePath, content, modified]);

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center"
           style={{ background: 'var(--bg-primary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Select a file to edit
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs"
           style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <span className="truncate font-mono" style={{ color: 'var(--text-primary)' }}>
          {filePath}
        </span>
        {modified && (
          <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
        )}
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!modified}
          className="px-2 py-0.5 rounded text-xs transition-opacity disabled:opacity-30"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Save
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</span>
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            theme="vs-dark"
            onChange={(value) => {
              setContent(value || '');
              setModified(value !== originalContent);
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
            }}
          />
        )}
      </div>
    </div>
  );
}
