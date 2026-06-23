import { Activity, DepartmentType } from './types/activities';
import { getSupabase } from '@/lib/supabase';

export async function getActivitiesByDepartment(department: DepartmentType): Promise<Activity[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  try {
    switch (department) {
      case 'sales':
        return await getSalesActivities(supabase, today);
      case 'construction':
        return await getConstructionActivities(supabase, today);
      case 'accounting':
        return await getAccountingActivities(supabase, today);
      case 'finance':
        return await getFinanceActivities(supabase, today);
      case 'marketing':
        return await getMarketingActivities(supabase, today);
      case 'hr':
        return await getHRActivities(supabase, today);
      case 'office':
        return await getOfficeActivities(supabase, today);
      case 'approvals':
        return await getApprovalsActivities(supabase, today);
      default:
        return [];
    }
  } catch (err) {
    console.error(`Error fetching ${department} activities:`, err);
    return [];
  }
}

async function getSalesActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: customers } = await supabase
      .from('crm_customers')
      .select('id, name, company, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });

    if (customers) {
      activities.push(...customers.map((c: any) => ({
        id: `customer-${c.id}`,
        department: 'sales' as DepartmentType,
        type: 'customer',
        title: `ลูกค้าใหม่: ${c.name}`,
        description: c.company || 'ไม่ระบุบริษัท',
        date: new Date(c.created_at).toLocaleDateString('th-TH'),
        timestamp: c.created_at,
        icon: '🎯',
        color: 'text-green-400',
      })));
    }
  } catch (e) {
    console.warn('crm_customers table not found');
  }

  try {
    const { data: leads } = await supabase
      .from('crm_leads')
      .select('id, title, created_at, status')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });

    if (leads) {
      activities.push(...leads.map((l: any) => ({
        id: `lead-${l.id}`,
        department: 'sales' as DepartmentType,
        type: 'lead',
        title: `Lead ใหม่: ${l.title}`,
        description: `สถานะ: ${l.status}`,
        date: new Date(l.created_at).toLocaleDateString('th-TH'),
        timestamp: l.created_at,
        icon: '📝',
        color: 'text-green-300',
      })));
    }
  } catch (e) {
    console.warn('crm_leads table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getConstructionActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: insts } = await supabase
      .from('construction_insts')
      .select('id, project_name, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (insts) {
      activities.push(...insts.map((inst: any) => ({
        id: `inst-${inst.id}`,
        department: 'construction' as DepartmentType,
        type: 'inst',
        title: `งวดงาน: ${inst.project_name}`,
        description: `สถานะ: ${inst.status}`,
        date: new Date(inst.created_at).toLocaleDateString('th-TH'),
        timestamp: inst.created_at,
        icon: '🏗️',
        color: 'text-orange-400',
      })));
    }
  } catch (e) {
    console.warn('construction_insts table not found');
  }

  try {
    const { data: defects } = await supabase
      .from('construction_defects')
      .select('id, title, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (defects) {
      activities.push(...defects.map((d: any) => ({
        id: `defect-${d.id}`,
        department: 'construction' as DepartmentType,
        type: 'defect',
        title: `ปัญหา/ข้อบกพร่อง: ${d.title}`,
        description: `สถานะ: ${d.status}`,
        date: new Date(d.created_at).toLocaleDateString('th-TH'),
        timestamp: d.created_at,
        icon: '⚠️',
        color: 'text-red-400',
      })));
    }
  } catch (e) {
    console.warn('construction_defects table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getAccountingActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (pos) {
      activities.push(...pos.map((po: any) => ({
        id: `po-${po.id}`,
        department: 'accounting' as DepartmentType,
        type: 'po',
        title: `ใบสั่งซื้อ: ${po.po_number}`,
        description: `สถานะ: ${po.status}`,
        date: new Date(po.created_at).toLocaleDateString('th-TH'),
        timestamp: po.created_at,
        icon: '🛒',
        color: 'text-blue-400',
      })));
    }
  } catch (e) {
    console.warn('purchase_orders table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getFinanceActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: payrolls } = await supabase
      .from('payroll_records')
      .select('id, employee_id, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (payrolls) {
      activities.push(...payrolls.map((p: any) => ({
        id: `payroll-${p.id}`,
        department: 'finance' as DepartmentType,
        type: 'payroll',
        title: `เงินเดือน: Employee ${p.employee_id}`,
        description: `สถานะ: ${p.status}`,
        date: new Date(p.created_at).toLocaleDateString('th-TH'),
        timestamp: p.created_at,
        icon: '💰',
        color: 'text-yellow-400',
      })));
    }
  } catch (e) {
    console.warn('payroll_records table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getMarketingActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('id, name, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (campaigns) {
      activities.push(...campaigns.map((c: any) => ({
        id: `campaign-${c.id}`,
        department: 'marketing' as DepartmentType,
        type: 'campaign',
        title: `Campaign: ${c.name}`,
        description: `สถานะ: ${c.status}`,
        date: new Date(c.created_at).toLocaleDateString('th-TH'),
        timestamp: c.created_at,
        icon: '📢',
        color: 'text-pink-400',
      })));
    }
  } catch (e) {
    console.warn('marketing_campaigns table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getHRActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('id, employee_id, type, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (leaves) {
      activities.push(...leaves.map((l: any) => ({
        id: `leave-${l.id}`,
        department: 'hr' as DepartmentType,
        type: 'leave',
        title: `ขออนุมัติลา: ${l.type}`,
        description: `Employee: ${l.employee_id}`,
        date: new Date(l.created_at).toLocaleDateString('th-TH'),
        timestamp: l.created_at,
        icon: '🗓️',
        color: 'text-blue-300',
      })));
    }
  } catch (e) {
    console.warn('leave_requests table not found');
  }

  try {
    const { data: attendance } = await supabase
      .from('attendance_records')
      .select('id, employee_id, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (attendance) {
      activities.push(...attendance.map((a: any) => ({
        id: `attendance-${a.id}`,
        department: 'hr' as DepartmentType,
        type: 'attendance',
        title: `ลงเวลา: ${a.status}`,
        description: `Employee: ${a.employee_id}`,
        date: new Date(a.created_at).toLocaleDateString('th-TH'),
        timestamp: a.created_at,
        icon: '⏰',
        color: 'text-cyan-400',
      })));
    }
  } catch (e) {
    console.warn('attendance_records table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getOfficeActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: docs } = await supabase
      .from('office_documents')
      .select('id, doc_number, type, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (docs) {
      activities.push(...docs.map((d: any) => ({
        id: `doc-${d.id}`,
        department: 'office' as DepartmentType,
        type: 'document',
        title: `เอกสาร: ${d.doc_number}`,
        description: `ประเภท: ${d.type}`,
        date: new Date(d.created_at).toLocaleDateString('th-TH'),
        timestamp: d.created_at,
        icon: '📄',
        color: 'text-purple-400',
      })));
    }
  } catch (e) {
    console.warn('office_documents table not found');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getApprovalsActivities(supabase: any, today: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    const { data: pendingApprovals } = await supabase
      .from('approval_workflow')
      .select('id, doc_type, doc_id, status, created_at')
      .eq('status', 'pending')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(15);

    if (pendingApprovals) {
      activities.push(...pendingApprovals.map((a: any) => ({
        id: `approval-${a.id}`,
        department: 'approvals' as DepartmentType,
        type: 'approval',
        title: `รอการอนุมัติ: ${a.doc_type.toUpperCase()} #${a.doc_id}`,
        description: `สถานะ: ${a.status}`,
        date: new Date(a.created_at).toLocaleDateString('th-TH'),
        timestamp: a.created_at,
        icon: '✅',
        color: 'text-yellow-500',
        status: 'pending',
      })));
    }
  } catch (e) {
    console.warn('approval_workflow table not found or no pending approvals');
  }

  try {
    const { data: approvedToday } = await supabase
      .from('approval_workflow')
      .select('id, doc_type, doc_id, updated_at')
      .eq('status', 'approved')
      .gte('updated_at', `${today}T00:00:00`)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (approvedToday) {
      activities.push(...approvedToday.map((a: any) => ({
        id: `approved-${a.id}`,
        department: 'approvals' as DepartmentType,
        type: 'approved',
        title: `อนุมัติแล้ว: ${a.doc_type.toUpperCase()} #${a.doc_id}`,
        description: 'เสร็จสิ้น',
        date: new Date(a.updated_at).toLocaleDateString('th-TH'),
        timestamp: a.updated_at,
        icon: '✔️',
        color: 'text-green-500',
        status: 'approved',
      })));
    }
  } catch (e) {
    console.warn('approval_workflow table not found or no approved records');
  }

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getAllActivitiesToday(): Promise<Activity[]> {
  const departments: DepartmentType[] = ['sales', 'construction', 'accounting', 'finance', 'marketing', 'hr', 'office', 'approvals'];
  const allActivities: Activity[] = [];

  for (const dept of departments) {
    const activities = await getActivitiesByDepartment(dept);
    allActivities.push(...activities);
  }

  return allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
