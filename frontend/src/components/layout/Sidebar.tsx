import { useState, useEffect } from 'react';
import { getSessions, createSession, deleteSession, type ChatSession } from '../../api/sessions';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../api/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface SidebarProps {
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activeSessionId, onSelectSession, isOpen, onClose }: SidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const loadSessions = async () => {
    try {
      const { data } = await getSessions();
      setSessions(data);
    } catch {
      console.error('Failed to load sessions');
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleNewChat = async () => {
    try {
      const { data } = await createSession();
      setSessions((prev) => [data, ...prev]);
      onSelectSession(data);
    } catch {
      toast.error('Failed to create session');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        onSelectSession(null as unknown as ChatSession);
      }
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col border-r transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
            Clauder
          </h1>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            X
          </button>
        </div>

        {/* New Chat */}
        <div className="p-2">
          <button
            onClick={handleNewChat}
            className="w-full py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 border"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              background: 'var(--bg-tertiary)',
            }}
          >
            + New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => { onSelectSession(session); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors group"
              style={{
                background: session.id === activeSessionId ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                if (session.id !== activeSessionId) e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                if (session.id !== activeSessionId) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="truncate flex-1">{session.title}</span>
              <span
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-xs shrink-0 px-1"
                style={{ color: 'var(--danger)' }}
              >
                x
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--danger)' }}
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
