import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export default function PreviewPanel() {
  const { previewUrl, previewFilePath, setPreviewUrl, setPreviewFile } = useWorkspaceStore();
  const [urlInput, setUrlInput] = useState(previewUrl || '');

  const handleGo = () => {
    const url = urlInput.trim();
    if (!url) return;
    // Auto-add protocol if missing
    const fullUrl = url.startsWith('http') ? url : `http://${url}`;
    setPreviewUrl(fullUrl);
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setPreviewFile(null);
    setUrlInput('');
  };

  const getPreviewMode = (): 'url' | 'pdf' | 'empty' => {
    if (previewUrl) return 'url';
    if (!previewFilePath) return 'empty';
    const ext = previewFilePath.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    return 'empty';
  };

  const mode = getPreviewMode();

  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="preview-url-bar">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
          placeholder="http://localhost:3000"
          className="glass-input flex-1 px-3 py-1.5 rounded-lg text-xs"
        />
        <button type="button" onClick={handleGo} className="btn-glass px-3 py-1.5 rounded-lg text-xs">
          Go
        </button>
        <button type="button" onClick={handleClear} className="btn-glass px-3 py-1.5 rounded-lg text-xs">
          Clear
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'empty' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4" style={{ opacity: 0.15, color: 'var(--accent)' }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Enter a URL to preview
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Preview frontend sites, PDFs, and more
              </p>
            </div>
          </div>
        )}

        {mode === 'url' && previewUrl && (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Preview"
          />
        )}

        {mode === 'pdf' && previewFilePath && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                PDF Preview
              </p>
              <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {previewFilePath}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
