import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireCenterTeacher, TeacherApiError } from '@/lib/server/verifyCenterTeacher';
import type { Payout, TeacherSalaryConfig } from '@/types/finance';

export const dynamic = 'force-dynamic';

// ─── Teacher self-service salary view ────────────────────────────────────────
// `center_payouts` is manager-only in firestore.rules (`list: isCenterManager`,
// `write: if false`) — docs/FINANCE.md forbids relaxing those list rules, and
// listing them client-side would expose every colleague's salary. A teacher sees
// their OWN salary through this Admin-SDK route instead: the uid comes purely
// from the verified token, so the caller can never read another teacher's pay.
//
// Read-only. All payroll writes stay on /api/manager/finance/* (iron rule #1).
//
// What is deliberately NOT returned: any un-approved amount. The manager's
// payroll screen recomputes live via `calculatePayroll`, which needs the whole
// center's revenue; running that here would leak other groups' money and would
// show the teacher a figure their manager has not agreed to. The teacher sees
// exactly what has been APPROVED (a persisted `center_payouts` doc) plus their
// own salary configuration — nothing speculative.

/** Only the teacher's own numbers — never other staff, never center totals. */
interface TeacherPayoutView {
  id: string;
  periodKey: string;
  breakdown: Payout['breakdown'];
  calculatedAmount: number;
  adjustment: number;
  adjustmentNote?: string;
  finalAmount: number;
  status: Payout['status'];
  paidAt?: string;
}

export async function GET(request: Request) {
  let uid: string;
  let centerId: string | null;
  try {
    ({ uid, centerId } = await requireCenterTeacher(request));
  } catch (e) {
    const err = e as TeacherApiError;
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  // Not linked to a center is the NORMAL case for most teachers — answer with an
  // empty payload so the UI renders its "not linked" state instead of an error.
  if (!centerId) return NextResponse.json({ linked: false });

  try {
    const [centerSnap, linkSnap, payoutSnap] = await Promise.all([
      adminDb.collection('centers').doc(centerId).get(),
      adminDb.collection('center_teachers').doc(uid).get(),
      // Equality-only query — served by the automatic single-field index.
      adminDb.collection('center_payouts').where('teacherId', '==', uid).get(),
    ]);

    const salary = (linkSnap.data()?.salary || {}) as TeacherSalaryConfig;

    const payouts: TeacherPayoutView[] = payoutSnap.docs
      // Belt-and-braces: a teacher moved between centers must not see the old
      // center's payouts through their new link.
      .filter((d) => d.data().centerId === centerId)
      .map((d) => {
        const p = d.data() as Payout;
        return {
          id: d.id,
          periodKey: p.periodKey || '',
          breakdown: p.breakdown,
          calculatedAmount: p.calculatedAmount || 0,
          adjustment: p.adjustment || 0,
          ...(p.adjustmentNote ? { adjustmentNote: p.adjustmentNote } : {}),
          finalAmount: p.finalAmount || 0,
          status: p.status || 'approved',
          ...(p.paidAt ? { paidAt: p.paidAt } : {}),
        };
      })
      .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));

    return NextResponse.json({
      linked: true,
      centerId,
      centerName: centerSnap.exists ? centerSnap.data()?.name || '' : '',
      salary,
      payouts,
      totalPaid: payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.finalAmount, 0),
    });
  } catch (e) {
    console.error('teacher payroll read failed', e);
    return NextResponse.json({ error: "Oylik ma'lumotlarini yuklab bo'lmadi." }, { status: 500 });
  }
}
