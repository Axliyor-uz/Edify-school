import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

// ─── Student self-service finance view ───────────────────────────────────────
// Finance collections are manager-only in firestore.rules on purpose (payments
// are the most sensitive data in the app — docs/FINANCE.md forbids relaxing
// those list rules). A student sees their OWN balance/charges/payments through
// this Admin-SDK route instead: the uid comes exclusively from the verified
// token, so the caller can never read another student's money.
//
// Read-only. All writes stay on /api/manager/finance/* (iron rule #1).

export async function GET(request: Request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Which centers is this student on the roster of?
    const links = await adminDb.collection('center_students').where('studentId', '==', uid).get();
    const centerIds = [...new Set(links.docs.map((d) => d.data().centerId as string).filter(Boolean))];
    if (centerIds.length === 0) return NextResponse.json({ centers: [] });

    const centers = await Promise.all(centerIds.map(async (centerId) => {
      const [centerSnap, profileSnap, chargesSnap, paymentsSnap] = await Promise.all([
        adminDb.collection('centers').doc(centerId).get(),
        adminDb.collection('center_student_finance').doc(`${centerId}_${uid}`).get(),
        adminDb.collection('center_charges')
          .where('centerId', '==', centerId).where('studentId', '==', uid).get(),
        adminDb.collection('center_payments')
          .where('centerId', '==', centerId).where('studentId', '==', uid).get(),
      ]);

      const profile = profileSnap.exists ? profileSnap.data()! : null;

      const charges = chargesSnap.docs
        .map((d) => {
          const c = d.data();
          return {
            id: d.id,
            classTitle: c.classTitle || '',
            periodKey: c.periodKey || '',
            amount: c.amount || 0,
            paidAmount: c.paidAmount || 0,
            status: c.status || 'pending',
            dueDate: c.dueDate || null,
          };
        })
        .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));

      const payments = paymentsSnap.docs
        .map((d) => {
          const p = d.data();
          return {
            id: d.id,
            type: p.type || 'payment',
            amount: p.amount || 0,
            method: p.method || 'other',
            status: p.status || 'confirmed',
            paidAt: p.paidAt || null,
          };
        })
        .sort((a, b) => (String(a.paidAt) < String(b.paidAt) ? 1 : -1));

      return {
        centerId,
        centerName: centerSnap.exists ? centerSnap.data()?.name || '' : '',
        balance: profile?.balance ?? 0,
        financeStatus: profile?.financeStatus ?? 'active',
        discountPercent: profile?.discountPercent ?? 0,
        charges,
        payments,
      };
    }));

    return NextResponse.json({ centers });
  } catch (e) {
    console.error('student finance read failed', e);
    return NextResponse.json({ error: 'Failed to load finance data' }, { status: 500 });
  }
}
