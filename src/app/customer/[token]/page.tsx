import { getCustomerPortal } from "@/lib/customer-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_TH: Record<string, string> = {
  "New Lead": "ลูกค้าใหม่", Contacted: "ติดต่อแล้ว", "Site Visit": "เยี่ยมชมโครงการ",
  Booking: "จองแล้ว", Contract: "ทำสัญญาแล้ว", "Loan Approved": "อนุมัติสินเชื่อแล้ว",
  Transfer: "โอนกรรมสิทธิ์แล้ว", "Closed Deal": "โอนกรรมสิทธิ์แล้ว",
};

function thDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
const baht = (n: number | null) => (n == null ? "-" : `฿${Number(n).toLocaleString("th-TH")}`);

export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getCustomerPortal(decodeURIComponent(token));

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-aviva-bg text-aviva-text">
        <div className="text-center">
          <h1 className="text-lg font-bold text-aviva-gold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-aviva-secondary mt-2">ลิงก์ไม่ถูกต้องหรือถูกยกเลิกแล้ว</p>
        </div>
      </main>
    );
  }

  const paidCount = data.installments.filter((i) => i.status === "paid" || i.paid_date).length;

  return (
    <main className="min-h-screen px-5 py-8 bg-aviva-bg text-aviva-text">
      <div className="max-w-md mx-auto space-y-5">
        <header>
          <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
          <p className="text-sm text-aviva-secondary">โครงการ {data.project_name}</p>
          <p className="text-base font-semibold mt-2">สวัสดีคุณ{data.customer_name}</p>
          <p className="text-xs text-aviva-secondary">
            {data.plot_number ? `แปลง ${data.plot_number}` : ""}{data.house_model ? ` · แบบ ${data.house_model}` : ""}
          </p>
          <span className="inline-block mt-2 text-xs font-bold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/20 px-3 py-1 rounded-full">
            สถานะ: {STATUS_TH[data.status] ?? data.status}
          </span>
        </header>

        {/* Milestone timeline */}
        <section className="bg-aviva-card/80 border border-aviva-gold/10 rounded-2xl p-4">
          <p className="text-xs font-bold text-aviva-secondary mb-3">ขั้นตอนการซื้อ</p>
          <div className="space-y-3">
            {data.milestones.map((m) => (
              <div key={m.key} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${m.date ? "bg-aviva-gold" : "bg-aviva-secondary/30"}`} />
                <span className={`text-sm flex-1 ${m.date ? "text-aviva-text font-medium" : "text-aviva-secondary"}`}>{m.label}</span>
                <span className="text-xs text-aviva-secondary">{thDate(m.date) ?? "รอดำเนินการ"}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Construction progress */}
        {data.progress != null && (
          <section className="bg-aviva-card/80 border border-aviva-gold/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-aviva-secondary">ความคืบหน้าการก่อสร้าง</p>
              <span className="text-sm font-bold text-aviva-gold">{data.progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-aviva-gold/10 overflow-hidden">
              <div className="h-full bg-aviva-gold" style={{ width: `${Math.min(100, Math.max(0, data.progress))}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-aviva-secondary">
              {data.phase && <span>ขั้นตอน: {data.phase}</span>}
              {data.planned_completion_date && <span>คาดเสร็จ {thDate(data.planned_completion_date)}</span>}
            </div>
          </section>
        )}

        {/* Installments */}
        {data.installments.length > 0 && (
          <section className="bg-aviva-card/80 border border-aviva-gold/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-aviva-secondary">งวดการชำระเงิน</p>
              <span className="text-xs text-aviva-secondary">ชำระแล้ว {paidCount}/{data.installments.length} งวด</span>
            </div>
            <div className="space-y-2">
              {data.installments.map((it, i) => {
                const paid = it.status === "paid" || !!it.paid_date;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs border-b border-aviva-gold/5 pb-2 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-aviva-text truncate">{it.name ?? `งวดที่ ${it.installment_no ?? i + 1}`}</p>
                      {it.due_date && <p className="text-[10px] text-aviva-secondary">ครบกำหนด {thDate(it.due_date)}</p>}
                    </div>
                    <span className="text-aviva-text font-medium">{baht(it.amount)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${paid ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                      {paid ? "ชำระแล้ว" : "รอชำระ"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="text-center text-[11px] text-aviva-secondary/60 pt-2">
          หากมีข้อสงสัย ติดต่อทีมขายโครงการ {data.project_name}
        </footer>
      </div>
    </main>
  );
}
