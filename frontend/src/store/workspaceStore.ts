import { create } from 'zustand';
import type { ChatSession } from '../api/sessions';

export interface EditorTab {
  id: string;
  filePath: string;
  modified: boolean;
}

let tabCounter = 0;
function generateTabId(): string {
  return `tab-${++tabCounter}`;
}

interface WorkspaceState {
  activeSession: ChatSession | null;

  // Tab system
  openTabs: EditorTab[];
  activeTabId: string | null;

  // FileTree sidebar visibility inside editor panel
  fileTreeVisible: boolean;

  // Preview panel
  previewUrl: string | null;
  previewFilePath: string | null;

  // UI state
  sidebarOpen: boolean;
  toolbarOpen: boolean;

  // Session
  setActiveSession: (session: ChatSession | null) => void;

  // Tab actions
  openFile: (filePath: string, inNewTab?: boolean) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabModified: (tabId: string, modified: boolean) => void;

  // FileTree toggle
  toggleFileTree: () => void;
  setFileTreeVisible: (visible: boolean) => void;

  // Preview
  setPreviewUrl: (url: string | null) => void;
  setPreviewFile: (filePath: string | null) => void;

  // UI
  setSidebarOpen: (open: boolean) => void;
  setToolbarOpen: (open: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeSession: null,
  openTabs: [],
  activeTabId: null,
  fileTreeVisible: true,
  previewUrl: null,
  previewFilePath: null,
  sidebarOpen: false,
  toolbarOpen: false,

  setActiveSession: (session) => set({ activeSession: session }),

  openFile: (filePath, inNewTab = false) => {
    const { openTabs, activeTabId } = get();

    // Check if file is already open
    const existing = openTabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    if (inNewTab || openTabs.length === 0) {
      // Open in new tab
      const newTab: EditorTab = { id: generateTabId(), filePath, modified: false };
      set({
        openTabs: [...openTabs, newTab],
        activeTabId: newTab.id,
      });
    } else {
      // Replace active tab (if not modified), otherwise open new tab
      const activeTab = openTabs.find((t) => t.id === activeTabId);
      if (activeTab && !activeTab.modified) {
        set({
          openTabs: openTabs.map((t) =>
            t.id === activeTabId ? { ...t, filePath, modified: false } : t,
          ),
        });
      } else {
        const newTab: EditorTab = { id: generateTabId(), filePath, modified: false };
        set({
          openTabs: [...openTabs, newTab],
          activeTabId: newTab.id,
        });
      }
    }
  },

  closeTab: (tabId) => {
    const { openTabs, activeTabId } = get();
    const idx = openTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const newTabs = openTabs.filter((t) => t.id !== tabId);
    let newActiveId = activeTabId;

    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (idx >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1].id;
      } else {
        newActiveId = newTabs[idx].id;
      }
    }

    set({ openTabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setTabModified: (tabId, modified) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === tabId ? { ...t, modified } : t,
      ),
    }));
  },

  toggleFileTree: () => set((state) => ({ fileTreeVisible: !state.fileTreeVisible })),
  setFileTreeVisible: (visible) => set({ fileTreeVisible: visible }),

  setPreviewUrl: (url) => set({ previewUrl: url, previewFilePath: null }),
  setPreviewFile: (filePath) => set({ previewFilePath: filePath, previewUrl: null }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setToolbarOpen: (open) => set({ toolbarOpen: open }),
}));
