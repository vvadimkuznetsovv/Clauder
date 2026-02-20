import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onCancel: vi.fn(),
    isStreaming: false,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and Send button', () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('calls onSend when Enter is pressed with text', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('clears input after sending', async () => {
    const user = userEvent.setup();

    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Send a message...') as HTMLTextAreaElement;
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(textarea.value).toBe('');
  });

  it('does not call onSend when Enter is pressed with empty input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.click(textarea);
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not call onSend when only whitespace', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('Shift+Enter does not submit and allows newline', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows Stop button when streaming', () => {
    render(<ChatInput {...defaultProps} isStreaming={true} />);

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('calls onCancel when Stop button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<ChatInput {...defaultProps} isStreaming={true} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSend when Send button is clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Click send message');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('Click send message');
  });

  it('disables textarea when disabled prop is true', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    expect(textarea).toBeDisabled();
  });

  it('Send button is disabled when input is empty', () => {
    render(<ChatInput {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeDisabled();
  });

  it('does not send when streaming', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} onSend={onSend} isStreaming={true} />);

    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Should not send');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });
});
