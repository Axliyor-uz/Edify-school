import { financePostHandler } from '@/lib/server/financeRoute';
import { cancelCharge } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — cancel an untouched (paidAmount == 0) charge. Body: { chargeId, reason }. */
export const POST = financePostHandler('/api/manager/finance/charges/cancel', ({ uid, centerId }, body) =>
  cancelCharge({ centerId, uid, chargeId: String(body.chargeId || ''), reason: body.reason })
);
