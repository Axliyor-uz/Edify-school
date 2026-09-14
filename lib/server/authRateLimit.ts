// Minimal in-memory per-IP throttle for the public auth routes
// (/api/auth/*). Each serverless instance keeps its own window, so this is
// only a first line of defense — Firebase's per-account lockout inside
// accounts:signInWithPassword is the real brute-force guarantee.
const windows = new Map<string, number[]>();

export function checkAuthRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (windows.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    windows.set(key, hits);
    return false;
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 10_000) {
    for (const [k, v] of windows) {
      if (v.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return true;
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
