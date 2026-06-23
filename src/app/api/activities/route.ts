import { getAllActivitiesToday } from '@/lib/activities-service';

export async function GET() {
  try {
    const activities = await getAllActivitiesToday();
    return Response.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
