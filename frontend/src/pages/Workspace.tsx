import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import ChatPanel from '../components/chat/ChatPanel';
import FileTree from '../components/files/FileTree';
import CodeEditor from '../components/editor/CodeEditor';
import TerminalComponent from '../components/terminal/Terminal';
import type { ChatSession } from '../api/sessions';

type PanelType = 'chat' | 'files' | 'editor' | 'terminal';
type RightTab = 'files' | 'preview';

export default function Workspace() {
  useAuth();

  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('files');

  const handleFileSelect = (path: string) => {
    setEditingFile(path);
    setActivePanel('editor');
  };

  return (
    <div className="h-dvh relative overflow-hidden">
      {/* === Lava lamp background (same as Login) === */}
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.006" numOctaves="3" seed="42" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="2.5" result="blurred" />
            <feDisplacementMap in="SourceGraphic" in2="blurred" scale="120" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className="lava-lamp">
        <div className="lava-blob lava-blob-1" />
        <div className="lava-blob lava-blob-2" />
        <div className="lava-blob lava-blob-3" />
        <div className="lava-blob lava-blob-4" />
        <div className="lava-blob lava-blob-5" />
        <div className="lava-blob lava-blob-6" />
        <div className="lava-blob lava-blob-7" />
        <div className="lava-blob lava-blob-8" />
        <div className="lava-glow" />
      </div>

      {/* === DESKTOP LAYOUT === */}
      <div className="hidden lg:flex h-full relative z-10 p-4 gap-3">

        {/* Sidebar — slides in/out */}
        <div
          style={{
            width: sidebarOpen ? '260px' : '0px',
            opacity: sidebarOpen ? 1 : 0,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            flexShrink: 0,
          }}
        >
          <div className="workspace-glass-panel h-full" style={{ width: '260px' }}>
            <div className="workspace-glass-panel-shimmer" />
            <div className="workspace-glass-panel-content">
              <Sidebar
                activeSessionId={activeSession?.id || null}
                onSelectSession={setActiveSession}
                isOpen={true}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        </div>

        {/* Chat panel — glass card */}
        <div className="workspace-glass-panel flex-1 min-w-[320px]">
          <div className="workspace-glass-panel-shimmer" />
          <div className="workspace-glass-panel-content flex flex-col">
            {/* Chat header with sidebar toggle */}
            <div
              className="flex items-center gap-3 px-3 py-2"
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
                title={sidebarOpen ? 'Hide sessions' : 'Show sessions'}
                style={{
                  background: sidebarOpen ? 'rgba(127, 0, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                  border: sidebarOpen ? '1px solid rgba(127, 0, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: sidebarOpen ? 'var(--accent-bright)' : 'rgba(255, 255, 255, 0.5)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {sidebarOpen ? (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </>
                  )}
                </svg>
              </button>
              <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                {activeSession?.title || 'Claude Code'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel sessionId={activeSession?.id || null} />
            </div>
          </div>
        </div>

        {/* Right side — top (files/editor) + bottom (terminal) */}
        <div className="flex flex-col gap-3 w-[45%] min-w-[400px]">

          {/* Top: Files/Preview with tabs */}
          <div className="workspace-glass-panel flex-1">
            <div className="workspace-glass-panel-shimmer" />
            <div className="workspace-glass-panel-content flex flex-col">
              {/* Tab bar */}
              <div className="workspace-tab-bar">
                <button
                  type="button"
                  className={`workspace-tab ${rightTab === 'files' ? 'active' : ''}`}
                  onClick={() => setRightTab('files')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  File Manager
                </button>
                <button
                  type="button"
                  className={`workspace-tab ${rightTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setRightTab('preview')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Preview
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {rightTab === 'files' ? (
                  <div className="flex h-full">
                    <div className="w-52 shrink-0 overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <FileTree
                        rootPath={activeSession?.working_directory}
                        onFileSelect={handleFileSelect}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CodeEditor filePath={editingFile} />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <p className="text-sm opacity-50">Frontend preview</p>
                      <p className="text-xs opacity-30 mt-1">Coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: Terminal */}
          <div className="workspace-glass-panel h-[35%] min-h-[180px]">
            <div className="workspace-glass-panel-shimmer" />
            <div className="workspace-glass-panel-content">
              <TerminalComponent active />
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE LAYOUT === */}
      <div className="flex lg:hidden flex-col h-full relative z-10">
        <div className="flex-1 overflow-hidden p-2">
          <div className="workspace-glass-panel h-full">
            <div className="workspace-glass-panel-shimmer" />
            <div className="workspace-glass-panel-content">
              <div className={`h-full ${activePanel === 'chat' ? '' : 'hidden'}`}>
                <ChatPanel sessionId={activeSession?.id || null} />
              </div>
              <div className={`h-full ${activePanel === 'files' ? '' : 'hidden'}`}>
                <FileTree
                  rootPath={activeSession?.working_directory}
                  onFileSelect={handleFileSelect}
                />
              </div>
              <div className={`h-full ${activePanel === 'editor' ? '' : 'hidden'}`}>
                <CodeEditor filePath={editingFile} />
              </div>
              <div className={`h-full ${activePanel === 'terminal' ? '' : 'hidden'}`}>
                <TerminalComponent active={activePanel === 'terminal'} />
              </div>
            </div>
          </div>
        </div>

        <MobileNav
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onMenuToggle={() => setSidebarOpen(true)}
        />

        {/* Mobile sidebar overlay */}
        <Sidebar
          activeSessionId={activeSession?.id || null}
          onSelectSession={setActiveSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
