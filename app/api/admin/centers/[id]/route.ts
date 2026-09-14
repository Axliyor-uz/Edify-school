import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Delete a query's docs in chunks of 400 (batch limit is 500 ops). Returns count. */
async function deleteByQuery(query: FirebaseFirestore.Query): Promise<number> {
  let total = 0;
  // Loop so re-runs after partial failures are safe (idempotent cleanup).
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

/** Fully remove one user: optionally their remaining classes (recursive), the
 *  users doc (recursive — takes private/contact with it), username reservation,
 *  and the Auth user. */
async function deleteUserAccount(uid: string, includeClasses: boolean): Promise<void> {
  if (includeClasses) {
    const classSnap = await adminDb.collection('classes').where('teacherId', '==', uid).get();
    for (const c of classSnap.docs) {
      await adminDb.recursiveDelete(c.ref);
    }
  }
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const username = userSnap.data()!.username;
    if (username) {
      await adminDb.collection('usernames').doc(String(username).toLowerCase()).delete().catch(() => {});
    }
    await adminDb.recursiveDelete(userRef);
  }
  await adminAuth.deleteUser(uid).catch((err: any) => {
    if (err?.code !== 'auth/user-not-found') throw err;
  });
}

/**
 * DELETE /api/admin/centers/[id] — cascade-delete a center and EVERYTHING it
 * owns (docs/ADMIN.md): attendance (student/staff/summaries), face
 * enrollments, rooms, CRM leads, all six finance collections, center groups
 * (classes.centerId — the membership anchor), teacher credentials + links,
 * optionally the center-created teacher accounts and the manager account.
 *
 * Body: { deleteManagerAccount?: boolean, deleteClasses?: boolean,
 *         deleteCreatedTeacherAccounts?: boolean }   (all default true)
 *
 * Linked SELF-SIGNUP teachers and their personal classes are never touched —
 * only accounts the center itself provisioned (accountType 'center-managed')
 * are deletable, because without their center they are unrecoverable (synthetic
 * email, manager-held password). Idempotent: center doc goes last, so a re-run
 * after a partial failure resumes cleanly.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const centerRef = adminDb.collection('centers').doc(centerId);
    const centerSnap = await centerRef.get();
    if (!centerSnap.exists) {
      return NextResponse.json({ error: 'Center not found.' }, { status: 404 });
    }
    const center = centerSnap.data()!;

    const body = await request.json().catch(() => ({}));
    const deleteManagerAccount = body?.deleteManagerAccount !== false; // default true
    const deleteClasses = body?.deleteClasses !== false; // default true
    const deleteCreatedTeacherAccounts = body?.deleteCreatedTeacherAccounts !== false; // default true

    const deletedCounts: Record<string, number> = {};
    const byCenter = (coll: string) => adminDb.collection(coll).where('centerId', '==', centerId);

    // 1. Attendance: student day docs, staff day docs, monthly rollups.
    deletedCounts['attendance days'] = await deleteByQuery(byCenter('center_attendance'));
    deletedCounts['staff attendance days'] = await deleteByQuery(byCenter('center_staff_attendance'));
    deletedCounts['attendance summaries'] = await deleteByQuery(byCenter('center_attendance_summary'));

    // 2. Face enrollments (biometric data — must not outlive the center).
    deletedCounts['face enrollments'] = await deleteByQuery(byCenter('face_enrollments'));

    // 3. Rooms + CRM leads.
    deletedCounts['rooms'] = await deleteByQuery(byCenter('rooms'));
    deletedCounts['crm leads'] = await deleteByQuery(byCenter('crm_leads'));

    // 4. Finance — all six collections (append-only in life, deletable only here).
    deletedCounts['finance profiles'] = await deleteByQuery(byCenter('center_student_finance'));
    deletedCounts['charges'] = await deleteByQuery(byCenter('center_charges'));
    deletedCounts['payments'] = await deleteByQuery(byCenter('center_payments'));
    deletedCounts['expenses'] = await deleteByQuery(byCenter('center_expenses'));
    deletedCounts['payouts'] = await deleteByQuery(byCenter('center_payouts'));
    await adminDb.collection('center_finance_settings').doc(centerId).delete().catch(() => {});

    // 5. Center groups (classes.centerId == center — the membership anchor).
    const classesSnap = await adminDb.collection('classes').where('centerId', '==', centerId).get();
    if (deleteClasses) {
      // recursiveDelete removes the class doc together with its subcollections
      // (assignments, exams, materials, requests, leaderboard).
      for (const classDoc of classesSnap.docs) {
        await adminDb.recursiveDelete(classDoc.ref);
      }
      deletedCounts['groups'] = classesSnap.size;
    } else if (classesSnap.size > 0) {
      const batch = adminDb.batch();
      classesSnap.docs.forEach((d) => batch.update(d.ref, { centerId: FieldValue.delete() }));
      await batch.commit();
      deletedCounts['groups detached'] = classesSnap.size;
    }

    // 5b. Center-managed IELTS twins (ielts_groups.centerId — see docs/IELTS.md).
    // Without this they would be orphaned AND unmanageable: the manager is gone,
    // the rules lock the teacher out of managed-group docs, and client delete is
    // blocked. Follow the deleteClasses choice: delete the pair member, or
    // detach it back into a personal teacher group (centerId/managed removed →
    // the teacher branch of the rules applies again; ielts_attempts are kept).
    const ieltsSnap = await adminDb.collection('ielts_groups').where('centerId', '==', centerId).get();
    if (deleteClasses) {
      for (const g of ieltsSnap.docs) {
        await adminDb.recursiveDelete(g.ref); // assignments + requests too
      }
      deletedCounts['ielts groups'] = ieltsSnap.size;
    } else if (ieltsSnap.size > 0) {
      const batch = adminDb.batch();
      ieltsSnap.docs.forEach((d) => batch.update(d.ref, {
        centerId: FieldValue.delete(),
        managed: FieldValue.delete(),
      }));
      await batch.commit();
      deletedCounts['ielts groups detached'] = ieltsSnap.size;
    }

    // 6. Center-created teacher accounts (accountType 'center-managed').
    // Unrecoverable without the center (synthetic email, manager-held
    // password), so default is delete. Self-signup teachers are NEVER touched.
    if (deleteCreatedTeacherAccounts) {
      const createdSnap = await adminDb
        .collection('users')
        .where('accountType', '==', 'center-managed')
        .where('centerId', '==', centerId)
        .get();
      for (const u of createdSnap.docs) {
        if (u.id === center.ownerUid) continue; // manager handled below
        // Their groups follow the deleteClasses choice (kept groups keep a
        // dead teacherId — reassignable by whoever adopts them).
        await deleteUserAccount(u.id, deleteClasses);
      }
      deletedCounts['created teacher accounts'] = createdSnap.size;
    }

    // 7. Teacher credentials + links (credentials of created accounts AND any
    // leftovers; links of every teacher, created or self-signup).
    deletedCounts['teacher credentials'] = await deleteByQuery(byCenter('center_teacher_credentials'));
    deletedCounts['teacher links'] = await deleteByQuery(byCenter('center_teachers'));

    // 7b. Student roster links + manager-held student credentials — without this
    // the deleted center's roster docs linger forever (the student ACCOUNTS are
    // never touched here; self-signup or center-created alike, they live on).
    deletedCounts['student links'] = await deleteByQuery(byCenter('center_students'));
    deletedCounts['student credentials'] = await deleteByQuery(byCenter('center_student_credentials'));

    // 8. Manager account (optional). recursiveDelete takes private/contact too.
    // Classes they might personally teach are left alone (historic behavior).
    if (deleteManagerAccount && center.ownerUid) {
      await deleteUserAccount(center.ownerUid, false);
      deletedCounts['manager account'] = 1;
    }

    // 9. The center doc itself, last — a re-run after partial failure still finds it.
    await centerRef.delete();

    return NextResponse.json({ ok: true, deletedCounts });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/admin/centers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete center. It is safe to retry.' }, { status: 500 });
  }
}
