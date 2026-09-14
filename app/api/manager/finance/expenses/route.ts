import { financePostHandler } from '@/lib/server/financeRoute';
import { createExpense } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — record an expense. Body: { category, amount, date?, note? }. */
export const POST = financePostHandler('/api/manager/finance/expenses', ({ uid, centerId }, body) =>
  createExpense({
    centerId,
    uid,
    category: body.category,
    amount: body.amount,
    date: body.date,
    note: body.note,
  })
);
