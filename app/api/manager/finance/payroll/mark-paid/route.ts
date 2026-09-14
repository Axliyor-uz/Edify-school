import { financePostHandler } from '@/lib/server/financeRoute';
import { markPayoutPaid } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — mark an approved payout as paid; atomically creates the linked salary expense. Body: { payoutId }. */
export const POST = financePostHandler('/api/manager/finance/payroll/mark-paid', ({ uid, centerId }, body) =>
  markPayoutPaid({ centerId, uid, payoutId: String(body.payoutId || '') })
);
