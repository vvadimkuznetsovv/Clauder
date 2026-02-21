import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { readFile, writeFile } from '../../api/files';
import { useWorkspaceStore } from '../../store/workspaceStore';
import toast from 'react-hot-toast';

interface CodeEditorProps {
  filePath: string | null;
  tabId: string | null;
}

interface TabState {
  content: string;
  originalContent: string;
  viewState: unknown;
}

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

export default function CodeEditor({ filePath, tabId }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [modified, setModified] = useState(false);

  const { setTabModified } = useWorkspaceStore();

  // Cache tab states to preserve content/viewState between tab switches
  const tabStatesRef = useRef<Map<string, TabState>>(new Map());
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const previousTabIdRef = useRef<string | null>(null);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Restore viewState if switching to a cached tab
    if (tabId) {
      const cached = tabStatesRef.current.get(tabId);
      if (cached?.viewState) {
        editor.restoreViewState(cached.viewState as Parameters<typeof editor.restoreViewState>[0]);
      }
    }
  };

  // Save current tab state before switching
  const saveCurrentTabState = useCallback(() => {
    const prevId = previousTabIdRef.current;
    if (prevId && editorRef.current) {
      tabStatesRef.current.set(prevId, {
        content,
        originalContent,
        viewState: editorRef.current.saveViewState(),
      });
    }
  }, [content, originalContent]);

  // Load file when filePath/tabId changes
  useEffect(() => {
    if (!filePath || !tabId) {
      previousTabIdRef.current = tabId;
      return;
    }

    // Save previous tab state
    saveCurrentTabState();

    // Check cache for this tab
    const cached = tabStatesRef.current.get(tabId);
    if (cached) {
      setContent(cached.content);
      setOriginalContent(cached.originalContent);
      const isModified = cached.content !== cached.originalContent;
      setModified(isModified);

      // Restore viewState after a tick
      if (editorRef.current && cached.viewState) {
        setTimeout(() => {
          editorRef.current?.restoreViewState(
            cached.viewState as Parameters<NonNullable<typeof editorRef.current>['restoreViewState']>[0],
          );
        }, 0);
      }
    } else {
      // Fetch from server
      setLoading(true);
      readFile(filePath)
        .then(({ data }) => {
          setContent(data.content);
          setOriginalContent(data.content);
          setModified(false);
        })
        .catch(() => toast.error('Failed to read file'))
        .finally(() => setLoading(false));
    }

    previousTabIdRef.current = tabId;
  }, [filePath, tabId]);

  const handleSave = useCallback(async () => {
    if (!filePath || !modified || !tabId) return;
    try {
      await writeFile(filePath, content);
      setOriginalContent(content);
      setModified(false);
      setTabModified(tabId, false);
      // Update cache
      tabStatesRef.current.set(tabId, {
        content,
        originalContent: content,
        viewState: editorRef.current?.saveViewState() ?? null,
      });
      toast.success('File saved');
    } catch {
      toast.error('Failed to save file');
    }
  }, [filePath, content, modified, tabId, setTabModified]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4" style={{ opacity: 0.1, color: 'var(--accent)' }}>
            {'</>'}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select a file to edit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <span className="text-sm glow-pulse" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </span>
        </div>
      ) : (
        <Editor
          height="100%"
          language={getLanguage(filePath)}
          value={content}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(value) => {
            const newContent = value || '';
            setContent(newContent);
            const isModified = newContent !== originalContent;
            setModified(isModified);
            if (tabId) setTabModified(tabId, isModified);
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
  );
}
