import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios module
vi.mock('axios', () => {
  const interceptors = {
    request: {
      handlers: [] as Array<{ fulfilled: (config: Record<string, unknown>) => Record<string, unknown> }>,
      use(fulfilled: (config: Record<string, unknown>) => Record<string, unknown>) {
        this.handlers.push({ fulfilled });
        return this.handlers.length - 1;
      },
    },
    response: {
      handlers: [] as Array<{
        fulfilled: (response: unknown) => unknown;
        rejected: (error: unknown) => unknown;
      }>,
      use(fulfilled: (response: unknown) => unknown, rejected: (error: unknown) => unknown) {
        this.handlers.push({ fulfilled, rejected });
        return this.handlers.length - 1;
      },
    },
  };

  const instance = {
    interceptors,
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  };

  return {
    default: {
      create: vi.fn(() => instance),
      post: vi.fn(),
    },
    __esModule: true,
  };
});

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset interceptor handlers
    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (instance) {
      instance.interceptors.request.handlers = [];
      instance.interceptors.response.handlers = [];
    }
  });

  it('creates axios instance with /api baseURL', async () => {
    // Re-import to trigger module initialization
    vi.resetModules();
    await import('./client');

    expect(axios.create).toHaveBeenCalledWith({
      baseURL: '/api',
    });
  });

  it('adds Authorization header when access_token exists in localStorage', async () => {
    vi.resetModules();
    localStorage.setItem('access_token', 'my-test-token');

    await import('./client');

    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const requestInterceptor = instance.interceptors.request.handlers[0];

    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.Authorization).toBe('Bearer my-test-token');
  });

  it('does not add Authorization header when no token', async () => {
    vi.resetModules();

    await import('./client');

    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const requestInterceptor = instance.interceptors.request.handlers[0];

    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('handles 401 by attempting token refresh', async () => {
    vi.resetModules();
    localStorage.setItem('refresh_token', 'my-refresh-token');

    const newTokens = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    };

    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: newTokens });

    await import('./client');

    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const responseInterceptor = instance.interceptors.response.handlers[0];

    // Mock the instance call for retry
    instance.get.mockResolvedValueOnce({ data: 'retried' });

    const error = {
      config: { _retry: false, headers: {} as Record<string, string> },
      response: { status: 401 },
    };

    // The interceptor calls the api instance itself for retry
    // We need to mock the instance to be callable
    const apiCallable = vi.fn().mockResolvedValue({ data: 'retried' });
    Object.assign(apiCallable, instance);

    // Since the interceptor calls `api(originalRequest)`, and api is the instance,
    // the actual refresh attempt should call axios.post
    try {
      await responseInterceptor.rejected(error);
    } catch {
      // May throw if retry fails since we can't fully mock the callable instance
    }

    // Verify refresh was attempted
    expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refresh_token: 'my-refresh-token',
    });
  });

  it('redirects to /login when no refresh token on 401', async () => {
    vi.resetModules();

    // Mock window.location
    const locationMock = { href: '' };
    Object.defineProperty(window, 'location', {
      value: locationMock,
      writable: true,
    });

    await import('./client');

    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const responseInterceptor = instance.interceptors.response.handlers[0];

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    try {
      await responseInterceptor.rejected(error);
    } catch {
      // Expected to reject
    }

    expect(window.location.href).toBe('/login');
  });

  it('passes through non-401 errors', async () => {
    vi.resetModules();
    await import('./client');

    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const responseInterceptor = instance.interceptors.response.handlers[0];

    const error = {
      config: {},
      response: { status: 500 },
    };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);
  });
});
