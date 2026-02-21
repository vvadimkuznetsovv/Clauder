import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { Message } from '../../api/sessions';

interface MessageListProps {
  messages: Message[];
  streamContent: string;
  isStreaming: boolean;
}

export default function MessageList({ messages, streamContent, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div
            className="text-6xl mb-6 glow-pulse"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px var(--accent-glow))',
            }}
          >
            {'>'}_
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Claude Code
          </h2>
          <p
            className="text-sm max-w-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            Start a conversation. Claude can read and edit files, run commands, and help you code.
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}

      {isStreaming && streamContent && (
        <MessageBubble role="assistant" content={streamContent} isStreaming />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
