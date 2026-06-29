import { getAllShifts, setEmployeeShift } from '@/lib/shift-service';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const result = await getAllShifts();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get user from Authorization header (bearer token from request)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employee_id, shift_name, start_time, end_time, grace_period_minutes, break_duration_minutes, working_days, effective_date, notes } = await request.json();

    if (!employee_id || !start_time || !end_time) {
      return Response.json(
        { error: 'Missing required fields: employee_id, start_time, end_time' },
        { status: 400 }
      );
    }

    const result = await setEmployeeShift(
      employee_id,
      {
        employee_id,
        shift_name: shift_name || 'Standard',
        start_time,
        end_time,
        grace_period_minutes: grace_period_minutes || 15,
        break_duration_minutes: break_duration_minutes || 60,
        working_days: working_days || 'Mon,Tue,Wed,Thu,Fri',
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        notes: notes || '',
        set_by_user_id: user.id,
      } as any,
      user.id
    );

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
