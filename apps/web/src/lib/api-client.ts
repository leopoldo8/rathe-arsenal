import { useAuth } from '../auth/useAuth';
import i18n from '../i18n';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function useApiClient(): <T>(path: string, init?: RequestInit) => Promise<T> {
  const { token } = useAuth();
  return async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', i18n.language);
    // Default Content-Type to application/json only for serialised bodies.
    // FormData must be left untouched so the browser can attach the multipart
    // boundary; without that, multer/NestJS rejects the upload as malformed
    // and the request falls through to a 404 catch-all.
    if (
      init.body &&
      !headers.has('Content-Type') &&
      !(init.body instanceof FormData)
    ) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`/api${path}`, { ...init, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(response.status, text || response.statusText);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };
}
