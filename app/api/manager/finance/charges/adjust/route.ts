import { financePostHandler } from '@/lib/server/financeRoute';
import { adjustCharge } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — change the amount of an untouched charge. Body: { chargeId, amount, note? }. */
export const POST = financePostHandler('/api/manager/finance/charges/adjust', ({ uid, centerId }, body) =>
  adjustCharge({
    centerId,
    uid,
    chargeId: String(body.chargeId || ''),
    amount: body.amount,
    note: body.note,
  })
);
