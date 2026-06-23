import { calculateMonthlyPayroll, getMonthlyPayrollSummary } from '@/lib/attendance-service';

export async function POST(request: Request) {
  try {
    const { month, year, employee_id } = await request.json();

    if (!month || !year) {
      return Response.json(
        { error: 'month and year are required' },
        { status: 400 }
      );
    }

    if (employee_id) {
      // Calculate for single employee
      const result = await calculateMonthlyPayroll({ month, year, employee_id });

      if (!result.ok) {
        return Response.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return Response.json({ success: true, data: result.data });
    } else {
      // Calculate for all employees
      const summary = await getMonthlyPayrollSummary(year, month);

      if (!summary.ok) {
        return Response.json(
          { error: summary.error },
          { status: 400 }
        );
      }

      return Response.json({ success: true, data: summary.data, details: summary.details });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
