import { financePostHandler } from '@/lib/server/financeRoute';
import { recordPayment } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — record a payment or refund (docs/FINANCE.md §4.2). Allocation is
 * oldest-due-first; the remainder becomes avans. Body: RecordPaymentRequest.
 */
export const POST = financePostHandler('/api/manager/finance/payments', ({ uid, centerId }, body) =>
  recordPayment({
    centerId,
    uid,
    request: {
      studentId: body.studentId,
      amount: body.amount,
      type: body.type,
      method: body.method,
      paidAt: body.paidAt,
      note: body.note,
    },
  })
);
