// services/parentLinkService.ts
//
// The manager panel's client for **parent access** (docs/PARENTS.md).
//
// ⚠️ **Every call goes through the API — there is no client-SDK path, and there
// must never be one.** `parent_links` is `read, write: if false` in
// firestore.rules: the document id is the parent's credential, so a browser that
// could list the collection could open every family's report in the center.

import { managerApiFetch } from '@/lib/managerApi';
import type { ParentLink, ParentScope } from '@/types/Parent';

/** Every link this center has issued, newest first. */
export const fetchParentLinks = (studentId?: string) =>
  managerApiFetch<{ links: ParentLink[] }>(
    `/api/manager/parent-links${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`,
  ).then((r) => r.links || []);

/**
 * Issue a QR for one student.
 *
 * ⚠️ **Destructive when the child already has a live link**: the server revokes
 * it in the same batch, because one child means one connected person. `replaced`
 * says how many died so the caller can say so.
 */
export const createParentLink = (body: { studentId: string; label?: string; scope?: ParentScope }) =>
  managerApiFetch<{ link: ParentLink; replaced: number }>('/api/manager/parent-links', {
    method: 'POST',
    body,
  });

/**
 * Revoke / restore / re-label / re-scope / **unbind the device**.
 *
 * ⚠️ `studentId` can never be patched. `unbind: true` frees the SAME QR to be
 * claimed by a new phone — the fix for "the parent changed their device".
 */
export const patchParentLink = (
  token: string,
  patch: { status?: 'active' | 'revoked'; label?: string; scope?: ParentScope; unbind?: boolean },
) =>
  managerApiFetch<{ link: ParentLink }>(`/api/manager/parent-links/${token}`, {
    method: 'PATCH',
    body: patch,
  }).then((r) => r.link);
