import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileNav from './MobileNav';

describe('MobileNav', () => {
  const defaultProps = {
    activePanel: 'chat' as const,
    onPanelChange: vi.fn(),
    onMenuToggle: vi.fn(),
  };

  it('renders all panel buttons', () => {
    render(<MobileNav {...defaultProps} />);

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Term')).toBeInTheDocument();
  });

  it('renders panel icons', () => {
    render(<MobileNav {...defaultProps} />);

    expect(screen.getByText('>')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('#')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('renders menu toggle button', () => {
    render(<MobileNav {...defaultProps} />);

    expect(screen.getByText('=')).toBeInTheDocument();
  });

  it('highlights active panel with accent color', () => {
    const { container } = render(<MobileNav {...defaultProps} activePanel="chat" />);

    // Find the Chat button specifically (by text content)
    const chatButton = screen.getByText('Chat').closest('button') as HTMLElement;
    expect(chatButton.style.color).toBe('var(--accent)');
    expect(chatButton.style.borderTop).toBe('2px solid var(--accent)');

    // Other panel buttons should use secondary color
    const filesButton = screen.getByText('Files').closest('button') as HTMLElement;
    expect(filesButton.style.color).toBe('var(--text-secondary)');
    expect(filesButton.style.borderTop).toBe('2px solid transparent');
  });

  it('highlights files panel when active', () => {
    render(<MobileNav {...defaultProps} activePanel="files" />);

    const filesButton = screen.getByText('Files').closest('button') as HTMLElement;
    expect(filesButton.style.color).toBe('var(--accent)');

    const chatButton = screen.getByText('Chat').closest('button') as HTMLElement;
    expect(chatButton.style.color).toBe('var(--text-secondary)');
  });

  it('highlights editor panel when active', () => {
    render(<MobileNav {...defaultProps} activePanel="editor" />);

    const editorButton = screen.getByText('Editor').closest('button') as HTMLElement;
    expect(editorButton.style.color).toBe('var(--accent)');
  });

  it('highlights terminal panel when active', () => {
    render(<MobileNav {...defaultProps} activePanel="terminal" />);

    const termButton = screen.getByText('Term').closest('button') as HTMLElement;
    expect(termButton.style.color).toBe('var(--accent)');
  });

  it('calls onPanelChange with correct panel id when clicked', async () => {
    const user = userEvent.setup();
    const onPanelChange = vi.fn();

    render(<MobileNav {...defaultProps} onPanelChange={onPanelChange} />);

    await user.click(screen.getByText('Files'));
    expect(onPanelChange).toHaveBeenCalledWith('files');

    await user.click(screen.getByText('Editor'));
    expect(onPanelChange).toHaveBeenCalledWith('editor');

    await user.click(screen.getByText('Term'));
    expect(onPanelChange).toHaveBeenCalledWith('terminal');

    await user.click(screen.getByText('Chat'));
    expect(onPanelChange).toHaveBeenCalledWith('chat');
  });

  it('calls onMenuToggle when menu button is clicked', async () => {
    const user = userEvent.setup();
    const onMenuToggle = vi.fn();

    render(<MobileNav {...defaultProps} onMenuToggle={onMenuToggle} />);

    await user.click(screen.getByText('='));

    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('renders as nav element', () => {
    render(<MobileNav {...defaultProps} />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('has lg:hidden class for responsive behavior', () => {
    render(<MobileNav {...defaultProps} />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('lg:hidden');
  });

  it('renders exactly 4 panel buttons plus menu toggle', () => {
    render(<MobileNav {...defaultProps} />);

    // 4 panels + 1 menu toggle = 5 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });
});
