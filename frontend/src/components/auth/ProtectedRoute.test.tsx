import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuthStore } from '../../store/authStore';

// Track Navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean }) => {
      mockNavigate(props);
      return <div data-testid="navigate">{`Redirecting to ${props.to}`}</div>;
    },
  };
});

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('redirects to /login when not authenticated', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Redirecting to /login');
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/login', replace: true })
    );
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated via store', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'test', totp_enabled: false },
      accessToken: 'token-123',
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toHaveTextContent('Secret Content');
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('renders children when token exists in localStorage (loadFromStorage)', () => {
    // Not authenticated in store, but token exists in localStorage
    localStorage.setItem('access_token', 'stored-token');

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toHaveTextContent('Secret Content');
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('redirects when store is unauthenticated and no token in localStorage', () => {
    // Ensure no token in localStorage
    localStorage.removeItem('access_token');

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
  });
});
