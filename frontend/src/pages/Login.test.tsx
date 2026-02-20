import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth API
const mockLogin = vi.fn();
const mockTotpVerify = vi.fn();
vi.mock('../api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  totpVerify: (...args: unknown[]) => mockTotpVerify(...args),
}));

// Mock toast
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: {
    error: (msg: string) => mockToastError(msg),
    success: vi.fn(),
  },
}));

// Mock authStore
const mockSetAuth = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { setAuth: typeof mockSetAuth }) => unknown) =>
    selector({ setAuth: mockSetAuth }),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with username and password fields', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Clauder')).toBeInTheDocument();
    expect(screen.getByText('Claude Code Web Interface')).toBeInTheDocument();
  });

  it('renders username and password labels', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('shows TOTP input after successful password when requires_totp', async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValueOnce({
      data: {
        requires_totp: true,
        partial_token: 'partial-token-123',
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Fill in credentials
    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // Wait for TOTP form to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    expect(screen.getByText(/Enter the 6-digit code/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByText('Back to login')).toBeInTheDocument();
  });

  it('completes login without TOTP when not required', async () => {
    const user = userEvent.setup();

    const mockUser = { id: '1', username: 'testuser', totp_enabled: false };
    mockLogin.mockResolvedValueOnce({
      data: {
        requires_totp: false,
        user: mockUser,
        access_token: 'access-123',
        refresh_token: 'refresh-456',
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(mockUser, 'access-123', 'refresh-456');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles login errors and shows toast', async () => {
    const user = userEvent.setup();

    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Enter username'), 'baduser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('shows "Signing in..." while loading', async () => {
    const user = userEvent.setup();

    // Create a promise that won't resolve immediately
    let resolveLogin: (value: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockReturnValueOnce(loginPromise);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    // Cleanup
    resolveLogin!({ data: { requires_totp: false, user: {}, access_token: '', refresh_token: '' } });
  });

  it('handles TOTP verification successfully', async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValueOnce({
      data: {
        requires_totp: true,
        partial_token: 'partial-token-123',
      },
    });

    const mockUser = { id: '1', username: 'testuser', totp_enabled: true };
    mockTotpVerify.mockResolvedValueOnce({
      data: {
        user: mockUser,
        access_token: 'access-final',
        refresh_token: 'refresh-final',
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Login first
    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // Wait for TOTP form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    // Enter TOTP code
    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockTotpVerify).toHaveBeenCalledWith('123456', 'partial-token-123');
    });
    expect(mockSetAuth).toHaveBeenCalledWith(mockUser, 'access-final', 'refresh-final');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles TOTP verification error', async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValueOnce({
      data: {
        requires_totp: true,
        partial_token: 'partial-token-123',
      },
    });

    mockTotpVerify.mockRejectedValueOnce(new Error('Invalid code'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('000000'), '999999');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Invalid TOTP code');
    });
  });

  it('navigates back to login form from TOTP form', async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValueOnce({
      data: {
        requires_totp: true,
        partial_token: 'partial-token-123',
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Enter username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Back to login')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to login'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    });
  });
});
