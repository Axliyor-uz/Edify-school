import { financePostHandler } from '@/lib/server/financeRoute';
import { waiveCharge } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — forgive a charge's unpaid remainder. Body: { chargeId, reason }. */
export const POST = financePostHandler('/api/manager/finance/charges/waive', ({ uid, centerId }, body) =>
  waiveCharge({ centerId, uid, chargeId: String(body.chargeId || ''), reason: body.reason })
);
