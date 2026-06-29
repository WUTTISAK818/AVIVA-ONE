'use client';

import {
  DollarSign, Users, Briefcase, AlertCircle, Megaphone, Package,
  ShieldAlert, FolderOpen, BookOpen, Wrench, FileText, Settings
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import { useCurrentUser } from '@/lib/user-context';

interface MenuOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className: string }>;
  href?: string;
  action?: string;
  size: 'lg' | 'md' | 'sm'; // lg=30%, md=20%, sm=10%
  color: string;
}

const MENU_OPTIONS: MenuOption[] = [
  {
    id: 'finance',
    label: 'การเงิน',
    description: 'บัญชี ธุรกรรม การจ่ายเงิน',
    icon: DollarSign,
    action: 'finance',
    size: 'lg',
    color: 'from-green-600 to-green-700',
  },
  {
    id: 'hr',
    label: 'ทรัพยากรมนุษย์',
    description: 'พนักงาน เงินเดือน ลา',
    icon: Users,
    action: 'hr',
    size: 'lg',
    color: 'from-blue-600 to-blue-700',
  },
  {
    id: 'accounting',
    label: 'การบัญชี',
    description: 'สมุดรายวันทั่วไป ใบสั่งจ่าย',
    icon: Briefcase,
    action: 'accounting',
    size: 'md',
    color: 'from-purple-600 to-purple-700',
  },
  {
    id: 'materials',
    label: 'วัสดุ/ก่อสร้าง',
    description: 'ซื้อ คลังสินค้า ประเมิน',
    icon: Package,
    action: 'materials',
    size: 'md',
    color: 'from-orange-600 to-orange-700',
  },
  {
    id: 'marketing',
    label: 'การตลาด',
    description: 'แคมเปญ ข้อความ',
    icon: Megaphone,
    action: 'marketing',
    size: 'sm',
    color: 'from-pink-600 to-pink-700',
  },
  {
    id: 'after-sales',
    label: 'หลังการขาย',
    description: 'ประกันสินค้า ร้องเรียน',
    icon: ShieldAlert,
    action: 'after-sales',
    size: 'sm',
    color: 'from-red-600 to-red-700',
  },
  {
    id: 'approvals',
    label: 'การอนุมัติ',
    description: 'คำขออนุมัติ ลำดับ',
    icon: AlertCircle,
    action: 'approvals',
    size: 'sm',
    color: 'from-yellow-600 to-yellow-700',
  },
  {
    id: 'community',
    label: 'ชุมชน/ส่วนกลาง',
    description: 'สมาชิก ประกาศ',
    icon: FolderOpen,
    action: 'community',
    size: 'sm',
    color: 'from-cyan-600 to-cyan-700',
  },
  {
    id: 'documents',
    label: 'เอกสาร',
    description: 'สร้าง ดาวน์โหลด',
    icon: FileText,
    action: 'documents',
    size: 'sm',
    color: 'from-indigo-600 to-indigo-700',
  },
  {
    id: 'audit',
    label: 'ตรวจสอบ/ประวัติ',
    description: 'บันทึกสำนักงาน กิจกรรม',
    icon: BookOpen,
    action: 'audit',
    size: 'sm',
    color: 'from-slate-600 to-slate-700',
  },
];

interface OfficeMenuGridProps {
  onSelectTab: (tab: any) => void;
  activeTab?: string;
}

export default function OfficeMenuGrid({ onSelectTab, activeTab }: OfficeMenuGridProps) {
  const user = useCurrentUser();

  // Filter visible tabs based on user role
  const visibleMenus = MENU_OPTIONS.filter((menu) => {
    if (!user) return false;
    // Managers see all, others see based on department
    if (user.isManager || user.isAdmin) return true;
    if (menu.id === 'finance' && user.department === 'ฝ่ายการเงิน') return true;
    if (menu.id === 'accounting' && user.department === 'ฝ่ายบัญชี') return true;
    if (menu.id === 'hr' && user.department === 'ฝ่าย HR') return true;
    if (menu.id === 'materials' && user.department === 'ฝ่ายก่อสร้าง') return true;
    if (menu.id === 'marketing' && user.department === 'ฝ่ายการตลาด') return true;
    if (menu.id === 'after-sales' && user.department === 'ฝ่ายหลังการขาย') return true;
    // All users can see: approvals, community, documents, audit
    if (['approvals', 'community', 'documents', 'audit'].includes(menu.id)) return true;
    return false;
  });

  const gridColsClass = {
    lg: 'col-span-full md:col-span-2', // 30% width (roughly 2/6 in a 6-col grid)
    md: 'col-span-full md:col-span-1.5', // 20% width
    sm: 'col-span-full md:col-span-1', // 10% width
  };

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-aviva-text">เมนูออฟฟิศ</h2>
        <p className="text-xs text-aviva-secondary/60 mt-1">
          เลือกฝ่ายงานเพื่อดูข้อมูลและจัดการงาน
        </p>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-6 gap-4">
        {visibleMenus.map((menu) => {
          const Icon = menu.icon;
          const isBig = menu.size === 'lg';
          const isMedium = menu.size === 'md';

          return (
            <button
              key={menu.id}
              onClick={() => onSelectTab(menu.action || menu.id)}
              className={clsx(
                'group relative overflow-hidden rounded-2xl p-4 text-left transition-all active:scale-95',
                'border border-aviva-gold/20 hover:border-aviva-gold/40',
                gridColsClass[menu.size],
                'min-h-28 md:min-h-36'
              )}
            >
              {/* Gradient background */}
              <div
                className={clsx(
                  'absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-15 transition-opacity',
                  menu.color
                )}
              />

              {/* Glow effect on hover */}
              <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 -skew-x-12 group-hover:animate-pulse" />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <Icon
                    className={clsx(
                      'transition-all',
                      isBig ? 'w-7 h-7' : isMedium ? 'w-6 h-6' : 'w-5 h-5',
                      'text-aviva-gold'
                    )}
                  />
                  {activeTab === menu.action && (
                    <span className="text-[10px] font-bold bg-aviva-gold/20 text-aviva-gold px-2 py-0.5 rounded">
                      ✓ ใช้งาน
                    </span>
                  )}
                </div>

                <div>
                  <p
                    className={clsx(
                      'font-bold text-aviva-text transition-colors group-hover:text-aviva-gold',
                      isBig ? 'text-base' : 'text-sm'
                    )}
                  >
                    {menu.label}
                  </p>
                  <p className="text-[11px] text-aviva-secondary/70 mt-1 line-clamp-2">
                    {menu.description}
                  </p>
                </div>

                {/* Size indicator */}
                <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] text-aviva-secondary/50">
                  <span>
                    {menu.size === 'lg' ? '▓▓▓' : menu.size === 'md' ? '▓▓░' : '▓░░'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 p-3 bg-aviva-card/30 rounded-xl border border-aviva-gold/10 text-[11px] text-aviva-secondary/60">
        <p className="font-semibold text-aviva-gold mb-1">📊 สัดส่วน:</p>
        <div className="grid grid-cols-3 gap-2">
          <span>▓▓▓ ใหญ่ (30%) = ความสำคัญสูง</span>
          <span>▓▓░ ปานกลาง (20%) = ความสำคัญปาน</span>
          <span>▓░░ เล็ก (10%) = เครื่องมือ</span>
        </div>
      </div>
    </div>
  );
}
