import { useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { getMessages } from '../../api/sessions';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { Message } from '../../api/sessions';

interface ChatPanelProps {
  sessionId: string | null;
}

export default function ChatPanel({ sessionId }: ChatPanelProps) {
  const {
    messages,
    setMessages,
    isStreaming,
    streamContent,
    isConnected,
    sendMessage,
    cancelMessage,
  } = useChat(sessionId);

  // Load history when session changes
  useEffect(() => {
    if (!sessionId) return;
    getMessages(sessionId).then(({ data }) => {
      setMessages(data as Message[]);
    }).catch(() => {});
  }, [sessionId, setMessages]);

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center"
           style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-10">{'>'}_</div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Select or create a chat session
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Connection indicator */}
      {!isConnected && (
        <div className="px-4 py-1 text-xs text-center"
             style={{ background: 'var(--danger)', color: '#fff' }}>
          Disconnected — reconnecting...
        </div>
      )}

      <MessageList
        messages={messages}
        streamContent={streamContent}
        isStreaming={isStreaming}
      />

      <ChatInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={isStreaming}
        disabled={!isConnected}
      />
    </div>
  );
}
