// app/api/manager/parent-links/[token]/route.ts
//
// Revoke / restore / re-label / re-scope ONE issued parent QR (docs/PARENTS.md).
//
// ⚠️ **Revoke is the whole point of the feature.** The link is a bearer
// credential with no login behind it, so "the parent changed phone", "the QR was
// photographed", "the family left the center" and "we printed the wrong child"
// all have exactly one remedy, and it lives here.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';
import { cleanParentLabel, isParentToken, normalizeParentScope } from '@/lib/parentLinks';
import type { ParentLink } from '@/types/Parent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/manager/parent-links/[token]
 *
 * Body: `{ status?: 'active'|'revoked', label?, scope? }` — every field optional,
 * an omitted one is left alone.
 *
 * ⚠️ **`studentId`, `centerId` and the token itself are NOT patchable.** Re-pointing
 * a live QR at another child would silently show one family another family's
 * report on a link they already hold — the only way to a different student is a
 * new link, which is a new QR the manager must physically hand over.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { centerId } = await requireActiveCenterManager(request);
    const { token } = await params;

    if (!isParentToken(token)) throw new ManagerApiError('Havola topilmadi.', 404);

    const ref = adminDb.collection('parent_links').doc(token);
    const snap = await ref.get();
    if (!snap.exists) throw new ManagerApiError('Havola topilmadi.', 404);

    const link = snap.data() as ParentLink;
    // ⚠️ The ownership check is the centerId ON THE DOCUMENT, not anything the
    // caller sent: without it any active manager could revoke — or silently
    // widen the scope of — another center's links by guessing nothing at all,
    // since the token would come straight from the URL they were given.
    if (link.centerId !== centerId) throw new ManagerApiError('Havola topilmadi.', 404);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ManagerApiError("Noto'g'ri so'rov.", 400);

    const patch: Record<string, unknown> = {};

    /**
     * ⚠️ **Unbind = "this parent changed phone".**
     *
     * The link is claimed by the first browser that opens it, so a parent who
     * replaced their phone, cleared their browser or was sent the QR by mistake
     * would otherwise be locked out forever. Clearing the device fields makes the
     * SAME printed QR claimable again — no reprint, no new card to hand over,
     * and still exactly one connected device afterwards.
     *
     * ⚠️ It is also how a manager takes access away from the wrong person
     * WITHOUT killing the card: unbind, then hand the same QR to the right one.
     */
    if (body.unbind === true) {
      patch.deviceHash = FieldValue.delete();
      patch.claimedAt = FieldValue.delete();
      patch.claimedDevice = FieldValue.delete();
    }

    if (body.status === 'revoked' || body.status === 'active') {
      patch.status = body.status;
      if (body.status === 'revoked') patch.revokedAt = Date.now();
    }

    // ⚠️ Restoring a revoked link must not give a child TWO connected people —
    // the same rule POST enforces. Every other live link for this student is
    // revoked in the same write.
    let replaced = 0;
    if (body.status === 'active' && link.status !== 'active') {
      const others = await adminDb
        .collection('parent_links')
        .where('centerId', '==', centerId)
        .where('studentId', '==', link.studentId)
        .where('status', '==', 'active')
        .get();

      const batch = adminDb.batch();
      for (const doc of others.docs) {
        if (doc.id === token) continue;
        batch.update(doc.ref, { status: 'revoked', revokedAt: Date.now() });
        replaced += 1;
      }
      if (replaced > 0) await batch.commit();
    }
    if (typeof body.label === 'string') patch.label = cleanParentLabel(body.label);
    // ⚠️ The scope is normalized whole, never merged key-by-key: a client that
    // sends `{finance: true}` alone must not be able to leave the other flags in
    // whatever state they were, and an unknown key must not survive at all.
    if (body.scope && typeof body.scope === 'object') patch.scope = normalizeParentScope(body.scope);

    if (Object.keys(patch).length === 0) throw new ManagerApiError("O'zgarish yo'q.", 400);

    await ref.update(patch);

    // Re-read rather than merging the patch in memory: `unbind` writes
    // FieldValue.delete() sentinels, which are not values the client can render.
    const updated = await ref.get();
    return NextResponse.json({ link: { ...(updated.data() as ParentLink), token }, replaced });
  } catch (err) {
    const e = err as ManagerApiError;
    return NextResponse.json({ error: e.message || 'Xatolik.' }, { status: e.status || 500 });
  }
}
