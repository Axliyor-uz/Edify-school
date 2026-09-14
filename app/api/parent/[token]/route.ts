// app/api/parent/[token]/route.ts
//
// **The one public, unauthenticated read in this codebase.** A parent scans a QR,
// their browser calls this with the token, and gets back exactly `ParentReport`
// (docs/PARENTS.md).
//
// ⚠️ Everything protective about this feature is in this file and in
// `lib/server/parentReport.ts`: there is no `request.auth`, so no Firestore rule
// can help. The checks, in order, are
//   1. the token's SHAPE (before any database call at all),
//   2. an in-memory rate limit (the URL is public and refreshable),
//   3. the link existing and being `active`,
//   4. **the device claim — one link, one person**,
//   5. the scope, which decides what is even fetched.
// Removing any one of them removes a security property, not a convenience.

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { buildParentReport, claimParentLink, hashParentDevice } from '@/lib/server/parentReport';
import {
  PARENT_DEVICE_HEADER,
  PARENT_REPORT_TTL_MS,
  isParentDeviceSecret,
  isParentToken,
} from '@/lib/parentLinks';
import type { ParentReport } from '@/types/Parent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-token cache and rate limit.
 *
 * ⚠️ **Per server INSTANCE, deliberately not Firestore.** A shared counter would
 * cost a write per page view to defend against page views, which is the wrong
 * trade: the point here is that one parent hammering refresh cannot turn into
 * hundreds of document reads a second. A determined attacker with the token AND
 * the device secret already has the report — this is a cost guard, not an access
 * control.
 *
 * ⚠️ The cached entry carries the `deviceHash` it was built under, so a cache hit
 * still proves the device (below). Caching a report that any device could then
 * read would undo the claim.
 */
const cache = new Map<string, { at: number; report: ParentReport; deviceHash: string }>();
const hits = new Map<string, { windowStart: number; count: number }>();

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
/** Keep the maps from growing without bound on a long-lived instance. */
const CACHE_MAX_ENTRIES = 500;

function rateLimited(token: string): boolean {
  const now = Date.now();
  const entry = hits.get(token);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    hits.set(token, { windowStart: now, count: 1 });
    if (hits.size > CACHE_MAX_ENTRIES) hits.clear();
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_MAX;
}

/**
 * GET /api/parent/[token]
 *
 * Header `x-parent-device: <secret>` — present once this browser has claimed the
 * link; absent on the very first open, which is what claims it.
 *
 * 404 unknown · 410 revoked · **409 claimed by another device** · 429 too many ·
 * 200 the report (with `device` set on the first claim, the one time the secret
 * is ever sent).
 *
 * ⚠️ **404, 409 and 410 are three different answers on purpose.** "Wrong code"
 * makes a parent retype forever; "already connected to another phone" makes them
 * ask the center to move it; "access was closed" makes them phone the center.
 * Collapsing them into one error would be a support burden disguised as tidiness.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Shape first: a document id comes straight from the URL here, so junk must
  // never reach Firestore.
  if (!isParentToken(token)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (rateLimited(token)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const presented = request.headers.get(PARENT_DEVICE_HEADER);
  const secret = isParentDeviceSecret(presented) ? presented : null;

  try {
    // ⚠️ The cache is consulted only by a device that can prove itself against
    // the hash the entry was built under. A first-open (no secret) always falls
    // through to the transaction — that is what performs the claim.
    const cached = cache.get(token);
    if (
      cached &&
      Date.now() - cached.at < PARENT_REPORT_TTL_MS &&
      secret &&
      hashParentDevice(secret) === cached.deviceHash
    ) {
      return NextResponse.json({ report: cached.report, cached: true });
    }

    const claim = await claimParentLink(token, secret, request.headers.get('user-agent') || '');
    if (!claim.ok) {
      const status = claim.reason === 'not_found' ? 404 : claim.reason === 'revoked' ? 410 : 409;
      return NextResponse.json({ error: claim.reason }, { status });
    }

    const report = await buildParentReport(claim.link);

    if (cache.size > CACHE_MAX_ENTRIES) cache.clear();
    // `claim.link.deviceHash` is set for a returning device; on a first claim the
    // hash of the freshly minted secret is what the next request will present.
    const deviceHash = claim.secret ? hashParentDevice(claim.secret) : claim.link.deviceHash!;
    cache.set(token, { at: Date.now(), report, deviceHash });

    // The audit trail the manager reads ("last opened"). ⚠️ Fire-and-forget: a
    // parent must still get their child's report if the counter write fails, and
    // it must not add latency.
    adminDb
      .collection('parent_links')
      .doc(token)
      .update({
        lastViewedAt: Date.now(),
        viewCount: (claim.link.viewCount || 0) + 1,
      })
      .catch(() => {});

    // ⚠️ `device` is returned ONLY on the claiming request — the one moment the
    // secret exists outside the browser that will keep it.
    return NextResponse.json({ report, ...(claim.secret ? { device: claim.secret } : {}) });
  } catch (err) {
    console.error('[parent-report]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
