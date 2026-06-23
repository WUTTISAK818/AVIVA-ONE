import { generateDailySummary, getCCTVEventsByDate } from '@/lib/cctv-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return Response.json(
        { error: 'date parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Generate summary if needed
    const summaryResult = await generateDailySummary(date);

    // Get all events for this date
    const eventsResult = await getCCTVEventsByDate(date);

    if (!summaryResult.ok) {
      return Response.json(
        { error: summaryResult.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      data: summaryResult.data,
      events: eventsResult.ok ? eventsResult.data : [],
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
