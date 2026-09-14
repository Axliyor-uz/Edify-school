import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * Thrown when the caller of an /api/admin/* route is not a verified super admin.
 * `status` maps directly to the HTTP status the route should respond with.
 */
export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Authorization: Bearer <idToken> header and requires the
 * `super_admin` custom claim. Returns the caller's uid.
 * Every route under app/api/admin/* must call this before doing anything.
 */
export async function requireSuperAdmin(request: Request): Promise<string> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new AdminAuthError('Missing Authorization bearer token.', 401);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new AdminAuthError('Invalid or expired token.', 401);
  }

  if (decoded.super_admin !== true) {
    throw new AdminAuthError('Super admin privileges required.', 403);
  }

  return decoded.uid;
}
