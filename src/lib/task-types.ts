export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  assigned_to: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  due_date?: string;
  started_date?: string;
  completed_date?: string;
  approved_date?: string;
  progress_pct: number;
  expected_complete_date?: string;
  related_commits?: string[];
  related_pr_url?: string;
  developer_notes?: string;
  manager_notes?: string;
  department?: string;
  category?: string;
  estimated_hours?: number;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface TaskHistory {
  id: string;
  task_id: string;
  changed_by: string;
  field_name: string;
  old_value?: string;
  new_value: string;
  changed_at: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  assigned_to: string;
  priority?: TaskPriority;
  due_date?: string;
  estimated_hours?: number;
  department?: string;
  category?: string;
}

export interface TaskUpdateInput {
  status?: TaskStatus;
  progress_pct?: number;
  expected_complete_date?: string;
  developer_notes?: string;
  manager_notes?: string;
  related_commits?: string[];
  related_pr_url?: string;
}
