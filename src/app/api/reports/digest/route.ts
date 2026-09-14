import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";
import { callClaudeText } from "@/lib/claude";
import { parseSchedule, thaiDateStr } from "@/lib/work-schedule";
import { resolveOffDay, groupSwapsByEmail } from "@/lib/off-day-swaps";

export const dynamic = "force-dynamic";

// Executive Daily Digest — หน้าเดียวจบสำหรับผู้บริหาร:
// ใครส่ง/ใครยังไม่ส่ง + เหตุผล (วันหยุด/ลาอนุมัติแล้ว/ไม่ทราบสาเหตุ) + AI สรุปรวมรายงานทุกฝ่ายของวันนั้น (cache ใน app_settings คุมค่าใช้จ่าย)

interface PersonRow {
  name: string;
  department: string;
  status: "submitted" | "late" | "off" | "leave" | "missing";
  reasonDetail: string | null; // ประเภทการลา เมื่อ status === "leave"
  submittedAt: string | null;
  acknowledged: boolean;
  reportId: string | null;
}

export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const todayThai = thaiDateStr();
    const date = searchParams.get("date") || todayThai;
    const month = searchParams.get("month"); // "YYYY-MM" → โหมดสรุปรายเดือน/รายคน
    const force = searchParams.get("force") === "true";

    const db = getSupabaseAdmin();

    // ── โหมดรายเดือน: สถิติการส่งต่อคน (ส่งกี่วัน/ตรงเวลา/ล่าช้า/อัตราตรงเวลา) ──
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const monthStart = `${month}-01`;
      const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
        .toISOString().slice(0, 10);

      const [{ data: employees }, { data: reports }, { data: roleRows }, { data: absences }] = await Promise.all([
        db.from("employees")
          .select("full_name, email, department")
          .eq("status", "active")
          .neq("department", "ฝ่ายสวน"),
        db.from("work_reports")
          .select("user_email, status, report_date, acknowledged_by")
          .eq("report_type", "daily")
          .gte("report_date", monthStart)
          .lte("report_date", monthEnd)
          .in("status", ["submitted", "late"]),
        db.from("users").select("email, role"),
        db.from("report_absences")
          .select("employee_email, status")
          .gte("report_date", monthStart)
          .lte("report_date", monthEnd),
      ]);

      const roleByEmail = new Map(
        (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
      );
      const expected = (employees ?? []).filter(
        e => e.email && !isManagerRole(roleByEmail.get((e.email ?? "").toLowerCase()))
      );

      const people = expected.map(e => {
        const email = (e.email ?? "").toLowerCase();
        const mine = (reports ?? []).filter(
          r => (r.user_email ?? "").toLowerCase() === email
        );
        const myAbsences = (absences ?? []).filter(a => (a.employee_email ?? "").toLowerCase() === email);
        const submitted = mine.length;
        const late = mine.filter(r => r.status === "late").length;
        const onTime = submitted - late;
        return {
          name: e.full_name,
          department: e.department ?? "-",
          submitted,
          onTime,
          late,
          acknowledged: mine.filter(r => r.acknowledged_by).length,
          absenceExplained: myAbsences.filter(a => a.status === "explained").length,
          absenceUnexplained: myAbsences.filter(a => a.status === "closed_unexplained").length,
          onTimeRate: submitted > 0 ? Math.round((onTime / submitted) * 100) : null,
        };
      }).sort((a, b) => b.submitted - a.submitted);

      const teamSubmitted = people.reduce((s, p) => s + p.submitted, 0);
      const teamLate = people.reduce((s, p) => s + p.late, 0);
      return NextResponse.json({
        month,
        people,
        team: {
          submitted: teamSubmitted,
          late: teamLate,
          onTimeRate: teamSubmitted > 0 ? Math.round(((teamSubmitted - teamLate) / teamSubmitted) * 100) : null,
        },
      });
    }

    const [{ data: employees }, { data: reports }, { data: roleRows }, { data: cfg }, { data: holidays }, { data: leaves }, { data: swapRows }] = await Promise.all([
      db.from("employees")
        .select("id, full_name, email, department, weekly_off_day")
        .eq("status", "active")
        .neq("department", "ฝ่ายสวน"),
      db.from("work_reports")
        .select("id, user_email, employee_name, department, status, summary, submitted_at, acknowledged_by, last_edited_at")
        .eq("report_type", "daily")
        .eq("report_date", date)
        .in("status", ["submitted", "late"]),
      db.from("users").select("email, role"),
      db.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle(),
      db.from("company_holidays").select("holiday_date").eq("holiday_date", date),
      db.from("leave_requests")
        .select("employee_id, leave_type")
        .eq("status", "approved")
        .lte("date_from", date)
        .gte("date_to", date),
      db.from("off_day_swaps")
        .select("employee_email, original_off_date, swapped_off_date")
        .eq("status", "approved")
        .or(`original_off_date.eq.${date},swapped_off_date.eq.${date}`),
    ]);

    const roleByEmail = new Map(
      (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
    );
    const reportByEmail = new Map(
      (reports ?? []).map(r => [(r.user_email ?? "").toLowerCase(), r])
    );
    const schedule = parseSchedule((cfg as { value?: string } | null)?.value);
    const isHoliday = (holidays ?? []).length > 0;
    const dow = new Date(date + "T12:00:00").getDay();
    const leaveByEmployeeId = new Map((leaves ?? []).map(l => [l.employee_id as string, l.leave_type as string]));
    const swapsByEmail = groupSwapsByEmail(swapRows ?? []);

    // ผู้บริหารไม่ต้องส่งรายงาน — ไม่นับเป็น "ยังไม่ส่ง"
    const expected = (employees ?? []).filter(
      e => e.email && !isManagerRole(roleByEmail.get((e.email ?? "").toLowerCase()))
    );

    const people: PersonRow[] = expected.map(e => {
      const r = reportByEmail.get((e.email ?? "").toLowerCase());
      let status: PersonRow["status"];
      let reasonDetail: string | null = null;
      const off = resolveOffDay({
        dateStr: date, dow, weeklyOffDay: e.weekly_off_day,
        companyWeeklyOff: schedule.weekly_off_days, swaps: swapsByEmail.get((e.email ?? "").toLowerCase()) ?? [],
      });
      if (r) {
        status = r.status as "submitted" | "late";
      } else if (isHoliday || off.isOff) {
        status = "off";
        reasonDetail = off.swapped ? "สลับวันหยุด" : null;
      } else if (leaveByEmployeeId.has(e.id)) {
        status = "leave";
        reasonDetail = leaveByEmployeeId.get(e.id) ?? null;
      } else {
        status = "missing";
      }
      return {
        name: e.full_name,
        department: e.department ?? "-",
        status,
        reasonDetail,
        submittedAt: r?.submitted_at ?? null,
        acknowledged: !!r?.acknowledged_by,
        reportId: r?.id ?? null,
      };
    });

    const stats = {
      expected: people.length,
      submitted: people.filter(p => p.status === "submitted" || p.status === "late").length,
      late: people.filter(p => p.status === "late").length,
      offDay: people.filter(p => p.status === "off").length,
      onLeave: people.filter(p => p.status === "leave").length,
      missing: people.filter(p => p.status === "missing").length,
      acknowledged: people.filter(p => p.acknowledged).length,
    };

    // ── AI สรุปรวม (cache ต่อวันใน app_settings, สร้างใหม่เมื่อมีรายงานแก้/ส่งเพิ่ม) ──
    let aiSummary: string | null = null;
    let aiCached = false;
    const submittedReports = reports ?? [];

    if (submittedReports.length > 0) {
      const cacheKey = `report_digest_${date}`;
      const latestChange = submittedReports
        .map(r => new Date(r.last_edited_at ?? r.submitted_at ?? 0).getTime())
        .reduce((a, b) => Math.max(a, b), 0);

      if (!force) {
        const { data: cached } = await db.from("app_settings").select("value").eq("key", cacheKey).maybeSingle();
        if (cached?.value) {
          try {
            const parsed = JSON.parse(cached.value) as { text: string; at: string; count: number };
            const fresh = new Date(parsed.at).getTime() >= latestChange && parsed.count === submittedReports.length;
            if (fresh && parsed.text) {
              aiSummary = parsed.text;
              aiCached = true;
            }
          } catch { /* cache เสีย → สร้างใหม่ */ }
        }
      }

      if (!aiSummary) {
        const ids = submittedReports.map(r => r.id);
        const { data: items } = await db
          .from("work_report_items")
          .select("report_id, category, description")
          .in("report_id", ids);
        const itemsByReport = new Map<string, { category: string; description: string }[]>();
        (items ?? []).forEach(it => {
          const list = itemsByReport.get(it.report_id) ?? [];
          list.push({ category: it.category, description: it.description });
          itemsByReport.set(it.report_id, list);
        });

        const catLabel: Record<string, string> = {
          activity: "กิจกรรม", achievement: "ผลสำเร็จ", issue: "ปัญหา", plan: "แผนพรุ่งนี้",
        };
        const reportText = submittedReports.map(r => {
          const lines = (itemsByReport.get(r.id) ?? [])
            .map(it => `  - [${catLabel[it.category] ?? it.category}] ${it.description}`)
            .join("\n");
          return `${r.employee_name} (${r.department})${r.status === "late" ? " [ส่งล่าช้า]" : ""}\n${r.summary ? `  สรุป: ${r.summary}\n` : ""}${lines}`;
        }).join("\n\n");

        const { text } = await callClaudeText({
          system: [
            "คุณคือเลขานุการผู้บริหารของบริษัทอสังหาริมทรัพย์ สรุปรายงานประจำวันของพนักงานทุกฝ่ายให้ผู้บริหารอ่านจบใน 1 นาที",
            "รูปแบบ (ภาษาไทย):",
            "1) ภาพรวมวันนี้ 1-2 ประโยค",
            "2) หัวข้อต่อฝ่าย: งานเด่น/ความคืบหน้า (bullet สั้น ๆ)",
            "3) ⚠️ ปัญหา/สิ่งที่ผู้บริหารต้องรู้หรือตัดสินใจ (ถ้ามี — ยกขึ้นให้เด่น)",
            "ห้ามแต่งข้อมูลที่ไม่มีในรายงาน · รวมไม่เกิน 12 bullet",
          ].join("\n"),
          messages: [{ role: "user", content: `รายงานประจำวันที่ ${date}:\n\n${reportText}` }],
          maxTokens: 900,
        });

        if (text) {
          aiSummary = text;
          await db.from("app_settings").upsert(
            { key: cacheKey, value: JSON.stringify({ text, at: new Date().toISOString(), count: submittedReports.length }) },
            { onConflict: "key" }
          );
        }
      }
    }

    return NextResponse.json({ date, stats, people, aiSummary, aiCached });
  } catch (err) {
    console.error("Error building report digest:", err);
    return NextResponse.json({ error: "Failed to build digest" }, { status: 500 });
  }
}
