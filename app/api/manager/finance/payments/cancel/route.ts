import { financePostHandler } from '@/lib/server/financeRoute';
import { cancelPayment } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — cancel a payment: reverses its allocations and the balance. Body: { paymentId, reason }. */
export const POST = financePostHandler('/api/manager/finance/payments/cancel', ({ uid, centerId }, body) =>
  cancelPayment({ centerId, uid, paymentId: String(body.paymentId || ''), reason: body.reason }),
  // Money is append-only: cancel + re-enter IS the correction path (FINANCE.md
  // §4.3), so an accountant who may record must also be able to reverse their
  // own typo. The reversal is audited with their uid.
  { office: 'accountant' }
);
