"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// หน้า /documents เดิม (standalone) ไม่ได้เชื่อม workflow (work_queue/approval_logs/timeline)
// → redirect ไปแท็บ "คลังเอกสาร" ใน /office ที่เชื่อมระบบอนุมัติครบวงจรแทน (roadmap D2)
export default function DocumentsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/office?tab=documents");
  }, [router]);

  return (
    <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
      <p className="text-sm text-aviva-secondary">กำลังไปที่คลังเอกสาร…</p>
    </div>
  );
}
