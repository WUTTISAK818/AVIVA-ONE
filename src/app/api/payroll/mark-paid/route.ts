import { markPayrollAsPaid } from '@/lib/attendance-service';

export async function POST(request: Request) {
  try {
    const { payroll_id, payment_reference } = await request.json();

    if (!payroll_id) {
      return Response.json(
        { error: 'payroll_id is required' },
        { status: 400 }
      );
    }

    const result = await markPayrollAsPaid(payroll_id, payment_reference);

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
