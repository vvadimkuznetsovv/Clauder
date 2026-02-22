import type { PanelId, BasePanelId } from '../../store/layoutUtils';
import { isDetachedEditor, getDetachedTabId, isDetachedTerminal, getDetachedTerminalId } from '../../store/layoutUtils';
import { useLayoutStore } from '../../store/layoutStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import ChatPanel from '../chat/ChatPanel';
import EditorPanel from '../editor/EditorPanel';
import CodeEditor from '../editor/CodeEditor';
import PreviewPanel from '../preview/PreviewPanel';
import TerminalComponent from '../terminal/Terminal';

const basePanelIcons: Record<BasePanelId, React.ReactNode> = {
  chat: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  files: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  editor: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  preview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  terminal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
};

const basePanelTitles: Record<BasePanelId, string> = {
  chat: 'Chat',
  files: 'File Manager',
  editor: 'Editor',
  preview: 'Preview',
  terminal: 'Terminal',
};

// Dynamic icon lookup — detached editors use the code icon, detached terminals use the terminal icon
export function getPanelIcon(panelId: PanelId): React.ReactNode {
  if (isDetachedEditor(panelId)) return basePanelIcons.editor;
  if (isDetachedTerminal(panelId)) return basePanelIcons.terminal;
  return basePanelIcons[panelId as BasePanelId] ?? basePanelIcons.editor;
}

// Dynamic title lookup — detached editors show the filename
export function getPanelTitle(panelId: PanelId): string {
  if (isDetachedEditor(panelId)) {
    const tabId = getDetachedTabId(panelId);
    if (tabId) {
      const info = useWorkspaceStore.getState().detachedEditors[tabId];
      if (info) return info.filePath.split(/[/\\]/).pop() || info.filePath;
    }
    return 'Editor';
  }
  if (isDetachedTerminal(panelId)) return 'Terminal';
  return basePanelTitles[panelId as BasePanelId] ?? 'Panel';
}

// Keep backward-compatible exports (used in Workspace.tsx toolbar)
export const panelIcons = basePanelIcons;
export const panelTitles = basePanelTitles;

export default function PanelContent({ panelId }: { panelId: PanelId }) {
  const { visibility } = useLayoutStore();
  const { activeSession, openTabs, activeTabId, detachedEditors } = useWorkspaceStore();

  // Handle detached editor panels
  if (isDetachedEditor(panelId)) {
    const tabId = getDetachedTabId(panelId);
    const info = tabId ? detachedEditors[tabId] : null;
    return (
      <CodeEditor
        filePath={info?.filePath || null}
        tabId={tabId}
      />
    );
  }

  // Handle detached terminal panels
  if (isDetachedTerminal(panelId)) {
    const instanceId = getDetachedTerminalId(panelId)!;
    return <TerminalComponent instanceId={instanceId} active={visibility[panelId]} />;
  }

  switch (panelId) {
    case 'chat':
      return <ChatPanel sessionId={activeSession?.id || null} />;

    case 'files':
      return <EditorPanel />;

    case 'editor': {
      const activeTab = openTabs.find((t) => t.id === activeTabId) || null;
      return (
        <CodeEditor
          filePath={activeTab?.filePath || null}
          tabId={activeTab?.id || null}
        />
      );
    }

    case 'preview':
      return <PreviewPanel />;

    case 'terminal':
      return <TerminalComponent instanceId="default" persistent active={visibility.terminal} />;

    default:
      return null;
  }
}
