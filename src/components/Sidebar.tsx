'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Hammer,
  ShieldCheck,
  DollarSign,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { href: '/',            icon: LayoutDashboard, label: 'ภาพรวม',       sub: 'Dashboard' },
  { href: '/projects',   icon: Building2,        label: 'โครงการ',      sub: 'Projects' },
  { href: '/customers',  icon: Users,            label: 'ลูกค้า CRM',   sub: 'Customers' },
  { href: '/leads',      icon: Target,           label: 'ลีด',          sub: 'Leads' },
  { href: '/construction', icon: Hammer,         label: 'ก่อสร้าง',     sub: 'Construction' },
  { href: '/qc',         icon: ShieldCheck,      label: 'ตรวจสอบ QC',  sub: 'Quality Control' },
  { href: '/finance',    icon: DollarSign,       label: 'การเงิน',      sub: 'Finance' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-950 border-r border-slate-800/70 overflow-y-auto">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">AVIVA Developer</p>
            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Management Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">เมนูหลัก</p>
        {navItems.map(({ href, icon: Icon, label, sub }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-150
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                }
              `}
            >
              <Icon size={17} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                <p className={`text-[10px] truncate ${isActive ? 'text-blue-500/70' : 'text-slate-600'}`}>{sub}</p>
              </div>
              {isActive && <ChevronRight size={13} className="text-blue-500 shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
            PA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 truncate">พิชัย อินทราวุธ</p>
            <p className="text-[10px] text-slate-600 truncate">CEO</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
        </div>
      </div>
    </aside>
  )
}
