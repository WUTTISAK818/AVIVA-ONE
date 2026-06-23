import { recordCheckIn } from '@/lib/attendance-service';

export async function POST(request: Request) {
  try {
    const { employee_id, device_id } = await request.json();

    if (!employee_id) {
      return Response.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    const result = await recordCheckIn(employee_id, device_id);

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
