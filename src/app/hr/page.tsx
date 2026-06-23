"use client";
import { useSearchParams } from "next/navigation";
import { Users, Clock, DollarSign, Camera } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import AttendancePage from "../attendance/page";
import PayrollPage from "../payroll/page";
import CctvPage from "../cctv/page";

type HRTab = "overview" | "attendance" | "payroll" | "cctv";

export default function HRHub() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") || "overview") as HRTab;

  if (!user || !(user.isAdmin || user.isManager || user.department === "ฝ่ายบุคคล")) {
    return <div className="p-4 text-center">Access denied</div>;
  }

  const tabs: { id: HRTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "overview", label: "ภาพรวม", icon: Users },
    { id: "attendance", label: "ลงเวลา", icon: Clock },
    { id: "payroll", label: "เงินเดือน", icon: DollarSign },
    { id: "cctv", label: "กล้องวงจรปิด", icon: Camera },
  ];

  return (
    <div className="pb-24">
      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-aviva-bg border-b border-aviva-gold/20">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/hr?tab=${id}`}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                activeTab === id
                  ? "text-aviva-gold border-aviva-gold"
                  : "text-aviva-secondary/60 border-transparent hover:text-aviva-secondary"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-aviva-gold">ระบบบุคคล (HR Management)</h2>
            <p className="text-aviva-secondary/80">เลือกฟังก์ชันจากแท็บด้านบนเพื่อบริหารจัดการบุคลากร</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              {tabs.filter(t => t.id !== "overview").map(({ id, label, icon: Icon }) => (
                <Link
                  key={id}
                  href={`/hr?tab=${id}`}
                  className="p-4 rounded-xl bg-aviva-card border border-aviva-gold/20 hover:border-aviva-gold/40 transition-colors"
                >
                  <Icon className="text-aviva-gold mb-2" size={24} />
                  <p className="font-medium text-sm">{label}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === "attendance" && <AttendancePage />}
        {activeTab === "payroll" && <PayrollPage />}
        {activeTab === "cctv" && <CctvPage />}
      </div>
    </div>
  );
}
