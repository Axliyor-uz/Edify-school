import { financePostHandler } from '@/lib/server/financeRoute';
import { calculateEmployeePayroll } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — live employee payroll preview for a month (no writes). Body: { periodKey: "YYYY-MM" }. */
export const POST = financePostHandler('/api/manager/finance/payroll/employees/calculate', ({ centerId }, body) =>
  calculateEmployeePayroll({ centerId, periodKey: String(body.periodKey || '') }),
  { office: 'any' }
);
