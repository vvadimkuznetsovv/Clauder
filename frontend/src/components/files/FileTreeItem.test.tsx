import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileTreeItem from './FileTreeItem';
import type { FileEntry } from '../../api/files';

describe('FileTreeItem', () => {
  const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
    name: 'test.ts',
    path: '/project/test.ts',
    is_dir: false,
    size: 1024,
    mod_time: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  it('renders file name', () => {
    render(<FileTreeItem file={makeFile()} onClick={() => {}} />);

    expect(screen.getByText('test.ts')).toBeInTheDocument();
  });

  it('renders correct icon for TypeScript file', () => {
    render(<FileTreeItem file={makeFile({ name: 'app.ts' })} onClick={() => {}} />);

    expect(screen.getByText('TS')).toBeInTheDocument();
  });

  it('renders correct icon for TSX file', () => {
    render(<FileTreeItem file={makeFile({ name: 'App.tsx' })} onClick={() => {}} />);

    expect(screen.getByText('TX')).toBeInTheDocument();
  });

  it('renders correct icon for JavaScript file', () => {
    render(<FileTreeItem file={makeFile({ name: 'index.js' })} onClick={() => {}} />);

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders correct icon for Go file', () => {
    render(<FileTreeItem file={makeFile({ name: 'main.go' })} onClick={() => {}} />);

    expect(screen.getByText('GO')).toBeInTheDocument();
  });

  it('renders correct icon for Python file', () => {
    render(<FileTreeItem file={makeFile({ name: 'script.py' })} onClick={() => {}} />);

    expect(screen.getByText('PY')).toBeInTheDocument();
  });

  it('renders correct icon for JSON file', () => {
    render(<FileTreeItem file={makeFile({ name: 'package.json' })} onClick={() => {}} />);

    expect(screen.getByText('{}')).toBeInTheDocument();
  });

  it('renders correct icon for Markdown file', () => {
    render(<FileTreeItem file={makeFile({ name: 'README.md' })} onClick={() => {}} />);

    expect(screen.getByText('MD')).toBeInTheDocument();
  });

  it('renders / icon for directory', () => {
    render(
      <FileTreeItem
        file={makeFile({ name: 'src', is_dir: true })}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renders -- icon for unknown file type', () => {
    render(<FileTreeItem file={makeFile({ name: 'data.xyz' })} onClick={() => {}} />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<FileTreeItem file={makeFile()} onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('displays formatted file size for bytes', () => {
    render(<FileTreeItem file={makeFile({ size: 512 })} onClick={() => {}} />);

    expect(screen.getByText('512B')).toBeInTheDocument();
  });

  it('displays formatted file size for kilobytes', () => {
    render(<FileTreeItem file={makeFile({ size: 2048 })} onClick={() => {}} />);

    expect(screen.getByText('2.0K')).toBeInTheDocument();
  });

  it('displays formatted file size for megabytes', () => {
    render(<FileTreeItem file={makeFile({ size: 2 * 1024 * 1024 })} onClick={() => {}} />);

    expect(screen.getByText('2.0M')).toBeInTheDocument();
  });

  it('does not display size for directories', () => {
    render(
      <FileTreeItem
        file={makeFile({ name: 'src', is_dir: true, size: 4096 })}
        onClick={() => {}}
      />
    );

    expect(screen.queryByText('4096B')).not.toBeInTheDocument();
    expect(screen.queryByText('4.0K')).not.toBeInTheDocument();
  });

  it('uses accent color for directory names', () => {
    const { container } = render(
      <FileTreeItem
        file={makeFile({ name: 'src', is_dir: true })}
        onClick={() => {}}
      />
    );

    const button = container.querySelector('button') as HTMLElement;
    expect(button.style.color).toBe('var(--accent)');
  });

  it('uses primary text color for file names', () => {
    const { container } = render(
      <FileTreeItem file={makeFile()} onClick={() => {}} />
    );

    const button = container.querySelector('button') as HTMLElement;
    expect(button.style.color).toBe('var(--text-primary)');
  });

  it('renders CSS file icon correctly', () => {
    render(<FileTreeItem file={makeFile({ name: 'styles.css' })} onClick={() => {}} />);

    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('renders HTML file icon correctly', () => {
    render(<FileTreeItem file={makeFile({ name: 'index.html' })} onClick={() => {}} />);

    expect(screen.getByText('<>')).toBeInTheDocument();
  });

  it('renders shell file icon correctly', () => {
    render(<FileTreeItem file={makeFile({ name: 'deploy.sh' })} onClick={() => {}} />);

    expect(screen.getByText('SH')).toBeInTheDocument();
  });
});
