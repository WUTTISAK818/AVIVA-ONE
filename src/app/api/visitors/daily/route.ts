import { getVisitorsByDate } from '@/lib/cctv-service';

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

    const result = await getVisitorsByDate(date);

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
