import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export default function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Parse streamed JSON content to extract readable text
  const displayContent = role === 'assistant' ? parseAssistantContent(content) : content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
        style={{
          background: isUser ? 'var(--accent)' : 'var(--bg-tertiary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match;
                  if (inline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded text-xs font-mono"
                        style={{ background: 'var(--bg-primary)' }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !my-2 text-xs"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: 'var(--accent)' }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function parseAssistantContent(raw: string): string {
  // Try to parse stream-json lines and extract text
  const lines = raw.split('\n').filter(Boolean);
  const textParts: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      // Handle different Claude Code stream-json event types
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text') textParts.push(block.text);
          if (block.type === 'tool_use') {
            textParts.push(`\n\`\`\`\nTool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}\n\`\`\`\n`);
          }
        }
      } else if (event.type === 'result') {
        if (event.result) textParts.push(event.result);
      }
    } catch {
      // Not JSON — use raw text
      textParts.push(line);
    }
  }

  return textParts.join('') || raw;
}
