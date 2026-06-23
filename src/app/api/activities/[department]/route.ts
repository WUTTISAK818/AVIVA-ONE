import { getActivitiesByDepartment } from '@/lib/activities-service';
import { DepartmentType } from '@/lib/types/activities';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    const { department } = await params;
    const dept = department as DepartmentType;
    const activities = await getActivitiesByDepartment(dept);

    return Response.json({
      success: true,
      department: dept,
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
