import { useWorkspaceStore, type EditorTab } from '../../store/workspaceStore';
import FileTree from '../files/FileTree';
import CodeEditor from './CodeEditor';

export default function EditorPanel() {
  const {
    openTabs,
    activeTabId,
    fileTreeVisible,
    activeSession,
    openFile,
    closeTab,
    setActiveTab,
    toggleFileTree,
  } = useWorkspaceStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId) || null;

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="editor-tab-bar">
        <button
          type="button"
          className={`editor-toggle-files ${fileTreeVisible ? 'active' : ''}`}
          onClick={toggleFileTree}
          title={fileTreeVisible ? 'Hide file manager' : 'Show file manager'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <div className="editor-tabs-scroll">
          {openTabs.map((tab) => (
            <EditorTabButton
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Main content: sidebar + editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* FileTree sidebar */}
        {fileTreeVisible && (
          <div className="editor-file-sidebar">
            <FileTree
              rootPath={activeSession?.working_directory}
              onFileSelect={(path) => openFile(path, false)}
              onFileOpenNewTab={(path) => openFile(path, true)}
            />
          </div>
        )}

        {/* Code editor */}
        <div className="flex-1 min-w-0">
          <CodeEditor
            filePath={activeTab?.filePath || null}
            tabId={activeTab?.id || null}
          />
        </div>
      </div>
    </div>
  );
}

function EditorTabButton({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: EditorTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const fileName = tab.filePath.split('/').pop() || tab.filePath;

  return (
    <div
      className={`editor-tab ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      title={tab.filePath}
      role="tab"
      aria-selected={isActive}
    >
      <span className="truncate">{fileName}</span>
      {tab.modified && <span className="tab-modified-dot" />}
      <button
        type="button"
        className="tab-close-btn"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close tab"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
