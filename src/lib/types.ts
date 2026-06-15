export interface Project {
  id: string
  project_name: string | null
  total_units: number | null
  sold_units: number | null
  available_units: number | null
  created_at: string | null
}

export interface StaffUser {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  created_at: string | null
}

export interface House {
  id: string
  house_number: string | null
  status: string | null
  progress: number | null
  price: number | null
  customer_id: string | null
  project_id: string | null
  created_at: string | null
  projects?: Project
}

export interface Customer {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  budget: number | null
  status: string | null
  assigned_sales: string | null
  project_interest: string | null
  created_at: string | null
  users?: StaffUser
  projects?: Project
}

export interface Lead {
  id: string
  customer_name: string
  phone: string | null
  budget: number | null
  status: string | null
  source: string | null
  project_id: string | null
  assigned_to: string | null
  notes: string | null
  created_at: string | null
  projects?: Project
  users?: StaffUser
}

export interface SalesActivity {
  id: string
  customer_id: string | null
  activity_type: string | null
  note: string | null
  created_by: string | null
  activity_date: string | null
  customers?: { full_name: string | null }
  users?: { full_name: string | null }
}

export interface ConstructionReport {
  id: string
  house_id: string | null
  work_detail: string | null
  progress: number | null
  issue: string | null
  created_by: string | null
  created_at: string | null
  houses?: { house_number: string | null; project_id: string | null; projects?: { project_name: string | null } }
  users?: { full_name: string | null }
}

export interface QCDefect {
  id: string
  house_id: string | null
  defect_type: string | null
  defect_detail: string | null
  status: string | null
  before_image: string | null
  after_image: string | null
  created_at: string | null
  // Phase 2
  severity: string | null
  sla_days: number | null
  due_date: string | null
  priority: number | null
  escalated: boolean | null
  houses?: { house_number: string | null; projects?: { project_name: string | null } }
}

export interface ConstructionLog {
  id: string
  project_id: string | null
  log_date: string | null
  progress_percent: number | null
  photo_urls: string[] | null
  // Phase 2
  notes: string | null
  draft_report: string | null
  submit_status: string | null
  submitted_by: string | null
  submitted_at: string | null
  created_at: string | null
}

export interface FinanceTransaction {
  id: string
  transaction_type: string | null
  amount: number | null
  description: string | null
  approved_by: string | null
  project_id: string | null
  created_at: string | null
  projects?: { project_name: string | null }
  users?: { full_name: string | null }
}

export interface AILog {
  id: string
  module: string | null
  ai_summary: string | null
  created_at: string | null
}

// Utility
export function fmt(amount: number): string {
  if (amount >= 1_000_000) return `฿${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `฿${(amount / 1_000).toFixed(0)}K`
  return `฿${amount.toLocaleString('th-TH')}`
}

export const STATUS_CUSTOMER: Record<string, { label: string; color: string }> = {
  prospect:    { label: 'ติดต่อเบื้องต้น', color: 'bg-slate-700 text-slate-300' },
  interested:  { label: 'สนใจ',           color: 'bg-blue-900/60 text-blue-300' },
  negotiating: { label: 'เจรจา',          color: 'bg-amber-900/60 text-amber-300' },
  signed:      { label: 'เซ็นสัญญา',      color: 'bg-emerald-900/60 text-emerald-300' },
  transferred: { label: 'โอนแล้ว',        color: 'bg-purple-900/60 text-purple-300' },
}

export const STATUS_LEAD: Record<string, { label: string; color: string }> = {
  new:         { label: 'ใหม่',           color: 'bg-slate-700 text-slate-300' },
  contacted:   { label: 'ติดต่อแล้ว',     color: 'bg-blue-900/60 text-blue-300' },
  qualified:   { label: 'พร้อมซื้อ',      color: 'bg-emerald-900/60 text-emerald-300' },
  unqualified: { label: 'ไม่ผ่าน',        color: 'bg-red-900/60 text-red-300' },
  converted:   { label: 'ปิดการขาย',      color: 'bg-purple-900/60 text-purple-300' },
}

// Normalize any status variant from DB → canonical key used in STATUS_LEAD
const LEAD_STATUS_MAP: Record<string, string> = {
  // new
  'new': 'new', 'New': 'new', 'new lead': 'new', 'New Lead': 'new',
  // contacted
  'contacted': 'contacted', 'Contacted': 'contacted',
  // qualified
  'qualified': 'qualified', 'Qualified': 'qualified',
  'interested': 'qualified', 'Interested': 'qualified',
  'booking': 'qualified', 'Booking': 'qualified',
  // converted
  'converted': 'converted', 'Converted': 'converted',
  'closed deal': 'converted', 'Closed Deal': 'converted',
  'transfer': 'converted', 'Transfer': 'converted',
  // unqualified
  'unqualified': 'unqualified', 'Unqualified': 'unqualified',
}

export function normalizeLeadStatus(raw: string | null | undefined): string {
  if (!raw) return 'new'
  return LEAD_STATUS_MAP[raw] ?? LEAD_STATUS_MAP[raw.toLowerCase()] ?? 'new'
}

export const STATUS_QC: Record<string, { label: string; color: string }> = {
  open:        { label: 'รอดำเนินการ',    color: 'bg-red-900/60 text-red-300' },
  in_progress: { label: 'กำลังแก้ไข',    color: 'bg-amber-900/60 text-amber-300' },
  resolved:    { label: 'แก้ไขแล้ว',     color: 'bg-emerald-900/60 text-emerald-300' },
}

// ── Phase 2 ─────────────────────────────────────────────────────────────

// QC defect severity (badge colour, dot colour, sort rank)
export const SEVERITY: Record<string, { label: string; color: string; dot: string; rank: number }> = {
  critical: { label: 'วิกฤต',    color: 'bg-red-900/70 text-red-300 border border-red-700/50',        dot: 'bg-red-500',    rank: 4 },
  high:     { label: 'สูง',       color: 'bg-orange-900/60 text-orange-300 border border-orange-700/50', dot: 'bg-orange-400', rank: 3 },
  medium:   { label: 'ปานกลาง',  color: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/40', dot: 'bg-yellow-400', rank: 2 },
  low:      { label: 'ต่ำ',       color: 'bg-slate-700 text-slate-300 border border-slate-600',          dot: 'bg-slate-400',  rank: 1 },
}

export function severityCfg(s: string | null | undefined) {
  return SEVERITY[s ?? 'medium'] ?? SEVERITY.medium
}

// SLA countdown derived from due_date + current status
export interface SlaInfo {
  daysLeft: number
  overdue: boolean
  dueToday: boolean
  dueSoon: boolean
  resolved: boolean
}

export function slaInfo(dueDate: string | null | undefined, status: string | null | undefined): SlaInfo | null {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const resolved = status === 'resolved'
  return {
    daysLeft,
    resolved,
    overdue:  !resolved && daysLeft < 0,
    dueToday: !resolved && daysLeft === 0,
    dueSoon:  !resolved && daysLeft > 0 && daysLeft <= 2,
  }
}

// Construction-log approval workflow
export const SUBMIT_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'ฉบับร่าง',   color: 'bg-slate-700 text-slate-300' },
  submitted: { label: 'รออนุมัติ',  color: 'bg-amber-900/60 text-amber-300' },
  approved:  { label: 'อนุมัติแล้ว', color: 'bg-emerald-900/60 text-emerald-300' },
}

export function submitStatusCfg(s: string | null | undefined) {
  return SUBMIT_STATUS[s ?? 'draft'] ?? SUBMIT_STATUS.draft
}

// Next QC status in the open → in_progress → resolved cycle
export const QC_NEXT_STATUS: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'open',
}

export const ACTIVITY_ICON: Record<string, string> = {
  call:             '📞',
  visit:            '🏠',
  proposal:         '📋',
  contract_signing: '✍️',
  follow_up:        '🔔',
}

export const MODULE_ICON: Record<string, string> = {
  sales:        '📈',
  construction: '🏗️',
  finance:      '💰',
  leads:        '🎯',
  qc:           '✅',
}
