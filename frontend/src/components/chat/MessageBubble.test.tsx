import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';

// Mock react-markdown to render children as plain text
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock remark-gfm
vi.mock('remark-gfm', () => ({
  default: {},
}));

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre data-testid="code-block">{children}</pre>,
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
}));

describe('MessageBubble', () => {
  it('renders user message with correct text', () => {
    render(<MessageBubble role="user" content="Hello, assistant!" />);

    expect(screen.getByText('Hello, assistant!')).toBeInTheDocument();
  });

  it('renders user message with whitespace-pre-wrap style', () => {
    render(<MessageBubble role="user" content="Hello world" />);

    const messageEl = screen.getByText('Hello world');
    expect(messageEl).toHaveClass('whitespace-pre-wrap');
  });

  it('renders user message aligned to the right', () => {
    const { container } = render(<MessageBubble role="user" content="Hi" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('justify-end');
  });

  it('renders assistant message aligned to the left', () => {
    const { container } = render(<MessageBubble role="assistant" content="Hello" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('justify-start');
  });

  it('renders assistant message with markdown', () => {
    render(<MessageBubble role="assistant" content="**bold text**" />);

    // The mocked ReactMarkdown renders children as text
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
    expect(screen.getByTestId('markdown')).toHaveTextContent('**bold text**');
  });

  it('shows streaming cursor when isStreaming is true for assistant', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Streaming content..." isStreaming={true} />
    );

    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });

  it('does not show streaming cursor when isStreaming is false', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Done." isStreaming={false} />
    );

    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).not.toBeInTheDocument();
  });

  it('renders user message with accent background color', () => {
    const { container } = render(<MessageBubble role="user" content="Test" />);

    const bubble = container.querySelector('.rounded-2xl') as HTMLElement;
    expect(bubble.style.background).toBe('var(--accent)');
    // jsdom normalizes #fff to rgb(255, 255, 255)
    expect(bubble.style.color).toBe('rgb(255, 255, 255)');
  });

  it('renders assistant message with tertiary background color', () => {
    const { container } = render(<MessageBubble role="assistant" content="Test" />);

    const bubble = container.querySelector('.rounded-2xl') as HTMLElement;
    expect(bubble.style.background).toBe('var(--bg-tertiary)');
    expect(bubble.style.color).toBe('var(--text-primary)');
  });

  it('parses assistant JSON content with text events', () => {
    const jsonContent = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Parsed content' }],
      },
    });

    render(<MessageBubble role="assistant" content={jsonContent} />);

    expect(screen.getByTestId('markdown')).toHaveTextContent('Parsed content');
  });

  it('handles non-JSON assistant content gracefully', () => {
    render(<MessageBubble role="assistant" content="Plain text response" />);

    expect(screen.getByTestId('markdown')).toHaveTextContent('Plain text response');
  });

  it('renders user message with rounded-br-md class', () => {
    const { container } = render(<MessageBubble role="user" content="Hi" />);

    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble).toHaveClass('rounded-br-md');
  });

  it('renders assistant message with rounded-bl-md class', () => {
    const { container } = render(<MessageBubble role="assistant" content="Hi" />);

    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble).toHaveClass('rounded-bl-md');
  });
});
