import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * Ensure we have a valid (non-expired) access token, refreshing via
 * /api/auth/refresh if needed. Used by WebSocket connections (terminal, chat)
 * which bypass the axios interceptor.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  // Decode JWT payload to check expiry
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    // If token expires in more than 60s, it's fine
    if (payload.exp && payload.exp - now > 60) return token;
  } catch {
    // Can't decode — try refreshing
  }

  // Token expired or about to expire — refresh
  const refreshTok = localStorage.getItem('refresh_token');
  if (!refreshTok) return token; // no refresh token, try with what we have

  console.log('[ensureFreshToken] Access token expired/expiring — refreshing...');
  try {
    const { data } = await axios.post('/api/auth/refresh', {
      refresh_token: refreshTok,
    });
    console.log('[ensureFreshToken] Token refresh SUCCESS');
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    useAuthStore.getState().loadFromStorage();
    return data.access_token as string;
  } catch (err) {
    console.error('[ensureFreshToken] Token refresh FAILED — using old token', err);
    return token; // try with old token anyway
  }
}
