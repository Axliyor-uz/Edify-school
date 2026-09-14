import { financePostHandler } from '@/lib/server/financeRoute';
import { generateCharges } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — idempotent charge generation (docs/FINANCE.md §4.1).
 * Body: { periodKey?: "YYYY-MM", dryRun?: boolean }. dryRun returns the preview
 * the banner shows; the real run creates only the still-missing charges.
 */
export const POST = financePostHandler('/api/manager/finance/charges/generate', ({ uid, centerId }, body) =>
  generateCharges({
    centerId,
    uid,
    periodKey: typeof body.periodKey === 'string' ? body.periodKey : undefined,
    dryRun: !!body.dryRun,
  })
);
