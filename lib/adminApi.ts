import { auth } from '@/lib/firebase';

/**
 * Fetch wrapper for /api/admin/* routes: attaches the current user's ID token
 * and normalizes JSON error responses into thrown Errors (message surfaced in toasts).
 */
export async function adminApiFetch<T = any>(
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated.');

  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response body
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }
  return data as T;
}
