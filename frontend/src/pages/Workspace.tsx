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

export default function Workspace() {
  useAuth();

  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);

  const handleFileSelect = (path: string) => {
    setEditingFile(path);
    setActivePanel('editor');
  };

  return (
    <div className="h-dvh flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeSessionId={activeSession?.id || null}
          onSelectSession={setActiveSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Desktop: split panels */}
          <div className="hidden lg:flex flex-1">
            {/* Left: Chat */}
            <div className="flex-1 min-w-0 border-r" style={{ borderColor: 'var(--border)' }}>
              <ChatPanel sessionId={activeSession?.id || null} />
            </div>

            {/* Right: Files + Editor + Terminal */}
            <div className="w-[45%] flex flex-col min-w-0">
              {/* Top: Files + Editor */}
              <div className="flex-1 flex overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="w-48 border-r shrink-0 overflow-hidden"
                     style={{ borderColor: 'var(--border)' }}>
                  <FileTree
                    rootPath={activeSession?.working_directory}
                    onFileSelect={handleFileSelect}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CodeEditor filePath={editingFile} />
                </div>
              </div>

              {/* Bottom: Terminal */}
              <div className="h-[35%] min-h-[150px]">
                <TerminalComponent active />
              </div>
            </div>
          </div>

          {/* Mobile: single panel */}
          <div className="flex lg:hidden flex-1">
            <div className={`flex-1 ${activePanel === 'chat' ? '' : 'hidden'}`}>
              <ChatPanel sessionId={activeSession?.id || null} />
            </div>
            <div className={`flex-1 ${activePanel === 'files' ? '' : 'hidden'}`}>
              <FileTree
                rootPath={activeSession?.working_directory}
                onFileSelect={handleFileSelect}
              />
            </div>
            <div className={`flex-1 ${activePanel === 'editor' ? '' : 'hidden'}`}>
              <CodeEditor filePath={editingFile} />
            </div>
            <div className={`flex-1 ${activePanel === 'terminal' ? '' : 'hidden'}`}>
              <TerminalComponent active={activePanel === 'terminal'} />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onMenuToggle={() => setSidebarOpen(true)}
      />
    </div>
  );
}
