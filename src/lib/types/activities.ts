export type DepartmentType = 'sales' | 'construction' | 'accounting' | 'finance' | 'marketing' | 'hr' | 'office' | 'approvals';

export interface Activity {
  id: string;
  department: DepartmentType;
  type: string;
  title: string;
  description: string;
  date: string;
  timestamp: string;
  icon: string;
  color: string;
  status?: 'pending' | 'completed' | 'approved' | 'rejected';
  relatedId?: string;
  relatedLink?: string;
}

export interface DepartmentActivity {
  department: DepartmentType;
  departmentName: string;
  icon: string;
  color: string;
  activities: Activity[];
  count: number;
}

export interface ActivityStats {
  total: number;
  byDepartment: Record<DepartmentType, number>;
  today: number;
  pending: number;
}
