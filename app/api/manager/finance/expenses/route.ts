import { financePostHandler } from '@/lib/server/financeRoute';
import { createExpense } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — record an expense. Body: { category, amount, date?, note?, method?, methodSplit? }. */
export const POST = financePostHandler('/api/manager/finance/expenses', ({ uid, centerId, callerRole }, body) =>
  createExpense({
    centerId,
    uid,
    callerRole,
    category: body.category,
    amount: body.amount,
    date: body.date,
    note: body.note,
    method: body.method,
    methodSplit: body.methodSplit,
  }),
  { office: 'accountant' }
);
