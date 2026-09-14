import { financePostHandler } from '@/lib/server/financeRoute';
import { cancelPayment } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — cancel a payment: reverses its allocations and the balance. Body: { paymentId, reason }. */
export const POST = financePostHandler('/api/manager/finance/payments/cancel', ({ uid, centerId }, body) =>
  cancelPayment({ centerId, uid, paymentId: String(body.paymentId || ''), reason: body.reason })
);
