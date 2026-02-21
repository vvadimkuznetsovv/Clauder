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

  useEffect(() => {
    if (!sessionId) return;
    getMessages(sessionId).then(({ data }) => {
      setMessages(data as Message[]);
    }).catch(() => {});
  }, [sessionId, setMessages]);

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="text-6xl mb-6"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              opacity: 0.3,
            }}
          >
            {'>'}_
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Select or create a chat session
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {!isConnected && (
        <div
          className="px-4 py-1.5 text-xs text-center font-medium"
          style={{
            background: 'linear-gradient(90deg, rgba(248, 113, 113, 0.2), rgba(248, 113, 113, 0.1))',
            borderBottom: '1px solid rgba(248, 113, 113, 0.3)',
            color: 'var(--danger)',
          }}
        >
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
