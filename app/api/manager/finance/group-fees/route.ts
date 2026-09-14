import { financePostHandler } from '@/lib/server/financeRoute';
import { updateGroupFees } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — batch-set group monthly prices. Body: { fees: { [classId]: number } }. */
export const POST = financePostHandler('/api/manager/finance/group-fees', ({ centerId }, body) =>
  updateGroupFees({ centerId, fees: body.fees || {} })
);
