/**
 * Fetch wrapper for /api/manager/* routes. Same mechanics as the admin one
 * (Bearer ID token + normalized JSON errors), re-exported under the right name.
 */
export { adminApiFetch as managerApiFetch } from './adminApi';
