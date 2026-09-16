import { financePostHandler } from '@/lib/server/financeRoute';
import { updateEmployeeSalary } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — set an employee's salary config. Body: { employeeId, config: { fixed?, hourlyRate?, allowances?, deductions? } } (null clears fixed/hourlyRate). */
export const POST = financePostHandler('/api/manager/finance/employee-salary', ({ uid, centerId }, body) =>
  updateEmployeeSalary({
    centerId,
    uid,
    employeeId: String(body.employeeId || ''),
    config: body.config || {},
  })
);
