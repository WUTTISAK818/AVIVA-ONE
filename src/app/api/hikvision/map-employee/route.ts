import { supabase } from '@/lib/supabase';

/**
 * POST /api/hikvision/map-employee
 * เชื่อมโยง Employee กับ Hikvision Person ID
 */
export async function POST(request: Request) {
  try {
    const { employee_id, hikvision_person_id } = await request.json();

    if (!employee_id || !hikvision_person_id) {
      return Response.json(
        { error: 'employee_id and hikvision_person_id are required' },
        { status: 400 }
      );
    }

    // Update employee
    const { data, error } = await supabase
      .from('employees')
      .update({ hikvision_person_id })
      .eq('id', employee_id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({
      success: true,
      data,
      message: `Mapped ${data.first_name} ${data.last_name} to Hikvision Person ${hikvision_person_id}`,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hikvision/map-employee
 * ดึงรายชื่อ employees ที่ mapped แล้ว
 */
export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, hikvision_person_id')
      .not('hikvision_person_id', 'is', null)
      .order('first_name');

    if (error) throw error;

    return Response.json({
      success: true,
      data,
      count: data?.length || 0,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hikvision/map-employee?employee_id=E001
 * ยกเลิกการเชื่อมโยง
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get('employee_id');

    if (!employee_id) {
      return Response.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('employees')
      .update({ hikvision_person_id: null })
      .eq('id', employee_id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({
      success: true,
      data,
      message: `Unmapped ${data.first_name} ${data.last_name}`,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
