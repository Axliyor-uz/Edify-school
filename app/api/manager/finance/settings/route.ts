import { financePostHandler } from '@/lib/server/financeRoute';
import { upsertSettings } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — upsert center finance settings. Body: partial FinanceSettings. */
export const POST = financePostHandler('/api/manager/finance/settings', ({ centerId }, body) =>
  upsertSettings(centerId, body)
);
