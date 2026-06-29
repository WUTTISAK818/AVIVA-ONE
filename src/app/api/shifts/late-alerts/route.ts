import { getLateAlertsToday } from '@/lib/shift-service';

export async function GET() {
  try {
    const result = await getLateAlertsToday();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      data: result.data,
      count: result.data?.length || 0,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
