import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuth stores user and tokens', () => {
    const mockUser = { id: '1', username: 'testuser', totp_enabled: false };
    const accessToken = 'access-token-123';
    const refreshToken = 'refresh-token-456';

    useAuthStore.getState().setAuth(mockUser, accessToken, refreshToken);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe(accessToken);
    expect(state.isAuthenticated).toBe(true);

    // Check localStorage
    expect(localStorage.getItem('access_token')).toBe(accessToken);
    expect(localStorage.getItem('refresh_token')).toBe(refreshToken);
  });

  it('clearAuth clears everything', () => {
    // Set up initial authenticated state
    const mockUser = { id: '1', username: 'testuser', totp_enabled: false };
    useAuthStore.getState().setAuth(mockUser, 'access-123', 'refresh-456');

    // Verify pre-condition
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Clear auth
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    // Check localStorage is cleared
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('loadFromStorage returns true when token exists', () => {
    localStorage.setItem('access_token', 'stored-token');

    const result = useAuthStore.getState().loadFromStorage();

    expect(result).toBe(true);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('stored-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('loadFromStorage returns false when no token', () => {
    const result = useAuthStore.getState().loadFromStorage();

    expect(result).toBe(false);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuth with TOTP-enabled user stores totp_enabled correctly', () => {
    const mockUser = { id: '2', username: 'secureuser', totp_enabled: true };
    useAuthStore.getState().setAuth(mockUser, 'token', 'refresh');

    const state = useAuthStore.getState();
    expect(state.user?.totp_enabled).toBe(true);
  });
});
